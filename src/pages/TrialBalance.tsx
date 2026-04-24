import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { dbService } from '../services/dbService';
import { JournalEntry, Account } from '../types';
import { Search, Calendar, FileText, Download, Printer, Filter, BarChart3, ArrowLeftRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { exportToPDF } from '../utils/pdfUtils';
import { exportToExcel } from '../utils/excelUtils';

export const TrialBalance: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const reportRef = useRef<HTMLDivElement>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (!user) return;

    const unsubscribeEntries = dbService.subscribe<JournalEntry>(
      'journal_entries', 
      user.company_id, 
      (data) => {
        setEntries(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    const unsubscribeAccounts = dbService.subscribe<Account>(
      'accounts', 
      user.company_id, 
      (data) => {
        setAccounts(data);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => {
      unsubscribeEntries();
      unsubscribeAccounts();
    };
  }, [user]);

  const calculateTrialBalance = () => {
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    endDate.setHours(23, 59, 59, 999);

    return accounts.map(account => {
      let openingDebit = account.opening_balance > 0 ? account.opening_balance : 0;
      let openingCredit = account.opening_balance < 0 ? Math.abs(account.opening_balance) : 0;
      let movementDebit = 0;
      let movementCredit = 0;

      entries.forEach(entry => {
        const entryDate = new Date(entry.date);
        entry.items?.forEach(item => {
          if (item.account_id === account.id) {
            if (entryDate < startDate) {
              openingDebit += item.debit;
              openingCredit += item.credit;
            } else if (entryDate >= startDate && entryDate <= endDate) {
              movementDebit += item.debit;
              movementCredit += item.credit;
            }
          }
        });
      });

      const openingBalance = openingDebit - openingCredit;
      const closingBalance = openingBalance + (movementDebit - movementCredit);

      return {
        ...account,
        opening: {
          debit: openingBalance > 0 ? openingBalance : 0,
          credit: openingBalance < 0 ? Math.abs(openingBalance) : 0
        },
        movement: {
          debit: movementDebit,
          credit: movementCredit
        },
        closing: {
          debit: closingBalance > 0 ? closingBalance : 0,
          credit: closingBalance < 0 ? Math.abs(closingBalance) : 0
        }
      };
    }).filter(a => a.opening.debit !== 0 || a.opening.credit !== 0 || a.movement.debit !== 0 || a.movement.credit !== 0);
  };

  const trialBalanceData = calculateTrialBalance();

  const totals = trialBalanceData.reduce((acc, a) => ({
    openingDebit: acc.openingDebit + a.opening.debit,
    openingCredit: acc.openingCredit + a.opening.credit,
    movementDebit: acc.movementDebit + a.movement.debit,
    movementCredit: acc.movementCredit + a.movement.credit,
    closingDebit: acc.closingDebit + a.closing.debit,
    closingCredit: acc.closingCredit + a.closing.credit
  }), {
    openingDebit: 0, openingCredit: 0,
    movementDebit: 0, movementCredit: 0,
    closingDebit: 0, closingCredit: 0
  });

  const handleExportPDF = async () => {
    if (reportRef.current) {
      await exportToPDF(reportRef.current, { 
        filename: 'Trial_Balance', 
        orientation: 'landscape',
        reportTitle: t('trial.title')
      });
    }
  };

  const handleExportExcel = () => {
    const data = trialBalanceData.map(a => ({
      [t('accounts.column_code')]: a.code,
      [t('accounts.column_name')]: a.name,
      [`${t('trial.opening_balance')} ${t('journal.column_debit')}`]: a.opening.debit,
      [`${t('trial.opening_balance')} ${t('journal.column_credit')}`]: a.opening.credit,
      [`${t('trial.movement')} ${t('journal.column_debit')}`]: a.movement.debit,
      [`${t('trial.movement')} ${t('journal.column_credit')}`]: a.movement.credit,
      [`${t('trial.closing_balance')} ${t('journal.column_debit')}`]: a.closing.debit,
      [`${t('trial.closing_balance')} ${t('journal.column_credit')}`]: a.closing.credit
    }));
    exportToExcel(data, { filename: 'Trial_Balance' });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-zinc-500 font-medium italic animate-pulse">{dir === 'rtl' ? 'جاري تحميل ميزان المراجعة...' : 'Loading trial balance...'}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 p-8 bg-rose-50 rounded-3xl border border-rose-100 italic text-center">
        <p className="text-rose-600 font-bold">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200"
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
          <h2 className="text-2xl font-black text-zinc-900">{t('trial.title')}</h2>
          <p className="text-zinc-500 font-medium mt-1">{t('trial.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportPDF} className="p-2.5 bg-white border border-zinc-200 text-zinc-600 rounded-xl hover:bg-zinc-50 transition-all shadow-sm"><Printer size={20} /></button>
          <button onClick={handleExportExcel} className="p-2.5 bg-white border border-zinc-200 text-zinc-600 rounded-xl hover:bg-zinc-50 transition-all shadow-sm"><Download size={20} /></button>
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

      <div ref={reportRef} className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'} border-collapse`}>
            <thead>
              <tr className="bg-zinc-100 border-b border-zinc-200">
                <th rowSpan={2} className={`px-6 py-4 text-sm font-bold text-zinc-700 ${dir === 'rtl' ? 'border-l' : 'border-r'} border-zinc-200`}>{t('accounts.column_code')}</th>
                <th rowSpan={2} className={`px-6 py-4 text-sm font-bold text-zinc-700 ${dir === 'rtl' ? 'border-l' : 'border-r'} border-zinc-200`}>{t('accounts.column_name')}</th>
                <th colSpan={2} className={`px-6 py-2 text-sm font-bold text-zinc-700 text-center border-b border-zinc-200 ${dir === 'rtl' ? 'border-l' : 'border-r'} border-zinc-200`}>{t('trial.opening_balance')}</th>
                <th colSpan={2} className={`px-6 py-2 text-sm font-bold text-zinc-700 text-center border-b border-zinc-200 ${dir === 'rtl' ? 'border-l' : 'border-r'} border-zinc-200`}>{t('trial.movement')}</th>
                <th colSpan={2} className="px-6 py-2 text-sm font-bold text-zinc-700 text-center border-b border-zinc-200">{t('trial.closing_balance')}</th>
              </tr>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                <th className={`px-4 py-2 text-xs font-bold text-zinc-600 text-center ${dir === 'rtl' ? 'border-l' : 'border-r'} border-zinc-200`}>{t('journal.column_debit')}</th>
                <th className={`px-4 py-2 text-xs font-bold text-zinc-600 text-center ${dir === 'rtl' ? 'border-l' : 'border-r'} border-zinc-200`}>{t('journal.column_credit')}</th>
                <th className={`px-4 py-2 text-xs font-bold text-zinc-600 text-center ${dir === 'rtl' ? 'border-l' : 'border-r'} border-zinc-200`}>{t('journal.column_debit')}</th>
                <th className={`px-4 py-2 text-xs font-bold text-zinc-600 text-center ${dir === 'rtl' ? 'border-l' : 'border-r'} border-zinc-200`}>{t('journal.column_credit')}</th>
                <th className={`px-4 py-2 text-xs font-bold text-zinc-600 text-center ${dir === 'rtl' ? 'border-l' : 'border-r'} border-zinc-200`}>{t('journal.column_debit')}</th>
                <th className="px-4 py-2 text-xs font-bold text-zinc-600 text-center">{t('journal.column_credit')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {trialBalanceData.map((a) => (
                <tr key={a.id} className="hover:bg-zinc-50/50 transition-colors">
                  <td className={`px-6 py-4 text-sm font-bold text-zinc-500 ${dir === 'rtl' ? 'border-l' : 'border-r'} border-zinc-100`}>{a.code}</td>
                  <td className={`px-6 py-4 text-sm font-bold text-zinc-900 ${dir === 'rtl' ? 'border-l' : 'border-r'} border-zinc-100`}>{a.name}</td>
                  <td className={`px-4 py-4 text-sm font-black text-emerald-600 text-center ${dir === 'rtl' ? 'border-l' : 'border-r'} border-zinc-100`}>{a.opening.debit > 0 ? a.opening.debit.toLocaleString() : '-'}</td>
                  <td className={`px-4 py-4 text-sm font-black text-rose-600 text-center ${dir === 'rtl' ? 'border-l' : 'border-r'} border-zinc-100`}>{a.opening.credit > 0 ? a.opening.credit.toLocaleString() : '-'}</td>
                  <td className={`px-4 py-4 text-sm font-black text-emerald-600 text-center ${dir === 'rtl' ? 'border-l' : 'border-r'} border-zinc-100`}>{a.movement.debit > 0 ? a.movement.debit.toLocaleString() : '-'}</td>
                  <td className={`px-4 py-4 text-sm font-black text-rose-600 text-center ${dir === 'rtl' ? 'border-l' : 'border-r'} border-zinc-100`}>{a.movement.credit > 0 ? a.movement.credit.toLocaleString() : '-'}</td>
                  <td className={`px-4 py-4 text-sm font-black text-emerald-600 text-center ${dir === 'rtl' ? 'border-l' : 'border-r'} border-zinc-100`}>{a.closing.debit > 0 ? a.closing.debit.toLocaleString() : '-'}</td>
                  <td className="px-4 py-4 text-sm font-black text-rose-600 text-center">{a.closing.credit > 0 ? a.closing.credit.toLocaleString() : '-'}</td>
                </tr>
              ))}
              <tr className="bg-zinc-900 text-white font-black">
                <td colSpan={2} className="px-6 py-4 text-sm text-center">{t('trial.total')}</td>
                <td className="px-4 py-4 text-sm text-center">{totals.openingDebit.toLocaleString()}</td>
                <td className="px-4 py-4 text-sm text-center">{totals.openingCredit.toLocaleString()}</td>
                <td className="px-4 py-4 text-sm text-center">{totals.movementDebit.toLocaleString()}</td>
                <td className="px-4 py-4 text-sm text-center">{totals.movementCredit.toLocaleString()}</td>
                <td className="px-4 py-4 text-sm text-center">{totals.closingDebit.toLocaleString()}</td>
                <td className="px-4 py-4 text-sm text-center">{totals.closingCredit.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Balance Check */}
      <div className={`p-8 rounded-[2.5rem] border-2 flex items-center justify-between shadow-lg ${
        Math.abs(totals.closingDebit - totals.closingCredit) < 0.01 
          ? 'bg-emerald-500 border-emerald-400 text-white shadow-emerald-500/20' 
          : 'bg-rose-500 border-rose-400 text-white shadow-rose-500/20'
      }`}>
        <div className={`flex items-center gap-4 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse text-left'}`}>
          <ArrowLeftRight size={32} />
          <div>
            <p className="font-black text-xl">{t('trial.check_title')}</p>
            <p className="text-sm opacity-80 font-bold">
              {Math.abs(totals.closingDebit - totals.closingCredit) < 0.01 
                ? t('trial.balanced') 
                : `${t('trial.unbalanced')} ${(totals.closingDebit - totals.closingCredit).toLocaleString()}`}
            </p>
          </div>
        </div>
        <div className={`${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
          <p className="text-xs font-black uppercase tracking-widest opacity-60">{t('trial.difference')}</p>
          <p className="text-2xl font-black">{(totals.closingDebit - totals.closingCredit).toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
};
