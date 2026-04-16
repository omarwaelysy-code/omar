import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dbService } from '../services/dbService';
import { JournalEntry, Account, AccountType } from '../types';
import { Search, Calendar, FileText, Download, Printer, Filter, PieChart, ArrowLeftRight, Shield, CreditCard, Wallet } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { exportToPDF } from '../utils/pdfUtils';
import { exportToExcel } from '../utils/excelUtils';

import { useLanguage } from '../contexts/LanguageContext';

export const BalanceSheet: React.FC = () => {
  const { user } = useAuth();
  const { t, dir } = useLanguage();
  const reportRef = useRef<HTMLDivElement>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [loading, setLoading] = useState(true);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (!user) return;

    const unsubscribeEntries = dbService.subscribe<JournalEntry>('journal_entries', user.company_id, (data) => {
      setEntries(data);
      setLoading(false);
    });

    const unsubscribeAccounts = dbService.subscribe<Account>('accounts', user.company_id, setAccounts);
    const unsubscribeTypes = dbService.subscribe<AccountType>('account_types', user.company_id, setAccountTypes);

    return () => {
      unsubscribeEntries();
      unsubscribeAccounts();
      unsubscribeTypes();
    };
  }, [user]);

  const calculateBalanceSheet = () => {
    const targetDate = new Date(asOfDate);
    targetDate.setHours(23, 59, 59, 999);

    // Calculate Net Profit for the period up to targetDate
    // A more robust way: Net Profit = (Total Credits of non-BS accounts) - (Total Debits of non-BS accounts)
    const bsAccountIds = new Set(accounts.filter(account => {
      const type = accountTypes.find(t => t.id === account.type_id);
      return type?.statement_type === 'balance_sheet';
    }).map(a => a.id));

    let netProfit = 0;
    entries.forEach(entry => {
      const entryDate = new Date(entry.date);
      if (entryDate <= targetDate) {
        entry.items?.forEach(item => {
          // If the account is NOT a balance sheet account, it contributes to net profit
          if (!bsAccountIds.has(item.account_id)) {
            netProfit += (item.credit - item.debit);
          }
        });
      }
    });

    // Calculate Balance Sheet Accounts
    const bsAccounts = accounts.filter(account => bsAccountIds.has(account.id));

    const results = bsAccounts.map(account => {
      let balance = account.opening_balance || 0;
      entries.forEach(entry => {
        const entryDate = new Date(entry.date);
        if (entryDate <= targetDate) {
          entry.items?.forEach(item => {
            if (item.account_id === account.id) {
              // Standard accounting: Assets are positive (Debit - Credit), 
              // Liabilities/Equity are negative (Debit - Credit) or we can flip them.
              // Let's keep Debit - Credit for all and handle display.
              balance += (item.debit - item.credit);
            }
          });
        }
      });

      const type = accountTypes.find(t => t.id === account.type_id);
      return {
        ...account,
        balance,
        classification: type?.classification
      };
    }).filter(a => a.balance !== 0);

    const assets = results.filter(a => a.classification === 'asset');
    const liabilitiesEquity = results.filter(a => a.classification === 'liability_equity');

    const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
    // Liabilities and Equity normally have credit balances (negative in our Debit-Credit calc)
    // So we subtract them (which adds their absolute value) and add net profit (which is also credit-based)
    const totalLiabilitiesEquity = liabilitiesEquity.reduce((sum, a) => sum + (a.balance * -1), 0) + netProfit;

    // Diagnostics: Check for unbalanced entries or entries with missing accounts
    let globalDebit = 0;
    let globalCredit = 0;
    const unbalancedEntries: string[] = [];
    const missingAccountEntries: string[] = [];

    entries.forEach(entry => {
      const entryDate = new Date(entry.date);
      if (entryDate <= targetDate) {
        let entryDebit = 0;
        let entryCredit = 0;
        entry.items?.forEach(item => {
          entryDebit += item.debit;
          entryCredit += item.credit;
          globalDebit += item.debit;
          globalCredit += item.credit;

          // Check if account exists
          if (!accounts.find(a => a.id === item.account_id)) {
            missingAccountEntries.push(`${entry.description || t('common.no_description')} (${t('common.entry_no')}: ${entry.id.slice(-5)})`);
          }
        });

        if (Math.abs(entryDebit - entryCredit) > 0.01) {
          unbalancedEntries.push(`${entry.description || t('common.no_description')} (${t('common.difference')}: ${entryDebit - entryCredit})`);
        }
      }
    });

    return { 
      assets, 
      liabilitiesEquity, 
      netProfit, 
      totalAssets, 
      totalLiabilitiesEquity,
      diagnostics: {
        globalDebit,
        globalCredit,
        globalDiff: globalDebit - globalCredit,
        unbalancedEntries: Array.from(new Set(unbalancedEntries)),
        missingAccountEntries: Array.from(new Set(missingAccountEntries))
      }
    };
  };

  const data = calculateBalanceSheet();

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
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
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
          <div className="bg-white border border-zinc-200 rounded-[2.5rem] overflow-hidden shadow-sm">
            <div className={`px-8 py-6 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
              <h3 className={`font-black text-emerald-700 flex items-center gap-3 text-lg ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                <Wallet size={24} />
                {t('balance_sheet.assets')}
              </h3>
              <span className="text-2xl font-black text-emerald-600">{data.totalAssets.toLocaleString()}</span>
            </div>
            <div className="p-4 space-y-2">
              {data.assets.map(a => (
                <div key={a.id} className={`flex items-center justify-between p-4 hover:bg-zinc-50 rounded-2xl transition-all ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                  <span className="font-bold text-zinc-600">{a.name}</span>
                  <span className="font-black text-zinc-900">{a.balance.toLocaleString()}</span>
                </div>
              ))}
              {data.assets.length === 0 && (
                <p className="p-8 text-center text-zinc-400 font-medium">{t('balance_sheet.no_assets')}</p>
              )}
            </div>
          </div>
        </div>

        {/* Liabilities & Equity Section */}
        <div className="space-y-6">
          <div className="bg-white border border-zinc-200 rounded-[2.5rem] overflow-hidden shadow-sm">
            <div className={`px-8 py-6 bg-rose-50 border-b border-rose-100 flex items-center justify-between ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
              <h3 className={`font-black text-rose-700 flex items-center gap-3 text-lg ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                <CreditCard size={24} />
                {t('balance_sheet.liabilities_equity')}
              </h3>
              <span className="text-2xl font-black text-rose-600">{data.totalLiabilitiesEquity.toLocaleString()}</span>
            </div>
            <div className="p-4 space-y-2">
              {data.liabilitiesEquity.map(a => (
                <div key={a.id} className={`flex items-center justify-between p-4 hover:bg-zinc-50 rounded-2xl transition-all ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                  <span className="font-bold text-zinc-600">{a.name}</span>
                  <span className="font-black text-zinc-900">{Math.abs(a.balance).toLocaleString()}</span>
                </div>
              ))}
              <div className={`flex items-center justify-between p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                <span className="font-bold text-emerald-700">{t('balance_sheet.net_profit_period')}</span>
                <span className="font-black text-emerald-600">{data.netProfit.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Balance Check */}
          <div className={`p-8 rounded-[2.5rem] border-2 flex items-center justify-between shadow-lg ${
            Math.abs(data.totalAssets - data.totalLiabilitiesEquity) < 0.01 
              ? 'bg-emerald-500 border-emerald-400 text-white shadow-emerald-500/20' 
              : 'bg-rose-500 border-rose-400 text-white shadow-rose-500/20'
          }`}>
            <div className={`flex items-center gap-4 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse text-left'}`}>
              <Shield size={32} />
              <div>
                <p className="font-black text-xl">{t('balance_sheet.check_title')}</p>
                <p className="text-sm opacity-80 font-bold">
                  {Math.abs(data.totalAssets - data.totalLiabilitiesEquity) < 0.01 
                    ? t('balance_sheet.balanced_msg') 
                    : `${t('balance_sheet.unbalanced_msg')} ${(data.totalAssets - data.totalLiabilitiesEquity).toLocaleString()}`}
                </p>
              </div>
            </div>
            <div className={`${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
              <p className="text-xs font-black uppercase tracking-widest opacity-60">{t('balance_sheet.difference')}</p>
              <p className="text-2xl font-black">{(data.totalAssets - data.totalLiabilitiesEquity).toLocaleString()}</p>
            </div>
          </div>

          {/* Diagnostics Section */}
          {Math.abs(data.totalAssets - data.totalLiabilitiesEquity) >= 0.01 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-8 rounded-[2.5rem] bg-amber-50 border-2 border-amber-200 space-y-4"
            >
              <div className={`flex items-center gap-3 text-amber-800 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                <Filter size={24} />
                <h4 className="font-black text-lg">{t('balance_sheet.diagnostics_title')}</h4>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-white rounded-2xl border border-amber-100">
                  <p className="text-xs font-bold text-zinc-500 mb-1">{t('balance_sheet.total_debit_all')}</p>
                  <p className="text-xl font-black text-zinc-900">{data.diagnostics.globalDebit.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-amber-100">
                  <p className="text-xs font-bold text-zinc-500 mb-1">{t('balance_sheet.total_credit_all')}</p>
                  <p className="text-xl font-black text-zinc-900">{data.diagnostics.globalCredit.toLocaleString()}</p>
                </div>
              </div>

              {data.diagnostics.unbalancedEntries.length > 0 && (
                <div className="space-y-2">
                  <p className={`text-sm font-black text-rose-600 flex items-center gap-2 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                    <ArrowLeftRight size={16} />
                    {t('balance_sheet.unbalanced_entries')}
                  </p>
                  <ul className={`list-disc list-inside text-sm text-zinc-600 font-medium space-y-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                    {data.diagnostics.unbalancedEntries.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}

              {data.diagnostics.missingAccountEntries.length > 0 && (
                <div className="space-y-2">
                  <p className={`text-sm font-black text-rose-600 flex items-center gap-2 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                    <Search size={16} />
                    {t('balance_sheet.missing_accounts')}
                  </p>
                  <ul className={`list-disc list-inside text-sm text-zinc-600 font-medium space-y-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                    {data.diagnostics.missingAccountEntries.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-xs text-amber-700 font-bold bg-amber-100/50 p-3 rounded-xl">
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
