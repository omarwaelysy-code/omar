import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dbService } from '../services/dbService';
import { JournalEntry, Account, AccountType } from '../types';
import { Search, Calendar, FileText, Download, Printer, Filter, PieChart, ArrowLeftRight, Shield, CreditCard, Wallet, CheckCircle2, AlertTriangle, RefreshCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { exportToPDF } from '../utils/pdfUtils';
import { exportToExcel } from '../utils/excelUtils';
import { AccountingEngine } from '../services/AccountingEngine';
import { formatNumber } from '../utils/formatUtils';

import { useLanguage } from '../contexts/LanguageContext';

export const BalanceSheet: React.FC = () => {
  const { user } = useAuth();
  const { t, dir } = useLanguage();
  const reportRef = useRef<HTMLDivElement>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
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

  const data = AccountingEngine.calculateBalanceSheet(
    accounts,
    accountTypes,
    entries,
    asOfDate
  );

  const handleExportPDF = async () => {
    if (reportRef.current) {
      await exportToPDF(reportRef.current, { 
        filename: 'Balance_Sheet', 
        orientation: 'portrait',
        reportTitle: `${t('balance_sheet.title')} - ${asOfDate}`
      });
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
          <button onClick={handleExportPDF} className="p-2.5 bg-white border border-zinc-200 text-zinc-600 rounded-xl hover:bg-zinc-50 transition-all shadow-sm"><Printer size={20} /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <Calendar className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={20} />
          <input
            type="date"
            className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium`}
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
          />
        </div>
      </div>

      <div ref={reportRef} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Assets Section */}
          <div className="space-y-6">
            <div className="bg-white border border-zinc-200 rounded-[2.5rem] overflow-hidden shadow-sm h-full">
              <div className={`px-8 py-6 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                <h3 className={`font-black text-emerald-700 flex items-center gap-3 text-lg ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                  <Wallet size={24} />
                  {t('balance_sheet.assets')}
                </h3>
                <span className="text-2xl font-black text-emerald-600">{formatNumber(data.totalAssets)}</span>
              </div>
              <div className="p-4 space-y-2">
                {data.assets.map(a => (
                  <div key={a.id} className={`flex items-center justify-between p-4 hover:bg-emerald-50/30 rounded-2xl transition-all border border-transparent hover:border-emerald-100 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                    <span className="font-bold text-zinc-600">{a.name}</span>
                    <span className="font-black text-zinc-900">{formatNumber(a.balance)}</span>
                  </div>
                ))}
                {data.assets.length === 0 && (
                  <p className="p-12 text-center text-zinc-400 font-medium italic">{t('balance_sheet.no_assets')}</p>
                )}
              </div>
            </div>
          </div>

          {/* Liabilities & Equity Section */}
          <div className="space-y-8">
            {/* Liabilities */}
            <div className="bg-white border border-zinc-200 rounded-[2.5rem] overflow-hidden shadow-sm">
              <div className={`px-8 py-6 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                <h3 className={`font-black text-emerald-700 flex items-center gap-3 text-lg ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                  <CreditCard size={24} />
                  {dir === 'rtl' ? 'الالتزامات (الخصوم)' : 'Liabilities'}
                </h3>
                <span className="text-2xl font-black text-emerald-600">{formatNumber(data.totalLiabilities)}</span>
              </div>
              <div className="p-4 space-y-2">
                {data.liabilities.map(a => (
                  <div key={a.id} className={`flex items-center justify-between p-4 hover:bg-emerald-50/30 rounded-2xl transition-all border border-transparent hover:border-emerald-100 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                    <span className="font-bold text-zinc-600">{a.name}</span>
                    <span className="font-black text-zinc-900">{formatNumber(Math.abs(a.balance))}</span>
                  </div>
                ))}
                {data.liabilities.length === 0 && (
                  <p className="p-8 text-center text-zinc-400 font-medium italic">{dir === 'rtl' ? 'لا توجد التزامات' : 'No liabilities'}</p>
                )}
              </div>
            </div>

            {/* Equity */}
            <div className="bg-white border border-zinc-200 rounded-[2.5rem] overflow-hidden shadow-sm">
              <div className={`px-8 py-6 bg-blue-50 border-b border-blue-100 flex items-center justify-between ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                <h3 className={`font-black text-blue-700 flex items-center gap-3 text-lg ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                  <PieChart size={24} />
                  {dir === 'rtl' ? 'حقوق الملكية' : 'Equity'}
                </h3>
                <span className="text-2xl font-black text-blue-600">{formatNumber(data.totalEquity)}</span>
              </div>
              <div className="p-4 space-y-2">
                {data.equity.map(a => (
                  <div key={a.id} className={`flex items-center justify-between p-4 hover:bg-blue-50/30 rounded-2xl transition-all border border-transparent hover:border-blue-100 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                    <span className="font-bold text-zinc-600">{a.name}</span>
                    <span className="font-black text-zinc-900">{formatNumber(Math.abs(a.balance))}</span>
                  </div>
                ))}
                <div className={`flex items-center justify-between p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                  <span className="font-bold text-emerald-700">{t('balance_sheet.net_profit_period')}</span>
                  <span className="font-black text-emerald-600">{formatNumber(data.netProfit)}</span>
                </div>
              </div>
            </div>

            {/* Total L & E */}
            <div className={`px-8 py-6 rounded-[2rem] flex items-center justify-between bg-zinc-900 text-white shadow-xl ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
              <span className="font-black text-lg">{dir === 'rtl' ? 'إجمالي الالتزامات وحقوق الملكية' : 'Total Liabilities & Equity'}</span>
              <span className="text-2xl font-black">{formatNumber(data.totalLiabilitiesEquity)}</span>
            </div>

            {/* Balance Check */}
            <div className={`p-8 rounded-[2.5rem] border-2 flex items-center justify-between shadow-lg ${
              data.isBalanced 
                ? 'bg-emerald-500 border-emerald-400 text-white shadow-emerald-500/20' 
                : 'bg-emerald-500 border-emerald-400 text-white shadow-emerald-500/20'
            }`}>
              <div className={`flex items-center gap-4 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse text-left'}`}>
                <Shield size={32} />
                <div>
                  <p className="font-black text-xl">{t('balance_sheet.check_title')}</p>
                  <p className="text-sm opacity-80 font-bold">
                    {data.isBalanced 
                      ? t('balance_sheet.balanced_msg') 
                      : `${t('balance_sheet.unbalanced_msg')} ${formatNumber(data.diagnostics.difference)}`}
                  </p>
                </div>
              </div>
              <div className={`${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                <p className="text-xs font-black uppercase tracking-widest opacity-60">{t('balance_sheet.difference')}</p>
                <p className="text-2xl font-black">{formatNumber(data.diagnostics.difference)}</p>
              </div>
            </div>

            {/* Diagnostics Section */}
            {!data.isBalanced && (
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
                    <p className="text-xl font-black text-zinc-900">{formatNumber(data.diagnostics.globalDebit)}</p>
                  </div>
                  <div className="p-4 bg-white rounded-2xl border border-amber-100 shadow-sm">
                    <p className="text-xs font-bold text-zinc-500 mb-1 uppercase tracking-wider">{t('balance_sheet.total_credit_all')}</p>
                    <p className="text-xl font-black text-zinc-900">{formatNumber(data.diagnostics.globalCredit)}</p>
                  </div>
                </div>

                {data.diagnostics.unbalancedEntries.length > 0 && (
                  <div className="space-y-3 bg-white/50 p-4 rounded-2xl border border-amber-100">
                    <p className={`text-sm font-black text-emerald-600 flex items-center gap-2 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                      <ArrowLeftRight size={16} />
                      {t('balance_sheet.unbalanced_entries')}
                    </p>
                    <ul className={`list-none text-sm text-zinc-600 font-medium space-y-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                      {data.diagnostics.unbalancedEntries.map((e, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          {e}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {data.diagnostics.orphanedAccounts.length > 0 && (
                  <div className="space-y-3 bg-white/50 p-4 rounded-2xl border border-amber-100">
                    <p className={`text-sm font-black text-amber-700 flex items-center gap-2 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                      <AlertTriangle size={16} />
                      {dir === 'rtl' ? 'حسابات غير مصنفة (يتيمة)' : 'Orphaned Accounts'}
                    </p>
                    <ul className={`list-none text-sm text-zinc-600 font-medium space-y-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                      {data.diagnostics.orphanedAccounts.map((e, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                          {e}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {data.diagnostics.missingAccountType.length > 0 && (
                  <div className="space-y-3 bg-white/50 p-4 rounded-2xl border border-amber-100">
                    <p className={`text-sm font-black text-emerald-600 flex items-center gap-2 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                      <Search size={16} />
                      {dir === 'rtl' ? 'حسابات تفتقر لنوع حساب' : 'Accounts missing Type'}
                    </p>
                    <ul className={`list-none text-sm text-zinc-600 font-medium space-y-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                      {data.diagnostics.missingAccountType.map((e, i) => (
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
    </div>
  </div>
);
};
