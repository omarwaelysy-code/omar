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

  const data = AccountingEngine.calculateIncomeStatement(
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
        orientation: 'portrait',
        reportTitle: t('income.title')
      });
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
          <button onClick={handleExportPDF} className="p-2.5 bg-white border border-zinc-200 text-zinc-600 rounded-xl hover:bg-zinc-50 transition-all shadow-sm"><Printer size={20} /></button>
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

      <div ref={reportRef} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            {/* Revenues Section */}
            <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm">
            <div className={`px-6 py-4 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
              <h3 className={`font-black text-emerald-700 flex items-center gap-2 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                <TrendingUp size={20} />
                {t('income.revenues')}
              </h3>
              <span className="text-lg font-black text-emerald-600">{formatNumber(data.totalRevenues)}</span>
            </div>
            <div className="p-2">
              {data.revenues.map(a => (
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
          <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm">
            <div className={`px-6 py-4 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
              <h3 className={`font-black text-emerald-700 flex items-center gap-2 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                <TrendingDown size={20} />
                {t('income.costs')}
              </h3>
              <span className="text-lg font-black text-emerald-600">{formatNumber(data.totalCosts)}</span>
            </div>
            <div className="p-2">
              {data.costs.map(a => (
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

          {/* Expenses Section */}
          <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm">
            <div className={`px-6 py-4 bg-zinc-50 border-b border-zinc-100 flex items-center justify-between ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
              <h3 className={`font-black text-zinc-700 flex items-center gap-2 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                <TrendingDown size={20} />
                {t('income.expenses')}
              </h3>
              <span className="text-lg font-black text-zinc-600">{formatNumber(data.totalExpenses)}</span>
            </div>
            <div className="p-2">
              {data.expenses.map(a => (
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
                <span className="font-black text-white">{formatNumber(data.grossProfit)}</span>
              </div>
              <div className={`flex items-center justify-between text-zinc-400 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                <span className="font-bold">{t('income.total_expenses')}</span>
                <span className="font-black text-white">{formatNumber(data.totalExpenses)}</span>
              </div>
              <div className={`pt-4 border-t border-white/10 flex items-center justify-between ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                <span className="font-black text-lg">{t('income.net')}</span>
                <span className={`text-3xl font-black ${data.netProfit >= 0 ? 'text-emerald-400' : 'text-emerald-400'}`}>
                  {formatNumber(data.netProfit)}
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
                    {data.totalRevenues > 0 ? ((data.grossProfit / data.totalRevenues) * 100).toFixed(1) : 0}%
                  </span>
                </div>
                <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-1000" 
                    style={{ width: `${data.totalRevenues > 0 ? (data.grossProfit / data.totalRevenues) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
              <div>
                <div className={`flex items-center justify-between mb-2 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                  <span className="text-sm font-bold text-zinc-500">{t('income.net_margin')}</span>
                  <span className="text-sm font-black text-zinc-900">
                    {data.totalRevenues > 0 ? ((data.netProfit / data.totalRevenues) * 100).toFixed(1) : 0}%
                  </span>
                </div>
                <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-1000" 
                    style={{ width: `${data.totalRevenues > 0 ? (data.netProfit / data.totalRevenues) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);
};
