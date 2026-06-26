import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { dbService } from '../services/dbService';
import { JournalEntry, Account, AccountType } from '../types';
import { Search, Calendar, FileText, Download, Printer, Filter, PieChart, ArrowLeftRight, TrendingUp, TrendingDown, RefreshCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { exportToPDF } from '../utils/pdfUtils';
import { exportToExcel } from '../utils/excelUtils';
import { AccountingEngine } from '../services/AccountingEngine';
import { formatNumber } from '../utils/formatUtils';
import { useNavigation } from '../contexts/NavigationContext';

export const IncomeStatement: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { setCurrentPage, setPendingLedgerParams } = useNavigation();
  const reportRef = useRef<HTMLDivElement>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
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

  // Calculate sub-periods and results
  const subPeriods = AccountingEngine.getSubPeriods(dateRange.start, dateRange.end, viewMode);
  const periodResults = subPeriods.map(period => {
    return {
      period,
      data: AccountingEngine.calculateIncomeStatement(
        accounts,
        accountTypes,
        entries,
        period.start,
        period.end
      )
    };
  });

  // Calculate overall range summary (used for 'single' view and the Total column of breakdown view)
  const totalData = AccountingEngine.calculateIncomeStatement(
    accounts,
    accountTypes,
    entries,
    dateRange.start,
    dateRange.end
  );

  const handleExportPDF = async () => {
    if (reportRef.current) {
      await exportToPDF(reportRef.current, { 
        filename: 'Income_Statement', 
        orientation: viewMode === 'single' ? 'portrait' : 'landscape',
        reportTitle: t('income.title')
      });
    }
  };

  const handleExportExcel = () => {
    if (viewMode === 'single') {
      const rows: any[] = [];
      
      totalData.revenues.forEach(r => {
        rows.push({
          [dir === 'rtl' ? 'النوع' : 'Type']: dir === 'rtl' ? 'إيرادات' : 'Revenue',
          [dir === 'rtl' ? 'الحساب' : 'Account']: r.name,
          [dir === 'rtl' ? 'القيمة' : 'Amount']: r.balance
        });
      });
      rows.push({
        [dir === 'rtl' ? 'النوع' : 'Type']: dir === 'rtl' ? 'إجمالي الإيرادات' : 'Total Revenues',
        [dir === 'rtl' ? 'الحساب' : 'Account']: '',
        [dir === 'rtl' ? 'القيمة' : 'Amount']: totalData.totalRevenues
      });

      totalData.costs.forEach(c => {
        rows.push({
          [dir === 'rtl' ? 'النوع' : 'Type']: dir === 'rtl' ? 'تكلفة مبيعات' : 'Cost',
          [dir === 'rtl' ? 'الحساب' : 'Account']: c.name,
          [dir === 'rtl' ? 'القيمة' : 'Amount']: Math.abs(c.balance)
        });
      });
      rows.push({
        [dir === 'rtl' ? 'النوع' : 'Type']: dir === 'rtl' ? 'إجمالي تكلفة المبيعات' : 'Total Costs',
        [dir === 'rtl' ? 'الحساب' : 'Account']: '',
        [dir === 'rtl' ? 'القيمة' : 'Amount']: totalData.totalCosts
      });

      rows.push({
        [dir === 'rtl' ? 'النوع' : 'Type']: dir === 'rtl' ? 'مجمل الربح' : 'Gross Profit',
        [dir === 'rtl' ? 'الحساب' : 'Account']: '',
        [dir === 'rtl' ? 'القيمة' : 'Amount']: totalData.grossProfit
      });

      totalData.expenses.forEach(e => {
        rows.push({
          [dir === 'rtl' ? 'النوع' : 'Type']: dir === 'rtl' ? 'مصروفات' : 'Expense',
          [dir === 'rtl' ? 'الحساب' : 'Account']: e.name,
          [dir === 'rtl' ? 'القيمة' : 'Amount']: Math.abs(e.balance)
        });
      });
      rows.push({
        [dir === 'rtl' ? 'النوع' : 'Type']: dir === 'rtl' ? 'إجمالي المصروفات' : 'Total Expenses',
        [dir === 'rtl' ? 'الحساب' : 'Account']: '',
        [dir === 'rtl' ? 'القيمة' : 'Amount']: totalData.totalExpenses
      });

      rows.push({
        [dir === 'rtl' ? 'النوع' : 'Type']: dir === 'rtl' ? 'صافي الربح' : 'Net Profit',
        [dir === 'rtl' ? 'الحساب' : 'Account']: '',
        [dir === 'rtl' ? 'القيمة' : 'Amount']: totalData.netProfit
      });

      exportToExcel(rows, { filename: 'Income_Statement' });
    } else {
      const rows: any[] = [];
      
      const addSection = (title: string, items: any[], typeLabel: string) => {
        rows.push({
          [dir === 'rtl' ? 'الكود' : 'Code']: '',
          [dir === 'rtl' ? 'الحساب' : 'Account']: title,
          ...subPeriods.reduce((acc, p) => ({ ...acc, [dir === 'rtl' ? p.labelAr : p.labelEn]: '' }), {}),
          [dir === 'rtl' ? 'الإجمالي' : 'Total']: ''
        });

        items.forEach(item => {
          const row: any = {
            [dir === 'rtl' ? 'الكود' : 'Code']: accounts.find(a => a.id === item.id)?.code || '',
            [dir === 'rtl' ? 'الحساب' : 'Account']: item.name,
          };
          subPeriods.forEach((p, idx) => {
            const pRes = periodResults[idx].data;
            let val = 0;
            if (typeLabel === 'revenue') {
              val = pRes.revenues.find(r => r.id === item.id)?.balance || 0;
            } else if (typeLabel === 'cost') {
              val = Math.abs(pRes.costs.find(c => c.id === item.id)?.balance || 0);
            } else if (typeLabel === 'expense') {
              val = Math.abs(pRes.expenses.find(e => e.id === item.id)?.balance || 0);
            }
            row[dir === 'rtl' ? p.labelAr : p.labelEn] = val;
          });
          row[dir === 'rtl' ? 'الإجمالي' : 'Total'] = typeLabel === 'revenue' ? item.balance : Math.abs(item.balance);
          rows.push(row);
        });

        const summaryRow: any = {
          [dir === 'rtl' ? 'الكود' : 'Code']: '',
          [dir === 'rtl' ? 'الحساب' : 'Account']: dir === 'rtl' ? `إجمالي ${title}` : `Total ${title}`,
        };
        subPeriods.forEach((p, idx) => {
          const pRes = periodResults[idx].data;
          let val = 0;
          if (typeLabel === 'revenue') val = pRes.totalRevenues;
          else if (typeLabel === 'cost') val = pRes.totalCosts;
          else if (typeLabel === 'expense') val = pRes.totalExpenses;
          summaryRow[dir === 'rtl' ? p.labelAr : p.labelEn] = val;
        });
        summaryRow[dir === 'rtl' ? 'الإجمالي' : 'Total'] = typeLabel === 'revenue' ? totalData.totalRevenues : (typeLabel === 'cost' ? totalData.totalCosts : totalData.totalExpenses);
        rows.push(summaryRow);
        rows.push({});
      };

      addSection(dir === 'rtl' ? 'الإيرادات' : 'Revenues', totalData.revenues, 'revenue');
      addSection(dir === 'rtl' ? 'تكلفة المبيعات' : 'Cost of Sales', totalData.costs, 'cost');

      const gpRow: any = {
        [dir === 'rtl' ? 'الكود' : 'Code']: '',
        [dir === 'rtl' ? 'الحساب' : 'Account']: dir === 'rtl' ? 'مجمل الربح' : 'Gross Profit',
      };
      subPeriods.forEach((p, idx) => {
        gpRow[dir === 'rtl' ? p.labelAr : p.labelEn] = periodResults[idx].data.grossProfit;
      });
      gpRow[dir === 'rtl' ? 'الإجمالي' : 'Total'] = totalData.grossProfit;
      rows.push(gpRow);
      rows.push({});

      addSection(dir === 'rtl' ? 'المصروفات التشغيلية' : 'Operating Expenses', totalData.expenses, 'expense');

      const npRow: any = {
        [dir === 'rtl' ? 'الكود' : 'Code']: '',
        [dir === 'rtl' ? 'الحساب' : 'Account']: dir === 'rtl' ? 'صافي الربح' : 'Net Profit',
      };
      subPeriods.forEach((p, idx) => {
        npRow[dir === 'rtl' ? p.labelAr : p.labelEn] = periodResults[idx].data.netProfit;
      });
      npRow[dir === 'rtl' ? 'الإجمالي' : 'Total'] = totalData.netProfit;
      rows.push(npRow);

      exportToExcel(rows, { filename: 'Comparative_Income_Statement' });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-zinc-500 font-medium italic animate-pulse">{dir === 'rtl' ? 'جاري تحميل قائمة الدخل...' : 'Loading income statement...'}</p>
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
          <h2 className="text-2xl font-black text-zinc-900">{t('income.title')}</h2>
          <p className="text-zinc-500 font-medium mt-1">{t('income.subtitle')}</p>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              {/* Revenues Section */}
              <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm">
                <div className={`px-6 py-4 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                  <h3 className={`font-black text-emerald-700 flex items-center gap-2 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                    <TrendingUp size={20} />
                    {t('income.revenues')}
                  </h3>
                  <span className="text-lg font-black text-emerald-600">{formatNumber(totalData.totalRevenues)}</span>
                </div>
                <div className="p-2">
                  {totalData.revenues.map(a => (
                    <div key={a.id} className={`flex items-center justify-between p-4 hover:bg-zinc-50 rounded-2xl transition-all ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                      <span 
                        onClick={() => {
                          setPendingLedgerParams({
                            accountId: a.id,
                            startDate: dateRange.start,
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
                </div>
              </div>

              {/* Costs Section */}
              {totalData.costs.length > 0 && (
                <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm">
                  <div className={`px-6 py-4 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                    <h3 className={`font-black text-emerald-700 flex items-center gap-2 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                      <TrendingDown size={20} />
                      {t('income.costs')}
                    </h3>
                    <span className="text-lg font-black text-emerald-600">{formatNumber(totalData.totalCosts)}</span>
                  </div>
                  <div className="p-2">
                    {totalData.costs.map(a => (
                      <div key={a.id} className={`flex items-center justify-between p-4 hover:bg-zinc-50 rounded-2xl transition-all ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                        <span 
                          onClick={() => {
                            setPendingLedgerParams({
                              accountId: a.id,
                              startDate: dateRange.start,
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
                  </div>
                </div>
              )}

              {/* Expenses Section */}
              <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm">
                <div className={`px-6 py-4 bg-zinc-50 border-b border-zinc-100 flex items-center justify-between ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                  <h3 className={`font-black text-zinc-700 flex items-center gap-2 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                    <TrendingDown size={20} />
                    {t('income.expenses')}
                  </h3>
                  <span className="text-lg font-black text-zinc-600">{formatNumber(totalData.totalExpenses)}</span>
                </div>
                <div className="p-2">
                  {totalData.expenses.map(a => (
                    <div key={a.id} className={`flex items-center justify-between p-4 hover:bg-zinc-50 rounded-2xl transition-all ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                      <span 
                        onClick={() => {
                          setPendingLedgerParams({
                            accountId: a.id,
                            startDate: dateRange.start,
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
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-zinc-900 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-emerald-500/20 transition-all duration-500"></div>
                <p className={`text-emerald-500 font-black text-xs uppercase tracking-[0.2em] mb-2 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('income.final_result')}</p>
                <h3 className={`text-3xl font-black mb-6 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('income.net_profit')}</h3>
                <div className="space-y-4">
                  <div className={`flex items-center justify-between text-zinc-400 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                    <span className="font-bold">{t('income.gross_profit')}</span>
                    <span className="font-black text-white">{formatNumber(totalData.grossProfit)}</span>
                  </div>
                  <div className={`flex items-center justify-between text-zinc-400 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                    <span className="font-bold">{t('income.total_expenses')}</span>
                    <span className="font-black text-white">{formatNumber(totalData.totalExpenses)}</span>
                  </div>
                  <div className={`pt-4 border-t border-white/10 flex items-center justify-between ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                    <span className="font-black text-lg">{t('income.net')}</span>
                    <span className={`text-3xl font-black ${totalData.netProfit >= 0 ? 'text-emerald-400' : 'text-emerald-400'}`}>
                      {formatNumber(totalData.netProfit)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm">
                <h4 className={`font-black text-zinc-900 mb-6 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('income.ratio_analysis')}</h4>
                <div className="space-y-6">
                  <div>
                    <div className={`flex items-center justify-between mb-2 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                      <span className="text-sm font-bold text-zinc-500">{t('income.gross_margin')}</span>
                      <span className="text-sm font-black text-zinc-900">
                        {totalData.totalRevenues > 0 ? ((totalData.grossProfit / totalData.totalRevenues) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                    <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 transition-all duration-1000" 
                        style={{ width: `${totalData.totalRevenues > 0 ? (totalData.grossProfit / totalData.totalRevenues) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className={`flex items-center justify-between mb-2 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                      <span className="text-sm font-bold text-zinc-500">{t('income.net_margin')}</span>
                      <span className="text-sm font-black text-zinc-900">
                        {totalData.totalRevenues > 0 ? ((totalData.netProfit / totalData.totalRevenues) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                    <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-1000" 
                        style={{ width: `${totalData.totalRevenues > 0 ? (totalData.netProfit / totalData.totalRevenues) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-[2.5rem] shadow-sm overflow-hidden">
            {/* Header Info */}
            <div className={`px-8 py-6 border-b border-zinc-100 bg-zinc-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4`}>
              <div>
                <h3 className="text-lg font-black text-zinc-900">
                  {dir === 'rtl' ? 'قائمة الدخل المقارنة' : 'Comparative Income Statement'}
                </h3>
                <p className="text-zinc-500 font-bold text-sm mt-0.5">
                  {dir === 'rtl' 
                    ? `عرض مقارن حسب الفترات: من ${dateRange.start} إلى ${dateRange.end}`
                    : `Comparative view by period: from ${dateRange.start} to ${dateRange.end}`
                  }
                </p>
              </div>
            </div>

            {/* Table Container */}
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
                      {dir === 'rtl' ? 'الإجمالي' : 'Total'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {/* 1. Revenues Section */}
                  <tr className="bg-emerald-50/20">
                    <td colSpan={subPeriods.length + 2} className={`px-6 py-3 font-black text-emerald-800 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                      {dir === 'rtl' ? '1. الإيرادات' : '1. Revenues'}
                    </td>
                  </tr>
                  {totalData.revenues.map(item => (
                    <tr key={item.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className={`px-6 py-3.5 font-bold text-zinc-700 sticky left-0 bg-white z-10 border-r border-zinc-100 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                        <span className="text-xs text-zinc-400 font-medium block">
                          {accounts.find(a => a.id === item.id)?.code || ''}
                        </span>
                        <span 
                          onClick={() => {
                            setPendingLedgerParams({
                              accountId: item.id,
                              startDate: dateRange.start,
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
                        const val = periodResults[idx].data.revenues.find(r => r.id === item.id)?.balance || 0;
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
                  {/* Total Revenues Row */}
                  <tr className="bg-emerald-50/10 font-bold">
                    <td className={`px-6 py-4 text-emerald-700 sticky left-0 bg-emerald-50/10 z-10 border-r border-zinc-100 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                      {dir === 'rtl' ? 'إجمالي الإيرادات' : 'Total Revenues'}
                    </td>
                    {subPeriods.map((p, idx) => (
                      <td key={p.start} className="px-6 py-4 text-center text-emerald-700 whitespace-nowrap">
                        {formatNumber(periodResults[idx].data.totalRevenues)}
                      </td>
                    ))}
                    <td className="px-6 py-4 text-center font-black text-emerald-700 bg-zinc-50/30 whitespace-nowrap border-l border-zinc-100">
                      {formatNumber(totalData.totalRevenues)}
                    </td>
                  </tr>

                  {/* 2. Costs Section */}
                  {totalData.costs.length > 0 && (
                    <>
                      <tr className="bg-zinc-50/50">
                        <td colSpan={subPeriods.length + 2} className={`px-6 py-3 font-black text-zinc-800 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                          {dir === 'rtl' ? '2. تكلفة المبيعات' : '2. Cost of Sales'}
                        </td>
                      </tr>
                      {totalData.costs.map(item => (
                        <tr key={item.id} className="hover:bg-zinc-50/50 transition-colors">
                          <td className={`px-6 py-3.5 font-bold text-zinc-700 sticky left-0 bg-white z-10 border-r border-zinc-100 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                            <span className="text-xs text-zinc-400 font-medium block">
                              {accounts.find(a => a.id === item.id)?.code || ''}
                            </span>
                            <span 
                              onClick={() => {
                                setPendingLedgerParams({
                                  accountId: item.id,
                                  startDate: dateRange.start,
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
                            const val = Math.abs(periodResults[idx].data.costs.find(c => c.id === item.id)?.balance || 0);
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
                      {/* Total Costs Row */}
                      <tr className="bg-zinc-50/30 font-bold">
                        <td className={`px-6 py-4 text-zinc-700 sticky left-0 bg-zinc-50/30 z-10 border-r border-zinc-100 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                          {dir === 'rtl' ? 'إجمالي تكلفة المبيعات' : 'Total Cost of Sales'}
                        </td>
                        {subPeriods.map((p, idx) => (
                          <td key={p.start} className="px-6 py-4 text-center text-zinc-700 whitespace-nowrap">
                            {formatNumber(periodResults[idx].data.totalCosts)}
                          </td>
                        ))}
                        <td className="px-6 py-4 text-center font-black text-zinc-700 bg-zinc-50/30 whitespace-nowrap border-l border-zinc-100">
                          {formatNumber(totalData.totalCosts)}
                        </td>
                      </tr>
                    </>
                  )}

                  {/* 3. Gross Profit Row */}
                  <tr className="bg-emerald-500/10 font-bold border-y-2 border-emerald-200">
                    <td className={`px-6 py-4 text-emerald-800 sticky left-0 bg-emerald-500/10 z-10 border-r border-zinc-100 ${dir === 'rtl' ? 'text-right' : 'text-left'}`} style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                      {dir === 'rtl' ? 'مجمل الربح' : 'Gross Profit'}
                    </td>
                    {subPeriods.map((p, idx) => (
                      <td key={p.start} className="px-6 py-4 text-center text-emerald-800 whitespace-nowrap">
                        {formatNumber(periodResults[idx].data.grossProfit)}
                      </td>
                    ))}
                    <td className="px-6 py-4 text-center font-black text-emerald-850 bg-zinc-50/30 whitespace-nowrap border-l border-zinc-100">
                      {formatNumber(totalData.grossProfit)}
                    </td>
                  </tr>

                  {/* 4. Expenses Section */}
                  <tr className="bg-zinc-50/50">
                    <td colSpan={subPeriods.length + 2} className={`px-6 py-3 font-black text-zinc-800 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                      {dir === 'rtl' ? '3. المصروفات التشغيلية' : '3. Operating Expenses'}
                    </td>
                  </tr>
                  {totalData.expenses.map(item => (
                    <tr key={item.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className={`px-6 py-3.5 font-bold text-zinc-700 sticky left-0 bg-white z-10 border-r border-zinc-100 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                        <span className="text-xs text-zinc-400 font-medium block">
                          {accounts.find(a => a.id === item.id)?.code || ''}
                        </span>
                        <span 
                          onClick={() => {
                            setPendingLedgerParams({
                              accountId: item.id,
                              startDate: dateRange.start,
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
                        const val = Math.abs(periodResults[idx].data.expenses.find(e => e.id === item.id)?.balance || 0);
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
                  {/* Total Expenses Row */}
                  <tr className="bg-zinc-50/30 font-bold">
                    <td className={`px-6 py-4 text-zinc-700 sticky left-0 bg-zinc-50/30 z-10 border-r border-zinc-100 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                      {dir === 'rtl' ? 'إجمالي المصروفات' : 'Total Operating Expenses'}
                    </td>
                    {subPeriods.map((p, idx) => (
                      <td key={p.start} className="px-6 py-4 text-center text-zinc-700 whitespace-nowrap">
                        {formatNumber(periodResults[idx].data.totalExpenses)}
                      </td>
                    ))}
                    <td className="px-6 py-4 text-center font-black text-zinc-700 bg-zinc-50/30 whitespace-nowrap border-l border-zinc-100">
                      {formatNumber(totalData.totalExpenses)}
                    </td>
                  </tr>

                  {/* 5. Net Profit Row */}
                  <tr className="bg-zinc-900 text-white font-black border-t-2 border-zinc-700">
                    <td className={`px-6 py-5 sticky left-0 bg-zinc-900 text-white z-10 border-r border-zinc-800 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                      <span className="text-xs text-emerald-400 font-bold block uppercase tracking-wider">
                        {dir === 'rtl' ? 'النتيجة النهائية' : 'Final Result'}
                      </span>
                      <span className="text-base">
                        {dir === 'rtl' ? 'صافي الربح / الخسارة' : 'Net Profit / Loss'}
                      </span>
                    </td>
                    {subPeriods.map((p, idx) => {
                      const profit = periodResults[idx].data.netProfit;
                      return (
                        <td key={p.start} className={`px-6 py-5 text-center text-lg whitespace-nowrap ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {formatNumber(profit)}
                        </td>
                      );
                    })}
                    <td className={`px-6 py-5 text-center text-xl bg-zinc-950 whitespace-nowrap border-l border-zinc-850 ${totalData.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {formatNumber(totalData.netProfit)}
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
