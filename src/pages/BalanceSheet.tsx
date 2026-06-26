import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dbService } from '../services/dbService';
import { JournalEntry, Account, AccountType } from '../types';
import { Search, Calendar, FileText, Download, Printer, Filter, PieChart, ArrowLeftRight, Shield, CreditCard, Wallet, CheckCircle2, AlertTriangle, RefreshCcw, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { exportToPDF } from '../utils/pdfUtils';
import { exportToExcel } from '../utils/excelUtils';
import { AccountingEngine } from '../services/AccountingEngine';
import { formatNumber } from '../utils/formatUtils';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigation } from '../contexts/NavigationContext';

export const BalanceSheet: React.FC = () => {
  const { user } = useAuth();
  const { t, dir } = useLanguage();
  const { setCurrentPage, setPendingLedgerParams } = useNavigation();
  const reportRef = useRef<HTMLDivElement>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [viewMode, setViewMode] = useState<'single' | 'monthly' | 'quarterly' | 'yearly'>('single');

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

  const subPeriods = AccountingEngine.getSubPeriods(dateRange.start, dateRange.end, viewMode);
  const periodResults = subPeriods.map(period => {
    return {
      period,
      data: AccountingEngine.calculateBalanceSheet(
        accounts,
        accountTypes,
        entries,
        period.end
      )
    };
  });

  const totalData = AccountingEngine.calculateBalanceSheet(
    accounts,
    accountTypes,
    entries,
    dateRange.end
  );

  const handleExportPDF = async () => {
    if (reportRef.current) {
      await exportToPDF(reportRef.current, { 
        filename: 'Balance_Sheet', 
        orientation: viewMode === 'single' ? 'portrait' : 'landscape',
        reportTitle: `${t('balance_sheet.title')} - ${dateRange.end}`
      });
    }
  };

  const handleExportExcel = () => {
    if (viewMode === 'single') {
      const rows: any[] = [];
      
      rows.push({
        [dir === 'rtl' ? 'التصنيف' : 'Classification']: dir === 'rtl' ? 'الأصول' : 'Assets',
        [dir === 'rtl' ? 'الحساب' : 'Account']: '',
        [dir === 'rtl' ? 'الرصيد' : 'Balance']: ''
      });
      totalData.assets.forEach(a => {
        rows.push({
          [dir === 'rtl' ? 'التصنيف' : 'Classification']: '',
          [dir === 'rtl' ? 'الحساب' : 'Account']: a.name,
          [dir === 'rtl' ? 'الرصيد' : 'Balance']: a.balance
        });
      });
      rows.push({
        [dir === 'rtl' ? 'التصنيف' : 'Classification']: dir === 'rtl' ? 'إجمالي الأصول' : 'Total Assets',
        [dir === 'rtl' ? 'الحساب' : 'Account']: '',
        [dir === 'rtl' ? 'الرصيد' : 'Balance']: totalData.totalAssets
      });
      rows.push({});

      rows.push({
        [dir === 'rtl' ? 'التصنيف' : 'Classification']: dir === 'rtl' ? 'الالتزامات' : 'Liabilities',
        [dir === 'rtl' ? 'الحساب' : 'Account']: '',
        [dir === 'rtl' ? 'الرصيد' : 'Balance']: ''
      });
      totalData.liabilities.forEach(l => {
        rows.push({
          [dir === 'rtl' ? 'التصنيف' : 'Classification']: '',
          [dir === 'rtl' ? 'الحساب' : 'Account']: l.name,
          [dir === 'rtl' ? 'الرصيد' : 'Balance']: Math.abs(l.balance)
        });
      });
      rows.push({
        [dir === 'rtl' ? 'التصنيف' : 'Classification']: dir === 'rtl' ? 'إجمالي الالتزامات' : 'Total Liabilities',
        [dir === 'rtl' ? 'الحساب' : 'Account']: '',
        [dir === 'rtl' ? 'الرصيد' : 'Balance']: totalData.totalLiabilities
      });
      rows.push({});

      rows.push({
        [dir === 'rtl' ? 'التصنيف' : 'Classification']: dir === 'rtl' ? 'حقوق الملكية' : 'Equity',
        [dir === 'rtl' ? 'الحساب' : 'Account']: '',
        [dir === 'rtl' ? 'الرصيد' : 'Balance']: ''
      });
      totalData.equity.forEach(e => {
        rows.push({
          [dir === 'rtl' ? 'التصنيف' : 'Classification']: '',
          [dir === 'rtl' ? 'الحساب' : 'Account']: e.name,
          [dir === 'rtl' ? 'الرصيد' : 'Balance']: Math.abs(e.balance)
        });
      });
      rows.push({
        [dir === 'rtl' ? 'التصنيف' : 'Classification']: '',
        [dir === 'rtl' ? 'الحساب' : 'Account']: t('balance_sheet.net_profit_period'),
        [dir === 'rtl' ? 'الرصيد' : 'Balance']: totalData.netProfit
      });
      rows.push({
        [dir === 'rtl' ? 'التصنيف' : 'Classification']: dir === 'rtl' ? 'إجمالي حقوق الملكية' : 'Total Equity',
        [dir === 'rtl' ? 'الحساب' : 'Account']: '',
        [dir === 'rtl' ? 'الرصيد' : 'Balance']: totalData.totalEquity
      });
      rows.push({});

      rows.push({
        [dir === 'rtl' ? 'التصنيف' : 'Classification']: dir === 'rtl' ? 'إجمالي الالتزامات وحقوق الملكية' : 'Total Liabilities & Equity',
        [dir === 'rtl' ? 'الحساب' : 'Account']: '',
        [dir === 'rtl' ? 'الرصيد' : 'Balance']: totalData.totalLiabilitiesEquity
      });

      rows.push({
        [dir === 'rtl' ? 'التصنيف' : 'Classification']: dir === 'rtl' ? 'فارق التوازن' : 'Difference',
        [dir === 'rtl' ? 'الحساب' : 'Account']: '',
        [dir === 'rtl' ? 'الرصيد' : 'Balance']: totalData.diagnostics.difference
      });

      exportToExcel(rows, { filename: 'Balance_Sheet' });
    } else {
      const rows: any[] = [];
      const addSection = (title: string, items: any[], typeLabel: string) => {
        rows.push({
          [dir === 'rtl' ? 'الكود' : 'Code']: '',
          [dir === 'rtl' ? 'الحساب' : 'Account']: title,
          ...subPeriods.reduce((acc, p) => ({ ...acc, [dir === 'rtl' ? p.labelAr : p.labelEn]: '' }), {}),
          [dir === 'rtl' ? 'رصيد النهاية' : 'Final Balance']: ''
        });

        items.forEach(item => {
          const row: any = {
            [dir === 'rtl' ? 'الكود' : 'Code']: accounts.find(a => a.id === item.id)?.code || '',
            [dir === 'rtl' ? 'الحساب' : 'Account']: item.name,
          };
          subPeriods.forEach((p, idx) => {
            const pRes = periodResults[idx].data;
            let val = 0;
            if (typeLabel === 'asset') {
              val = pRes.assets.find(a => a.id === item.id)?.balance || 0;
            } else if (typeLabel === 'liability') {
              val = Math.abs(pRes.liabilities.find(l => l.id === item.id)?.balance || 0);
            } else if (typeLabel === 'equity') {
              val = Math.abs(pRes.equity.find(e => e.id === item.id)?.balance || 0);
            }
            row[dir === 'rtl' ? p.labelAr : p.labelEn] = val;
          });
          row[dir === 'rtl' ? 'رصيد النهاية' : 'Final Balance'] = typeLabel === 'asset' ? item.balance : Math.abs(item.balance);
          rows.push(row);
        });

        if (typeLabel === 'equity') {
          const npRow: any = {
            [dir === 'rtl' ? 'الكود' : 'Code']: '',
            [dir === 'rtl' ? 'الحساب' : 'Account']: t('balance_sheet.net_profit_period'),
          };
          subPeriods.forEach((p, idx) => {
            npRow[dir === 'rtl' ? p.labelAr : p.labelEn] = periodResults[idx].data.netProfit;
          });
          npRow[dir === 'rtl' ? 'رصيد النهاية' : 'Final Balance'] = totalData.netProfit;
          rows.push(npRow);
        }

        const summaryRow: any = {
          [dir === 'rtl' ? 'الكود' : 'Code']: '',
          [dir === 'rtl' ? 'الحساب' : 'Account']: dir === 'rtl' ? `إجمالي ${title}` : `Total ${title}`,
        };
        subPeriods.forEach((p, idx) => {
          const pRes = periodResults[idx].data;
          let val = 0;
          if (typeLabel === 'asset') val = pRes.totalAssets;
          else if (typeLabel === 'liability') val = pRes.totalLiabilities;
          else if (typeLabel === 'equity') val = pRes.totalEquity;
          summaryRow[dir === 'rtl' ? p.labelAr : p.labelEn] = val;
        });
        summaryRow[dir === 'rtl' ? 'رصيد النهاية' : 'Final Balance'] = typeLabel === 'asset' ? totalData.totalAssets : (typeLabel === 'liability' ? totalData.totalLiabilities : totalData.totalEquity);
        rows.push(summaryRow);
        rows.push({});
      };

      addSection(dir === 'rtl' ? 'الأصول' : 'Assets', totalData.assets, 'asset');
      addSection(dir === 'rtl' ? 'الالتزامات (الخصوم)' : 'Liabilities', totalData.liabilities, 'liability');
      addSection(dir === 'rtl' ? 'حقوق الملكية' : 'Equity', totalData.equity, 'equity');

      const totalLERow: any = {
        [dir === 'rtl' ? 'الكود' : 'Code']: '',
        [dir === 'rtl' ? 'الحساب' : 'Account']: dir === 'rtl' ? 'إجمالي الالتزامات وحقوق الملكية' : 'Total Liabilities & Equity',
      };
      subPeriods.forEach((p, idx) => {
        totalLERow[dir === 'rtl' ? p.labelAr : p.labelEn] = periodResults[idx].data.totalLiabilitiesEquity;
      });
      totalLERow[dir === 'rtl' ? 'رصيد النهاية' : 'Final Balance'] = totalData.totalLiabilitiesEquity;
      rows.push(totalLERow);

      const checkRow: any = {
        [dir === 'rtl' ? 'الكود' : 'Code']: '',
        [dir === 'rtl' ? 'الحساب' : 'Account']: dir === 'rtl' ? 'فارق التوازن' : 'Difference',
      };
      subPeriods.forEach((p, idx) => {
        checkRow[dir === 'rtl' ? p.labelAr : p.labelEn] = periodResults[idx].data.diagnostics.difference;
      });
      checkRow[dir === 'rtl' ? 'رصيد النهاية' : 'Final Balance'] = totalData.diagnostics.difference;
      rows.push(checkRow);

      exportToExcel(rows, { filename: 'Comparative_Balance_Sheet' });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-zinc-500 font-medium italic animate-pulse">{dir === 'rtl' ? 'جاري تحميل الميزانية العمومية...' : 'Loading balance sheet...'}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 p-8 bg-emerald-50 rounded-3xl border border-emerald-100 italic text-center">
        <p className="text-emerald-600 font-bold">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
        >
          {dir === 'rtl' ? 'إعادة المحاولة' : 'Retry'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-zinc-900">{t('balance_sheet.title')}</h2>
          <p className="text-zinc-500 font-medium mt-1">{t('balance_sheet.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleRefresh}
            className="p-3 bg-white border border-zinc-200 text-zinc-600 rounded-2xl hover:bg-zinc-50 hover:text-emerald-600 transition-all hover:scale-105 active:scale-95 shadow-sm"
            title={t('reports.update_data')}
          >
            <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={handleExportExcel} className="p-2.5 bg-white border border-zinc-200 text-zinc-600 rounded-xl hover:bg-zinc-50 transition-all shadow-sm" title={dir === 'rtl' ? 'تصدير إكسل' : 'Export Excel'}><Download size={20} /></button>
          <button onClick={handleExportPDF} className="p-2.5 bg-white border border-zinc-200 text-zinc-600 rounded-xl hover:bg-zinc-50 transition-all shadow-sm" title={dir === 'rtl' ? 'تصدير PDF / طباعة' : 'Export PDF / Print'}><Printer size={20} /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <Calendar className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={20} />
          <input
            type="date"
            className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium`}
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
          />
        </div>
        <div className="relative">
          <Calendar className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={20} />
          <input
            type="date"
            className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium`}
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
          />
        </div>
      </div>

      {/* Controls Row */}
      <div className="flex flex-col xl:flex-row gap-4 items-stretch xl:items-center justify-between">
        {/* Date presets */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setPreset('this_month')}
            className="px-4 py-2 text-sm bg-white border border-zinc-200 text-zinc-700 font-bold rounded-2xl hover:bg-emerald-50 hover:text-emerald-700 transition-all shadow-sm"
          >
            {dir === 'rtl' ? 'الشهر الحالي' : 'This Month'}
          </button>
          <button
            onClick={() => setPreset('this_quarter')}
            className="px-4 py-2 text-sm bg-white border border-zinc-200 text-zinc-700 font-bold rounded-2xl hover:bg-emerald-50 hover:text-emerald-700 transition-all shadow-sm"
          >
            {dir === 'rtl' ? 'الربع الحالي' : 'This Quarter'}
          </button>
          <button
            onClick={() => setPreset('this_year')}
            className="px-4 py-2 text-sm bg-white border border-zinc-200 text-zinc-700 font-bold rounded-2xl hover:bg-emerald-50 hover:text-emerald-700 transition-all shadow-sm"
          >
            {dir === 'rtl' ? 'السنة الحالية' : 'This Year'}
          </button>
          <button
            onClick={() => setPreset('last_year')}
            className="px-4 py-2 text-sm bg-white border border-zinc-200 text-zinc-700 font-bold rounded-2xl hover:bg-emerald-50 hover:text-emerald-700 transition-all shadow-sm"
          >
            {dir === 'rtl' ? 'السنة السابقة' : 'Last Year'}
          </button>
        </div>

        {/* View Mode selection */}
        <div className="bg-zinc-100 p-1.5 rounded-2xl flex flex-wrap items-center gap-1 self-start">
          <button
            onClick={() => setViewMode('single')}
            className={`px-4 py-2 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${
              viewMode === 'single' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <FileText size={16} />
            {dir === 'rtl' ? 'فترة واحدة' : 'Single Period'}
          </button>
          <button
            onClick={() => setViewMode('monthly')}
            className={`px-4 py-2 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${
              viewMode === 'monthly' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Calendar size={16} />
            {dir === 'rtl' ? 'شهري' : 'Monthly'}
          </button>
          <button
            onClick={() => setViewMode('quarterly')}
            className={`px-4 py-2 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${
              viewMode === 'quarterly' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <PieChart size={16} />
            {dir === 'rtl' ? 'ربع سنوي' : 'Quarterly'}
          </button>
          <button
            onClick={() => setViewMode('yearly')}
            className={`px-4 py-2 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${
              viewMode === 'yearly' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <TrendingUp size={16} />
            {dir === 'rtl' ? 'سنوي' : 'Yearly'}
          </button>
        </div>
      </div>

      <div ref={reportRef} className="space-y-6">
        {viewMode === 'single' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="bg-white border border-zinc-200 rounded-[2.5rem] overflow-hidden shadow-sm h-full">
                <div className={`px-8 py-6 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                  <h3 className={`font-black text-emerald-700 flex items-center gap-3 text-lg ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                    <Wallet size={24} />
                    {t('balance_sheet.assets')}
                  </h3>
                  <span className="text-2xl font-black text-emerald-600">{formatNumber(totalData.totalAssets)}</span>
                </div>
                <div className="p-4 space-y-2">
                  {totalData.assets.map(a => (
                    <div key={a.id} className={`flex items-center justify-between p-4 hover:bg-emerald-50/30 rounded-2xl transition-all border border-transparent hover:border-emerald-100 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                      <span 
                        onClick={() => {
                          setPendingLedgerParams({
                            accountId: a.id,
                            startDate: '1900-01-01',
                            endDate: dateRange.end
                          });
                          setCurrentPage('general_ledger_report');
                        }}
                        className="font-bold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
                      >
                        {a.name}
                      </span>
                      <span className="font-black text-zinc-900">{formatNumber(a.balance)}</span>
                    </div>
                  ))}
                  {totalData.assets.length === 0 && (
                    <p className="p-12 text-center text-zinc-400 font-medium italic">{t('balance_sheet.no_assets')}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div className="bg-white border border-zinc-200 rounded-[2.5rem] overflow-hidden shadow-sm">
                <div className={`px-8 py-6 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                  <h3 className={`font-black text-emerald-700 flex items-center gap-3 text-lg ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                    <CreditCard size={24} />
                    {dir === 'rtl' ? 'الالتزامات (الخصوم)' : 'Liabilities'}
                  </h3>
                  <span className="text-2xl font-black text-emerald-600">{formatNumber(totalData.totalLiabilities)}</span>
                </div>
                <div className="p-4 space-y-2">
                  {totalData.liabilities.map(a => (
                    <div key={a.id} className={`flex items-center justify-between p-4 hover:bg-emerald-50/30 rounded-2xl transition-all border border-transparent hover:border-emerald-100 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                      <span 
                        onClick={() => {
                          setPendingLedgerParams({
                            accountId: a.id,
                            startDate: '1900-01-01',
                            endDate: dateRange.end
                          });
                          setCurrentPage('general_ledger_report');
                        }}
                        className="font-bold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
                      >
                        {a.name}
                      </span>
                      <span className="font-black text-zinc-900">{formatNumber(Math.abs(a.balance))}</span>
                    </div>
                  ))}
                  {totalData.liabilities.length === 0 && (
                    <p className="p-8 text-center text-zinc-400 font-medium italic">{dir === 'rtl' ? 'لا توجد التزامات' : 'No liabilities'}</p>
                  )}
                </div>
              </div>

              <div className="bg-white border border-zinc-200 rounded-[2.5rem] overflow-hidden shadow-sm">
                <div className={`px-8 py-6 bg-blue-50 border-b border-blue-100 flex items-center justify-between ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                  <h3 className={`font-black text-blue-700 flex items-center gap-3 text-lg ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                    <PieChart size={24} />
                    {dir === 'rtl' ? 'حقوق الملكية' : 'Equity'}
                  </h3>
                  <span className="text-2xl font-black text-blue-600">{formatNumber(totalData.totalEquity)}</span>
                </div>
                <div className="p-4 space-y-2">
                  {totalData.equity.map(a => (
                    <div key={a.id} className={`flex items-center justify-between p-4 hover:bg-blue-50/30 rounded-2xl transition-all border border-transparent hover:border-blue-100 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                      <span 
                        onClick={() => {
                          setPendingLedgerParams({
                            accountId: a.id,
                            startDate: '1900-01-01',
                            endDate: dateRange.end
                          });
                          setCurrentPage('general_ledger_report');
                        }}
                        className="font-bold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
                      >
                        {a.name}
                      </span>
                      <span className="font-black text-zinc-900">{formatNumber(Math.abs(a.balance))}</span>
                    </div>
                  ))}
                  <div className={`flex items-center justify-between p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                    <span className="font-bold text-emerald-700">{t('balance_sheet.net_profit_period')}</span>
                    <span className="font-black text-emerald-600">{formatNumber(totalData.netProfit)}</span>
                  </div>
                </div>
              </div>

              <div className={`px-8 py-6 rounded-[2rem] flex items-center justify-between bg-zinc-900 text-white shadow-xl ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                <span className="font-black text-lg">{dir === 'rtl' ? 'إجمالي الالتزامات وحقوق الملكية' : 'Total Liabilities & Equity'}</span>
                <span className="text-2xl font-black">{formatNumber(totalData.totalLiabilitiesEquity)}</span>
              </div>

              <div className={`p-8 rounded-[2.5rem] border-2 flex items-center justify-between shadow-lg ${
                totalData.isBalanced 
                  ? 'bg-emerald-500 border-emerald-400 text-white shadow-emerald-500/20' 
                  : 'bg-rose-500 border-rose-400 text-white shadow-rose-500/20'
              }`}>
                <div className={`flex items-center gap-4 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse text-left'}`}>
                  <Shield size={32} />
                  <div>
                    <p className="font-black text-xl">{t('balance_sheet.check_title')}</p>
                    <p className="text-sm opacity-80 font-bold">
                      {totalData.isBalanced 
                        ? t('balance_sheet.balanced_msg') 
                        : `${t('balance_sheet.unbalanced_msg')} ${formatNumber(totalData.diagnostics.difference)}`}
                    </p>
                  </div>
                </div>
                <div className={`${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                  <p className="text-xs font-black uppercase tracking-widest opacity-60">{t('balance_sheet.difference')}</p>
                  <p className="text-2xl font-black">{formatNumber(totalData.diagnostics.difference)}</p>
                </div>
              </div>

              {!totalData.isBalanced && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-8 rounded-[2.5rem] bg-amber-50 border-2 border-amber-200 space-y-4 shadow-xl"
                >
                  <div className={`flex items-center gap-3 text-amber-800 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                    <Filter size={24} />
                    <h4 className="font-black text-lg font-mono tracking-tighter uppercase">{t('balance_sheet.diagnostics_title')}</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-white rounded-2xl border border-amber-100 shadow-sm">
                      <p className="text-xs font-bold text-zinc-500 mb-1 uppercase tracking-wider">{t('balance_sheet.total_debit_all')}</p>
                      <p className="text-xl font-black text-zinc-900">{formatNumber(totalData.diagnostics.globalDebit)}</p>
                    </div>
                    <div className="p-4 bg-white rounded-2xl border border-amber-100 shadow-sm">
                      <p className="text-xs font-bold text-zinc-500 mb-1 uppercase tracking-wider">{t('balance_sheet.total_credit_all')}</p>
                      <p className="text-xl font-black text-zinc-900">{formatNumber(totalData.diagnostics.globalCredit)}</p>
                    </div>
                  </div>

                  {totalData.diagnostics.unbalancedEntries.length > 0 && (
                    <div className="space-y-3 bg-white/50 p-4 rounded-2xl border border-amber-100">
                      <p className={`text-sm font-black text-emerald-600 flex items-center gap-2 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                        <ArrowLeftRight size={16} />
                        {t('balance_sheet.unbalanced_entries')}
                      </p>
                      <ul className={`list-none text-sm text-zinc-600 font-medium space-y-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                        {totalData.diagnostics.unbalancedEntries.map((e, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            {e}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {totalData.diagnostics.orphanedAccounts.length > 0 && (
                    <div className="space-y-3 bg-white/50 p-4 rounded-2xl border border-amber-100">
                      <p className={`text-sm font-black text-amber-700 flex items-center gap-2 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                        <AlertTriangle size={16} />
                        {dir === 'rtl' ? 'حسابات غير مصنفة (يتيمة)' : 'Orphaned Accounts'}
                      </p>
                      <ul className={`list-none text-sm text-zinc-600 font-medium space-y-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                        {totalData.diagnostics.orphanedAccounts.map((e, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                            {e}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {totalData.diagnostics.missingAccountType.length > 0 && (
                    <div className="space-y-3 bg-white/50 p-4 rounded-2xl border border-amber-100">
                      <p className={`text-sm font-black text-emerald-600 flex items-center gap-2 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                        <Search size={16} />
                        {t('balance_sheet.missing_account_type')}
                      </p>
                      <ul className={`list-none text-sm text-zinc-600 font-medium space-y-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                        {totalData.diagnostics.missingAccountType.map((e, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            {e}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="text-xs text-amber-700 font-bold bg-amber-100/50 p-4 rounded-2xl italic leading-relaxed shadow-inner">
                    {t('balance_sheet.diagnostics_note')}
                  </p>
                </motion.div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-[2.5rem] shadow-sm overflow-hidden">
            <div className={`px-8 py-6 border-b border-zinc-100 bg-zinc-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4`}>
              <div>
                <h3 className="text-lg font-black text-zinc-900">
                  {dir === 'rtl' ? 'المركز المالي المقارن' : 'Comparative Financial Position'}
                </h3>
                <p className="text-zinc-500 font-bold text-sm mt-0.5">
                  {dir === 'rtl' 
                    ? `عرض مقارن حسب الفترات: من ${dateRange.start} إلى ${dateRange.end}`
                    : `Comparative view by period: from ${dateRange.start} to ${dateRange.end}`
                  }
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse" dir={dir}>
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/30 text-zinc-500 font-bold text-xs uppercase tracking-wider">
                    <th className={`px-6 py-4 font-black ${dir === 'rtl' ? 'text-right' : 'text-left'} sticky left-0 bg-zinc-50/90 backdrop-blur-sm z-10 border-r border-zinc-100`}>
                      {dir === 'rtl' ? 'الكود والحساب' : 'Code & Account'}
                    </th>
                    {subPeriods.map(p => (
                      <th key={p.start} className="px-6 py-4 font-black text-center whitespace-nowrap">
                        {dir === 'rtl' ? p.labelAr : p.labelEn}
                      </th>
                    ))}
                    <th className="px-6 py-4 font-black text-center bg-zinc-50/50 whitespace-nowrap border-l border-zinc-100">
                      {dir === 'rtl' ? 'رصيد النهاية' : 'Final Balance'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  <tr className="bg-emerald-50/20">
                    <td colSpan={subPeriods.length + 2} className={`px-6 py-3 font-black text-emerald-800 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                      {dir === 'rtl' ? '1. الأصول' : '1. Assets'}
                    </td>
                  </tr>
                  {totalData.assets.map(item => (
                    <tr key={item.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className={`px-6 py-3.5 font-bold text-zinc-700 sticky left-0 bg-white z-10 border-r border-zinc-100 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                        <span className="text-xs text-zinc-400 font-medium block">
                          {accounts.find(a => a.id === item.id)?.code || ''}
                        </span>
                        <span 
                          onClick={() => {
                            setPendingLedgerParams({
                              accountId: item.id,
                              startDate: '1900-01-01',
                              endDate: dateRange.end
                            });
                            setCurrentPage('general_ledger_report');
                          }}
                          className="text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
                        >
                          {item.name}
                        </span>
                      </td>
                      {subPeriods.map((p, idx) => {
                        const val = periodResults[idx].data.assets.find(a => a.id === item.id)?.balance || 0;
                        return (
                          <td key={p.start} className="px-6 py-3.5 text-center font-medium text-zinc-900 whitespace-nowrap">
                            {formatNumber(val)}
                          </td>
                        );
                      })}
                      <td className="px-6 py-3.5 text-center font-black text-zinc-900 bg-zinc-50/30 whitespace-nowrap border-l border-zinc-100">
                        {formatNumber(item.balance)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-emerald-50/10 font-bold">
                    <td className={`px-6 py-4 text-emerald-700 sticky left-0 bg-emerald-50/10 z-10 border-r border-zinc-100 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                      {dir === 'rtl' ? 'إجمالي الأصول' : 'Total Assets'}
                    </td>
                    {subPeriods.map((p, idx) => (
                      <td key={p.start} className="px-6 py-4 text-center text-emerald-700 whitespace-nowrap">
                        {formatNumber(periodResults[idx].data.totalAssets)}
                      </td>
                    ))}
                    <td className="px-6 py-4 text-center font-black text-emerald-700 bg-zinc-50/30 whitespace-nowrap border-l border-zinc-100">
                      {formatNumber(totalData.totalAssets)}
                    </td>
                  </tr>

                  <tr className="bg-zinc-50/50">
                    <td colSpan={subPeriods.length + 2} className={`px-6 py-3 font-black text-zinc-800 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                      {dir === 'rtl' ? '2. الالتزامات (الخصوم)' : '2. Liabilities'}
                    </td>
                  </tr>
                  {totalData.liabilities.map(item => (
                    <tr key={item.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className={`px-6 py-3.5 font-bold text-zinc-700 sticky left-0 bg-white z-10 border-r border-zinc-100 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                        <span className="text-xs text-zinc-400 font-medium block">
                          {accounts.find(a => a.id === item.id)?.code || ''}
                        </span>
                        <span 
                          onClick={() => {
                            setPendingLedgerParams({
                              accountId: item.id,
                              startDate: '1900-01-01',
                              endDate: dateRange.end
                            });
                            setCurrentPage('general_ledger_report');
                          }}
                          className="text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
                        >
                          {item.name}
                        </span>
                      </td>
                      {subPeriods.map((p, idx) => {
                        const val = Math.abs(periodResults[idx].data.liabilities.find(l => l.id === item.id)?.balance || 0);
                        return (
                          <td key={p.start} className="px-6 py-3.5 text-center font-medium text-zinc-900 whitespace-nowrap">
                            {formatNumber(val)}
                          </td>
                        );
                      })}
                      <td className="px-6 py-3.5 text-center font-black text-zinc-900 bg-zinc-50/30 whitespace-nowrap border-l border-zinc-100">
                        {formatNumber(Math.abs(item.balance))}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-zinc-50/30 font-bold">
                    <td className={`px-6 py-4 text-zinc-700 sticky left-0 bg-zinc-50/30 z-10 border-r border-zinc-100 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                      {dir === 'rtl' ? 'إجمالي الالتزامات' : 'Total Liabilities'}
                    </td>
                    {subPeriods.map((p, idx) => (
                      <td key={p.start} className="px-6 py-4 text-center text-zinc-700 whitespace-nowrap">
                        {formatNumber(periodResults[idx].data.totalLiabilities)}
                      </td>
                    ))}
                    <td className="px-6 py-4 text-center font-black text-zinc-700 bg-zinc-50/30 whitespace-nowrap border-l border-zinc-100">
                      {formatNumber(totalData.totalLiabilities)}
                    </td>
                  </tr>

                  <tr className="bg-blue-50/20">
                    <td colSpan={subPeriods.length + 2} className={`px-6 py-3 font-black text-blue-800 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                      {dir === 'rtl' ? '3. حقوق الملكية' : '3. Equity'}
                    </td>
                  </tr>
                  {totalData.equity.map(item => (
                    <tr key={item.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className={`px-6 py-3.5 font-bold text-zinc-700 sticky left-0 bg-white z-10 border-r border-zinc-100 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                        <span className="text-xs text-zinc-400 font-medium block">
                          {accounts.find(a => a.id === item.id)?.code || ''}
                        </span>
                        <span 
                          onClick={() => {
                            setPendingLedgerParams({
                              accountId: item.id,
                              startDate: '1900-01-01',
                              endDate: dateRange.end
                            });
                            setCurrentPage('general_ledger_report');
                          }}
                          className="text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
                        >
                          {item.name}
                        </span>
                      </td>
                      {subPeriods.map((p, idx) => {
                        const val = Math.abs(periodResults[idx].data.equity.find(e => e.id === item.id)?.balance || 0);
                        return (
                          <td key={p.start} className="px-6 py-3.5 text-center font-medium text-zinc-900 whitespace-nowrap">
                            {formatNumber(val)}
                          </td>
                        );
                      })}
                      <td className="px-6 py-3.5 text-center font-black text-zinc-900 bg-zinc-50/30 whitespace-nowrap border-l border-zinc-100">
                        {formatNumber(Math.abs(item.balance))}
                      </td>
                    </tr>
                  ))}
                  <tr className="hover:bg-zinc-50/50 transition-colors">
                    <td className={`px-6 py-3.5 font-bold text-emerald-700 sticky left-0 bg-white z-10 border-r border-zinc-100 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                      {t('balance_sheet.net_profit_period')}
                    </td>
                    {subPeriods.map((p, idx) => (
                      <td key={p.start} className="px-6 py-3.5 text-center font-medium text-emerald-600 whitespace-nowrap">
                        {formatNumber(periodResults[idx].data.netProfit)}
                      </td>
                    ))}
                    <td className="px-6 py-3.5 text-center font-black text-emerald-600 bg-zinc-50/30 whitespace-nowrap border-l border-zinc-100">
                      {formatNumber(totalData.netProfit)}
                    </td>
                  </tr>
                  <tr className="bg-blue-50/10 font-bold">
                    <td className={`px-6 py-4 text-blue-700 sticky left-0 bg-blue-50/10 z-10 border-r border-zinc-100 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                      {dir === 'rtl' ? 'إجمالي حقوق الملكية' : 'Total Equity'}
                    </td>
                    {subPeriods.map((p, idx) => (
                      <td key={p.start} className="px-6 py-4 text-center text-blue-700 whitespace-nowrap">
                        {formatNumber(periodResults[idx].data.totalEquity)}
                      </td>
                    ))}
                    <td className="px-6 py-4 text-center font-black text-blue-700 bg-zinc-50/30 whitespace-nowrap border-l border-zinc-100">
                      {formatNumber(totalData.totalEquity)}
                    </td>
                  </tr>

                  <tr className="bg-zinc-900 text-white font-black border-y border-zinc-700">
                    <td className={`px-6 py-5 sticky left-0 bg-zinc-900 text-white z-10 border-r border-zinc-800 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                      {dir === 'rtl' ? 'إجمالي الالتزامات وحقوق الملكية' : 'Total Liabilities & Equity'}
                    </td>
                    {subPeriods.map((p, idx) => (
                      <td key={p.start} className="px-6 py-5 text-center text-lg whitespace-nowrap text-white">
                        {formatNumber(periodResults[idx].data.totalLiabilitiesEquity)}
                      </td>
                    ))}
                    <td className="px-6 py-5 text-center text-xl bg-zinc-950 whitespace-nowrap border-l border-zinc-850 text-white">
                      {formatNumber(totalData.totalLiabilitiesEquity)}
                    </td>
                  </tr>

                  <tr className="bg-zinc-50 font-bold">
                    <td className={`px-6 py-4 sticky left-0 bg-zinc-50 z-10 border-r border-zinc-100 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                      {dir === 'rtl' ? 'فارق التوازن' : 'Difference'}
                    </td>
                    {subPeriods.map((p, idx) => {
                      const diff = periodResults[idx].data.diagnostics.difference;
                      const isBalanced = Math.abs(diff) < 0.01;
                      return (
                        <td key={p.start} className={`px-6 py-4 text-center whitespace-nowrap ${isBalanced ? 'text-emerald-600' : 'text-rose-600 font-black'}`}>
                          {formatNumber(diff)}
                        </td>
                      );
                    })}
                    <td className={`px-6 py-4 text-center font-black whitespace-nowrap border-l border-zinc-100 ${totalData.isBalanced ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {formatNumber(totalData.diagnostics.difference)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
