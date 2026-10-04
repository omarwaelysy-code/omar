import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { dbService } from '../services/dbService';
import { JournalEntry, Account, AccountType } from '../types';
import { 
  Search, Calendar, FileText, Download, Printer, Filter, PieChart, 
  ArrowLeftRight, TrendingUp, TrendingDown, RefreshCcw, CheckCircle2, 
  AlertTriangle, Shield, Wallet, Landmark, Coins, Scale, HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { exportToPDF } from '../utils/pdfUtils';
import { exportToExcel } from '../utils/excelUtils';
import { AccountingEngine } from '../services/AccountingEngine';
import { formatNumber } from '../utils/formatUtils';
import { useNavigation } from '../contexts/NavigationContext';

export const CashFlowStatement: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { setCurrentPage, setPendingLedgerParams } = useNavigation();
  const reportRef = useRef<HTMLDivElement>(null);

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [methodType, setMethodType] = useState<'indirect' | 'direct'>('indirect');
  const [viewMode, setViewMode] = useState<'single' | 'monthly' | 'quarterly' | 'yearly'>('single');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const subscriptions: (() => void)[] = [];
    const onError = (err: Error) => {
      setError(err.message);
      setLoading(false);
    };

    subscriptions.push(dbService.subscribe<JournalEntry>('journal_entries', user.company_id, (data) => {
      setEntries(data);
      setLoading(false);
    }, onError));

    subscriptions.push(dbService.subscribe<Account>('accounts', user.company_id, setAccounts, onError));
    subscriptions.push(dbService.subscribe<AccountType>('account_types', user.company_id, setAccountTypes, onError));

    dbService.get<any>('companies', user.company_id).then(c => {
      if (c) setCompany(c);
    });

    return () => subscriptions.forEach(unsub => unsub());
  }, [user, refreshTrigger]);

  const handleRefresh = () => {
    setLoading(true);
    setRefreshTrigger(prev => prev + 1);
  };

  const setPreset = (preset: 'this_month' | 'this_quarter' | 'this_year' | 'last_year') => {
    const now = new Date();
    const year = now.getFullYear();
    let start = '';
    let end = '';

    const formatDate = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    if (preset === 'this_month') {
      start = formatDate(new Date(year, now.getMonth(), 1));
      end = formatDate(now);
    } else if (preset === 'this_quarter') {
      const currentQuarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      start = formatDate(new Date(year, currentQuarterStartMonth, 1));
      end = formatDate(now);
    } else if (preset === 'this_year') {
      start = formatDate(new Date(year, 0, 1));
      end = formatDate(now);
    } else if (preset === 'last_year') {
      start = formatDate(new Date(year - 1, 0, 1));
      end = formatDate(new Date(year - 1, 11, 31));
    }

    setDateRange({ start, end });
  };

  // Sub-periods calculation for multi-period comparison
  const subPeriods = AccountingEngine.getSubPeriods(dateRange.start, dateRange.end, viewMode);
  const periodResults = subPeriods.map(period => {
    return {
      period,
      data: AccountingEngine.calculateCashFlowStatement(
        accounts,
        accountTypes,
        entries,
        period.start,
        period.end,
        company?.fiscal_year_end
      )
    };
  });

  // Overall range calculation
  const totalData = AccountingEngine.calculateCashFlowStatement(
    accounts,
    accountTypes,
    entries,
    dateRange.start,
    dateRange.end,
    company?.fiscal_year_end
  );

  const currency = company?.currency || company?.settings?.currency || 'EGP';

  const handleExportPDF = async () => {
    if (reportRef.current) {
      await exportToPDF(reportRef.current, { 
        filename: 'Cash_Flow_Statement', 
        orientation: viewMode === 'single' ? 'portrait' : 'landscape',
        reportTitle: `${language === 'ar' ? 'قائمة التدفقات النقدية' : 'Statement of Cash Flows'} (${dateRange.start} - ${dateRange.end})`
      });
    }
  };

  const handleExportExcel = () => {
    const isAr = language === 'ar';
    const rows: any[] = [];

    const addSectionHeader = (title: string) => {
      rows.push({
        [isAr ? 'البند / البيان' : 'Item / Description']: title,
        [isAr ? 'القيمة' : 'Amount']: ''
      });
    };

    const addRow = (desc: string, amount: number) => {
      rows.push({
        [isAr ? 'البند / البيان' : 'Item / Description']: desc,
        [isAr ? 'القيمة' : 'Amount']: amount
      });
    };

    addSectionHeader(isAr ? 'أولاً: التدفقات النقدية من الأنشطة التشغيلية' : '1. Cash Flows from Operating Activities');
    addRow(isAr ? 'صافي ربح / (خسارة) الفترة' : 'Net Profit / (Loss) for the period', totalData.operating.netProfit);
    addRow(isAr ? 'إهلاك الأصول الثابتة' : 'Depreciation Expense', totalData.operating.adjustments.depreciation);
    addRow(isAr ? 'مخصصات وخسائر اضمحلال' : 'Provisions & Impairments', totalData.operating.adjustments.provisions);
    addRow(isAr ? 'أرباح التشغيل قبل التغيرات في رأس المال العامل' : 'Operating Profit before Working Capital Changes', totalData.operating.operatingProfitBeforeWC);
    addRow(isAr ? 'التغير في حسابات العملاء والمدينين' : 'Change in Accounts Receivable', totalData.operating.workingCapital.receivablesChange);
    addRow(isAr ? 'التغير في المخزون' : 'Change in Inventory', totalData.operating.workingCapital.inventoryChange);
    addRow(isAr ? 'التغير في حسابات الموردين والدائنين' : 'Change in Accounts Payable', totalData.operating.workingCapital.payablesChange);
    addRow(isAr ? 'التغير في الأرصدة المدينة والدائنة الأخرى' : 'Other Working Capital Changes', totalData.operating.workingCapital.otherWCChange);
    addRow(isAr ? 'صافي التدفق النقدي من الأنشطة التشغيلية' : 'Net Cash from Operating Activities', totalData.operating.netCashOperating);

    rows.push({});
    addSectionHeader(isAr ? 'ثانياً: التدفقات النقدية من الأنشطة الاستثمارية' : '2. Cash Flows from Investing Activities');
    addRow(isAr ? 'المدفوعات لشراء أصول ثابتة ومعدات' : 'Purchase of Fixed Assets & Equipment', totalData.investing.purchaseOfFixedAssets);
    addRow(isAr ? 'المتحصلات من بيع أصول ثابتة' : 'Proceeds from Sale of Fixed Assets', totalData.investing.proceedsFromSaleOfAssets);
    addRow(isAr ? 'صافي التدفق النقدي من الأنشطة الاستثمارية' : 'Net Cash from Investing Activities', totalData.investing.netCashInvesting);

    rows.push({});
    addSectionHeader(isAr ? 'ثالثاً: التدفقات النقدية من الأنشطة التمويلية' : '3. Cash Flows from Financing Activities');
    addRow(isAr ? 'المتحصلات من زيادة رأس المال' : 'Capital Contributions', totalData.financing.capitalContributions);
    addRow(isAr ? 'صافي حركة القروض والتسهيلات البنكية' : 'Net Borrowings & Bank Facilities', totalData.financing.loansNetChange);
    addRow(isAr ? 'توزيعات الأرباح والمسحوبات' : 'Dividends & Drawings Paid', totalData.financing.dividendsAndDrawingsPaid);
    addRow(isAr ? 'صافي التدفق النقدي من الأنشطة التمويلية' : 'Net Cash from Financing Activities', totalData.financing.netCashFinancing);

    rows.push({});
    addSectionHeader(isAr ? 'رابعاً: خلاصة ومطابقة حركة النقدية وما في حكمها' : '4. Summary & Cash Reconciliation');
    addRow(isAr ? 'صافي التغير في النقدية وما في حكمها' : 'Net Change in Cash and Cash Equivalents', totalData.netActualCashChange);
    addRow(isAr ? 'رصيد النقدية وما في حكمها في بداية الفترة' : 'Cash and Equivalents at Beginning of Period', totalData.beginningCash);
    addRow(isAr ? 'رصيد النقدية وما في حكمها في نهاية الفترة' : 'Cash and Equivalents at End of Period', totalData.endingCash);

    exportToExcel(rows, {
      filename: 'Cash_Flow_Statement',
      sheetName: isAr ? 'قائمة التدفقات النقدية' : 'Cash Flow Statement'
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const navigateToLedger = (accountId: string) => {
    setPendingLedgerParams({
      accountId,
      startDate: dateRange.start,
      endDate: dateRange.end
    });
    setCurrentPage('general_ledger_report');
  };

  const isAr = language === 'ar';

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12" dir={dir}>
      {/* Top Header & Actions Bar */}
      <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3.5 no-print">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-200 flex items-center justify-center shrink-0 shadow-2xs">
            <ArrowLeftRight size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900">
                {isAr ? 'قائمة التدفقات النقدية (IAS 7 / EAS 4)' : 'Statement of Cash Flows (IAS 7 / EAS 4)'}
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                {currency}
              </span>
              {totalData.isReconciled ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 size={11} />
                  <span>{isAr ? 'مطابق دفترياً' : 'Reconciled'}</span>
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                  <AlertTriangle size={11} />
                  <span>{isAr ? `فرق: ${formatNumber(totalData.discrepancy)}` : `Diff: ${formatNumber(totalData.discrepancy)}`}</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
              {isAr 
                ? 'تحليل شامل لحركة السيولة من الأنشطة التشغيلية والاستثمارية والتمويلية طبقاً للمعايير المحاسبية الدولية والمصرية' 
                : 'Comprehensive cash flow analysis for Operating, Investing, and Financing activities per IAS 7 standards.'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Method Switcher */}
          <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 shadow-inner">
            <button
              type="button"
              onClick={() => setMethodType('indirect')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                methodType === 'indirect' 
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-100' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {isAr ? 'الطريقة غير المباشرة' : 'Indirect Method'}
            </button>
            <button
              type="button"
              onClick={() => setMethodType('direct')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                methodType === 'direct' 
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-100' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {isAr ? 'الطريقة المباشرة' : 'Direct Method'}
            </button>
          </div>

          <div className="h-5 w-px bg-slate-200 mx-0.5 hidden sm:block" />

          {/* Export Buttons */}
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 rounded-lg text-xs font-bold transition-all shadow-2xs"
            title="Excel"
          >
            <Download size={13} />
            <span>Excel</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 border border-rose-200 text-rose-800 hover:bg-rose-100 rounded-lg text-xs font-bold transition-all shadow-2xs"
            title="PDF"
          >
            <FileText size={13} />
            <span>PDF</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold transition-all shadow-2xs"
            title={isAr ? 'طباعة' : 'Print'}
          >
            <Printer size={13} />
            <span className="hidden sm:inline">{isAr ? 'طباعة' : 'Print'}</span>
          </button>
          <button
            onClick={handleRefresh}
            className="p-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-bold transition-all shadow-2xs"
            title={isAr ? 'تحديث البيانات' : 'Refresh'}
          >
            <RefreshCcw size={14} className={loading ? 'animate-spin text-indigo-600' : ''} />
          </button>
        </div>
      </div>

      {/* Date Filters & Presets Toolbar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
            <Calendar size={13} className="text-slate-400" />
            <span className="text-[11px] font-bold text-slate-500">{isAr ? 'من:' : 'From:'}</span>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="bg-transparent text-xs font-bold text-slate-800 outline-none"
            />
          </div>
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
            <Calendar size={13} className="text-slate-400" />
            <span className="text-[11px] font-bold text-slate-500">{isAr ? 'إلى:' : 'To:'}</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="bg-transparent text-xs font-bold text-slate-800 outline-none"
            />
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1 flex-wrap">
            <button
              type="button"
              onClick={() => setPreset('this_month')}
              className="px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all"
            >
              {isAr ? 'هذا الشهر' : 'This Month'}
            </button>
            <button
              type="button"
              onClick={() => setPreset('this_quarter')}
              className="px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all"
            >
              {isAr ? 'هذا الربع' : 'This Quarter'}
            </button>
            <button
              type="button"
              onClick={() => setPreset('this_year')}
              className="px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all"
            >
              {isAr ? 'هذا العام' : 'This Year'}
            </button>
            <button
              type="button"
              onClick={() => setPreset('last_year')}
              className="px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all"
            >
              {isAr ? 'العام السابق' : 'Last Year'}
            </button>
          </div>
        </div>

        {/* View Mode (Single vs Multi-period Comparison) */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-400 hidden lg:inline">{isAr ? 'المقارنة الزمنية:' : 'Comparison:'}</span>
          <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 shadow-inner">
            <button
              type="button"
              onClick={() => setViewMode('single')}
              className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'single' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {isAr ? 'فترة واحدة' : 'Single'}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('monthly')}
              className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'monthly' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {isAr ? 'شهري' : 'Monthly'}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('quarterly')}
              className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'quarterly' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {isAr ? 'ربع سنوي' : 'Quarterly'}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('yearly')}
              className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'yearly' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {isAr ? 'سنوي' : 'Yearly'}
            </button>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 no-print">
        {/* Operating Cash Flow */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>{isAr ? 'التدفق التشغيلي' : 'Operating Cash Flow'}</span>
            <div className={`p-1.5 rounded-lg ${totalData.operating.netCashOperating >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              {totalData.operating.netCashOperating >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
            </div>
          </div>
          <div className={`text-base sm:text-lg font-black font-mono tracking-tight ${totalData.operating.netCashOperating >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
            {formatNumber(totalData.operating.netCashOperating)} <span className="text-[10px] font-sans text-slate-400">{currency}</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium">
            {isAr ? 'صافي حركة النقدية من النشاط التشغيلي' : 'Net cash from operational cycle'}
          </p>
        </div>

        {/* Investing Cash Flow */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>{isAr ? 'التدفق الاستثماري' : 'Investing Cash Flow'}</span>
            <div className={`p-1.5 rounded-lg ${totalData.investing.netCashInvesting >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
              <Landmark size={15} />
            </div>
          </div>
          <div className={`text-base sm:text-lg font-black font-mono tracking-tight ${totalData.investing.netCashInvesting < 0 ? 'text-slate-800' : 'text-emerald-700'}`}>
            {formatNumber(totalData.investing.netCashInvesting)} <span className="text-[10px] font-sans text-slate-400">{currency}</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium">
            {isAr ? 'الاستثمار في الأصول الثابتة والمعدات' : 'Fixed assets additions & disposals'}
          </p>
        </div>

        {/* Financing Cash Flow */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>{isAr ? 'التدفق التمويلي' : 'Financing Cash Flow'}</span>
            <div className={`p-1.5 rounded-lg ${totalData.financing.netCashFinancing >= 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-700'}`}>
              <Coins size={15} />
            </div>
          </div>
          <div className="text-base sm:text-lg font-black font-mono tracking-tight text-slate-900">
            {formatNumber(totalData.financing.netCashFinancing)} <span className="text-[10px] font-sans text-slate-400">{currency}</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium">
            {isAr ? 'رأس المال، القروض والمسحوبات' : 'Capital, loans and dividends'}
          </p>
        </div>

        {/* Net Cash Change */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>{isAr ? 'صافي التغير بالسيولة' : 'Net Cash Change'}</span>
            <div className={`p-1.5 rounded-lg ${totalData.netActualCashChange >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              <Scale size={15} />
            </div>
          </div>
          <div className={`text-base sm:text-lg font-black font-mono tracking-tight ${totalData.netActualCashChange >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
            {formatNumber(totalData.netActualCashChange)} <span className="text-[10px] font-sans text-slate-400">{currency}</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium">
            {isAr ? 'التغير الفعلي خلال الفترة' : 'Actual movement in cash'}
          </p>
        </div>

        {/* Ending Cash Balance */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>{isAr ? 'رصيد النقدية آخر الفترة' : 'Ending Cash Balance'}</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700">
              <Wallet size={15} />
            </div>
          </div>
          <div className="text-base sm:text-lg font-black font-mono tracking-tight text-indigo-700">
            {formatNumber(totalData.endingCash)} <span className="text-[10px] font-sans text-slate-400">{currency}</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium">
            {isAr ? 'إجمالي الخزائن والحسابات البنكية' : 'Cash & banks at end date'}
          </p>
        </div>
      </div>

      {/* Main Report Printable Content */}
      <div 
        ref={reportRef}
        className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden p-4 sm:p-6"
      >
        {/* Printable Letterhead */}
        <div className="hidden print:block pb-4 mb-4 border-b border-slate-200 text-center">
          <h1 className="text-xl font-black text-slate-900">{company?.name || 'ERP System'}</h1>
          <h2 className="text-base font-bold text-slate-700 mt-1">
            {isAr ? 'قائمة التدفقات النقدية (IAS 7 / EAS 4)' : 'Statement of Cash Flows (IAS 7 / EAS 4)'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {isAr ? `عن الفترة من ${dateRange.start} إلى ${dateRange.end}` : `For the period from ${dateRange.start} to ${dateRange.end}`}
          </p>
        </div>

        {/* Section 1: Operating Activities */}
        <div className="space-y-3 mb-6">
          <div className="bg-slate-100/90 px-3.5 py-2 rounded-xl flex items-center justify-between border border-slate-200/80">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              <h3 className="text-xs sm:text-sm font-black text-slate-800">
                {isAr ? 'أولاً: التدفقات النقدية من الأنشطة التشغيلية' : '1. Cash Flows from Operating Activities'}
              </h3>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-white text-slate-600 border border-slate-200">
                {methodType === 'indirect' ? (isAr ? 'الطريقة غير المباشرة' : 'Indirect') : (isAr ? 'الطريقة المباشرة' : 'Direct')}
              </span>
            </div>
            <div className="text-xs font-black font-mono text-emerald-800">
              {formatNumber(methodType === 'indirect' ? totalData.operating.netCashOperating : totalData.directOperating.netCashOperating)} {currency}
            </div>
          </div>

          <table className="w-full text-right border-collapse text-xs">
            <tbody className="divide-y divide-slate-100">
              {methodType === 'indirect' ? (
                <>
                  {/* Net Profit */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-slate-800 flex items-center justify-between">
                      <span>{isAr ? 'صافي ربح / (خسارة) الفترة' : 'Net Profit / (Loss) for the period'}</span>
                      <span className="text-[10px] text-slate-400 font-normal">({isAr ? 'من قائمة الدخل' : 'from Income Statement'})</span>
                    </td>
                    <td className={`py-2.5 px-3 text-left font-mono font-bold ${totalData.operating.netProfit >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                      {formatNumber(totalData.operating.netProfit)}
                    </td>
                  </tr>

                  {/* Non-cash adjustments header */}
                  <tr className="bg-slate-50/50">
                    <td colSpan={2} className="py-1.5 px-3 text-[11px] font-bold text-indigo-700">
                      {isAr ? 'تسويات البنود غير النقدية:' : 'Adjustments for Non-Cash Items:'}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2 px-3 text-slate-700 pr-6">
                      {isAr ? '(+) إهلاك الأصول الثابتة والمعدات' : '(+) Depreciation & Amortization'}
                    </td>
                    <td className="py-2 px-3 text-left font-mono font-medium text-slate-800">
                      {formatNumber(totalData.operating.adjustments.depreciation)}
                    </td>
                  </tr>
                  {totalData.operating.adjustments.provisions > 0 && (
                    <tr className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2 px-3 text-slate-700 pr-6">
                        {isAr ? '(+) مخصصات وخسائر اضمحلال' : '(+) Provisions & Impairment Losses'}
                      </td>
                      <td className="py-2 px-3 text-left font-mono font-medium text-slate-800">
                        {formatNumber(totalData.operating.adjustments.provisions)}
                      </td>
                    </tr>
                  )}
                  <tr className="bg-slate-50/80 font-bold border-t border-slate-200">
                    <td className="py-2 px-3 text-slate-800">
                      {isAr ? 'أرباح التشغيل قبل التغيرات في رأس المال العامل' : 'Operating Profit before Working Capital Changes'}
                    </td>
                    <td className="py-2 px-3 text-left font-mono font-bold text-slate-900">
                      {formatNumber(totalData.operating.operatingProfitBeforeWC)}
                    </td>
                  </tr>

                  {/* Working capital changes header */}
                  <tr className="bg-slate-50/50">
                    <td colSpan={2} className="py-1.5 px-3 text-[11px] font-bold text-indigo-700">
                      {isAr ? 'التغيرات في رأس المال العامل:' : 'Working Capital Changes:'}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2 px-3 text-slate-700 pr-6">
                      {isAr ? '(الزيادة) / النقص في حسابات العملاء والمدينين' : 'Decrease / (Increase) in Accounts Receivable'}
                    </td>
                    <td className={`py-2 px-3 text-left font-mono font-medium ${totalData.operating.workingCapital.receivablesChange >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {formatNumber(totalData.operating.workingCapital.receivablesChange)}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2 px-3 text-slate-700 pr-6">
                      {isAr ? '(الزيادة) / النقص في المخزون السلعي' : 'Decrease / (Increase) in Inventory'}
                    </td>
                    <td className={`py-2 px-3 text-left font-mono font-medium ${totalData.operating.workingCapital.inventoryChange >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {formatNumber(totalData.operating.workingCapital.inventoryChange)}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2 px-3 text-slate-700 pr-6">
                      {isAr ? 'الزيادة / (النقص) في حسابات الموردين والدائنين' : 'Increase / (Decrease) in Accounts Payable'}
                    </td>
                    <td className={`py-2 px-3 text-left font-mono font-medium ${totalData.operating.workingCapital.payablesChange >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {formatNumber(totalData.operating.workingCapital.payablesChange)}
                    </td>
                  </tr>
                  {Math.abs(totalData.operating.workingCapital.otherWCChange) > 0.01 && (
                    <tr className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2 px-3 text-slate-700 pr-6">
                        {isAr ? 'التغير في الأرصدة المدينة والدائنة التشغيلية الأخرى' : 'Other Working Capital Adjustments'}
                      </td>
                      <td className={`py-2 px-3 text-left font-mono font-medium ${totalData.operating.workingCapital.otherWCChange >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {formatNumber(totalData.operating.workingCapital.otherWCChange)}
                      </td>
                    </tr>
                  )}
                  <tr className="bg-emerald-50/80 font-black border-t-2 border-emerald-200">
                    <td className="py-2.5 px-3 text-emerald-900">
                      {isAr ? 'صافي التدفق النقدي من الأنشطة التشغيلية' : 'Net Cash Flow from Operating Activities'}
                    </td>
                    <td className={`py-2.5 px-3 text-left font-mono font-black ${totalData.operating.netCashOperating >= 0 ? 'text-emerald-800' : 'text-rose-700'}`}>
                      {formatNumber(totalData.operating.netCashOperating)} {currency}
                    </td>
                  </tr>
                </>
              ) : (
                /* Direct Method */
                <>
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2 px-3 text-slate-800 font-bold">
                      {isAr ? 'المقبوضات النقدية من العملاء والمبيعات' : 'Cash receipts from customers'}
                    </td>
                    <td className="py-2 px-3 text-left font-mono font-bold text-emerald-700">
                      {formatNumber(totalData.directOperating.cashFromCustomers)}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2 px-3 text-slate-800 font-bold">
                      {isAr ? 'المدفوعات النقدية للموردين والمشتريات' : 'Cash payments to suppliers'}
                    </td>
                    <td className="py-2 px-3 text-left font-mono font-bold text-rose-600">
                      {formatNumber(totalData.directOperating.cashPaidToSuppliers)}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2 px-3 text-slate-800 font-bold">
                      {isAr ? 'المدفوعات النقدية للأجور والمرتبات' : 'Cash payments to employees'}
                    </td>
                    <td className="py-2 px-3 text-left font-mono font-bold text-rose-600">
                      {formatNumber(totalData.directOperating.cashPaidToEmployees)}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2 px-3 text-slate-800 font-bold">
                      {isAr ? 'المدفوعات النقدية للمصروفات التشغيلية الأخرى' : 'Cash payments for operating expenses'}
                    </td>
                    <td className="py-2 px-3 text-left font-mono font-bold text-rose-600">
                      {formatNumber(totalData.directOperating.cashPaidForExpenses)}
                    </td>
                  </tr>
                  <tr className="bg-emerald-50/80 font-black border-t-2 border-emerald-200">
                    <td className="py-2.5 px-3 text-emerald-900">
                      {isAr ? 'صافي التدفق النقدي من الأنشطة التشغيلية (الطريقة المباشرة)' : 'Net Cash from Operating Activities (Direct)'}
                    </td>
                    <td className="py-2.5 px-3 text-left font-mono font-black text-emerald-800">
                      {formatNumber(totalData.directOperating.netCashOperating)} {currency}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Section 2: Investing Activities */}
        <div className="space-y-3 mb-6">
          <div className="bg-slate-100/90 px-3.5 py-2 rounded-xl flex items-center justify-between border border-slate-200/80">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              <h3 className="text-xs sm:text-sm font-black text-slate-800">
                {isAr ? 'ثانياً: التدفقات النقدية من الأنشطة الاستثمارية' : '2. Cash Flows from Investing Activities'}
              </h3>
            </div>
            <div className={`text-xs font-black font-mono ${totalData.investing.netCashInvesting >= 0 ? 'text-emerald-800' : 'text-slate-800'}`}>
              {formatNumber(totalData.investing.netCashInvesting)} {currency}
            </div>
          </div>

          <table className="w-full text-right border-collapse text-xs">
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50/60 transition-colors">
                <td className="py-2 px-3 text-slate-700">
                  {isAr ? 'المدفوعات النقدية لشراء أصول ثابتة ومعدات' : 'Cash paid to purchase fixed assets & equipment'}
                </td>
                <td className="py-2 px-3 text-left font-mono font-medium text-slate-900">
                  {formatNumber(totalData.investing.purchaseOfFixedAssets)}
                </td>
              </tr>
              <tr className="hover:bg-slate-50/60 transition-colors">
                <td className="py-2 px-3 text-slate-700">
                  {isAr ? 'المتحصلات النقدية من بيع أصول ثابتة' : 'Cash proceeds from sale of fixed assets'}
                </td>
                <td className="py-2 px-3 text-left font-mono font-medium text-slate-900">
                  {formatNumber(totalData.investing.proceedsFromSaleOfAssets)}
                </td>
              </tr>
              <tr className="bg-blue-50/80 font-black border-t-2 border-blue-200">
                <td className="py-2.5 px-3 text-blue-900">
                  {isAr ? 'صافي التدفق النقدي من الأنشطة الاستثمارية' : 'Net Cash Flow from Investing Activities'}
                </td>
                <td className="py-2.5 px-3 text-left font-mono font-black text-blue-900">
                  {formatNumber(totalData.investing.netCashInvesting)} {currency}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 3: Financing Activities */}
        <div className="space-y-3 mb-6">
          <div className="bg-slate-100/90 px-3.5 py-2 rounded-xl flex items-center justify-between border border-slate-200/80">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-purple-600" />
              <h3 className="text-xs sm:text-sm font-black text-slate-800">
                {isAr ? 'ثالثاً: التدفقات النقدية من الأنشطة التمويلية' : '3. Cash Flows from Financing Activities'}
              </h3>
            </div>
            <div className={`text-xs font-black font-mono ${totalData.financing.netCashFinancing >= 0 ? 'text-emerald-800' : 'text-slate-800'}`}>
              {formatNumber(totalData.financing.netCashFinancing)} {currency}
            </div>
          </div>

          <table className="w-full text-right border-collapse text-xs">
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50/60 transition-colors">
                <td className="py-2 px-3 text-slate-700">
                  {isAr ? 'المتحصلات من زيادة رأس المال ومساهمات الشركاء' : 'Proceeds from capital increase / contributions'}
                </td>
                <td className="py-2 px-3 text-left font-mono font-medium text-slate-900">
                  {formatNumber(totalData.financing.capitalContributions)}
                </td>
              </tr>
              <tr className="hover:bg-slate-50/60 transition-colors">
                <td className="py-2 px-3 text-slate-700">
                  {isAr ? 'صافي حركة القروض والتسهيلات الائتمانية البنكية' : 'Net movement in bank loans & borrowings'}
                </td>
                <td className="py-2 px-3 text-left font-mono font-medium text-slate-900">
                  {formatNumber(totalData.financing.loansNetChange)}
                </td>
              </tr>
              <tr className="hover:bg-slate-50/60 transition-colors">
                <td className="py-2 px-3 text-slate-700">
                  {isAr ? 'توزيعات الأرباح والمسحوبات الشخصية للشركاء' : 'Dividends & drawings paid to partners'}
                </td>
                <td className="py-2 px-3 text-left font-mono font-medium text-slate-900">
                  {formatNumber(totalData.financing.dividendsAndDrawingsPaid)}
                </td>
              </tr>
              <tr className="bg-purple-50/80 font-black border-t-2 border-purple-200">
                <td className="py-2.5 px-3 text-purple-900">
                  {isAr ? 'صافي التدفق النقدي من الأنشطة التمويلية' : 'Net Cash Flow from Financing Activities'}
                </td>
                <td className="py-2.5 px-3 text-left font-mono font-black text-purple-900">
                  {formatNumber(totalData.financing.netCashFinancing)} {currency}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 4: Summary & Reconciliation of Cash */}
        <div className="space-y-3 pt-2 border-t-2 border-slate-300">
          <div className="bg-slate-900 text-white px-3.5 py-2.5 rounded-xl flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-black">
              {isAr ? 'رابعاً: خلاصة ومطابقة حركة النقدية وما في حكمها' : '4. Summary & Cash Equivalents Reconciliation'}
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
              IAS 7.45 Reconciliation
            </span>
          </div>

          <table className="w-full text-right border-collapse text-xs">
            <tbody className="divide-y divide-slate-100">
              <tr className="bg-slate-50/80 font-bold">
                <td className="py-2.5 px-3 text-slate-900">
                  {isAr ? 'صافي التغير في النقدية وما في حكمها خلال الفترة' : 'Net increase / (decrease) in cash and cash equivalents'}
                </td>
                <td className={`py-2.5 px-3 text-left font-mono font-black text-sm ${totalData.netActualCashChange >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {formatNumber(totalData.netActualCashChange)} {currency}
                </td>
              </tr>
              <tr className="hover:bg-slate-50/60 transition-colors">
                <td className="py-2 px-3 text-slate-700">
                  {isAr ? '(+) رصيد النقدية وما في حكمها في بداية الفترة' : '(+) Cash and cash equivalents at beginning of period'}
                </td>
                <td className="py-2 px-3 text-left font-mono font-bold text-slate-800">
                  {formatNumber(totalData.beginningCash)} {currency}
                </td>
              </tr>
              <tr className="bg-indigo-50 font-black border-t-2 border-indigo-200">
                <td className="py-3 px-3 text-indigo-950 text-xs sm:text-sm">
                  {isAr ? '(=) رصيد النقدية وما في حكمها في نهاية الفترة' : '(=) Cash and cash equivalents at end of period'}
                </td>
                <td className="py-3 px-3 text-left font-mono font-black text-indigo-950 text-sm sm:text-base">
                  {formatNumber(totalData.endingCash)} {currency}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Detailed Cash & Banks Accounts Breakdown Table */}
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                <Wallet size={14} className="text-indigo-600" />
                <span>{isAr ? 'تفاصيل مطابقة حسابات النقدية والبنوك الفردية:' : 'Individual Cash & Bank Accounts Reconciliation:'}</span>
              </h4>
              <span className="text-[10px] text-slate-400 font-bold">
                {totalData.cashBreakdown.length} {isAr ? 'حساب' : 'accounts'}
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-right border-collapse text-xs">
                <thead className="bg-slate-50 text-slate-600 text-[10px] font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">{isAr ? 'كود الحساب' : 'Code'}</th>
                    <th className="py-2 px-3">{isAr ? 'اسم الحساب' : 'Account Name'}</th>
                    <th className="py-2 px-3">{isAr ? 'العملة' : 'Currency'}</th>
                    <th className="py-2 px-3 text-left">{isAr ? 'رصيد أول المدة' : 'Beginning'}</th>
                    <th className="py-2 px-3 text-left">{isAr ? 'حركة الفترة' : 'Movement'}</th>
                    <th className="py-2 px-3 text-left">{isAr ? 'رصيد آخر المدة' : 'Ending'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {totalData.cashBreakdown.map((acc) => (
                    <tr 
                      key={acc.id}
                      onClick={() => navigateToLedger(acc.id)}
                      className="hover:bg-indigo-50/40 cursor-pointer transition-colors"
                      title={isAr ? 'اضغط لعرض كشف حساب الأستاذ' : 'Click to view general ledger'}
                    >
                      <td className="py-2 px-3 text-slate-500 font-medium">{acc.code}</td>
                      <td className="py-2 px-3 font-sans font-bold text-slate-900">{acc.name}</td>
                      <td className="py-2 px-3 font-sans">
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-bold">
                          {acc.currency}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-left text-slate-700">{formatNumber(acc.openingBalance)}</td>
                      <td className={`py-2 px-3 text-left font-bold ${acc.netMovement >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {acc.netMovement > 0 ? `+${formatNumber(acc.netMovement)}` : formatNumber(acc.netMovement)}
                      </td>
                      <td className="py-2 px-3 text-left font-black text-indigo-700">{formatNumber(acc.closingBalance)}</td>
                    </tr>
                  ))}
                  {totalData.cashBreakdown.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400 italic font-sans text-xs">
                        {isAr ? 'لا توجد حسابات نقدية أو بنكية مسجلة' : 'No cash or bank accounts found.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CashFlowStatement;
