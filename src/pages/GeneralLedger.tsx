import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { dbService } from '../services/dbService';
import { JournalEntry, Account, Customer, Supplier } from '../types';
import { Search, Calendar, FileText, Download, Printer, Filter, BookOpen, ArrowLeftRight, User, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { exportToPDF } from '../utils/pdfUtils';
import { exportToExcel } from '../utils/excelUtils';

export const GeneralLedger: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const reportRef = useRef<HTMLDivElement>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [startBalance, setStartBalance] = useState(0);

  useEffect(() => {
    if (!user) return;

    const unsubscribeEntries = dbService.subscribe<JournalEntry>('journal_entries', user.company_id, (data) => {
      setEntries(data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
      setLoading(false);
    });

    const unsubscribeAccounts = dbService.subscribe<Account>('accounts', user.company_id, setAccounts);
    const unsubscribeCustomers = dbService.subscribe<Customer>('customers', user.company_id, setCustomers);
    const unsubscribeSuppliers = dbService.subscribe<Supplier>('suppliers', user.company_id, setSuppliers);

    return () => {
      unsubscribeEntries();
      unsubscribeAccounts();
      unsubscribeCustomers();
      unsubscribeSuppliers();
    };
  }, [user]);

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);
  const isCustomerAccount = selectedAccount?.name.includes('عملاء') || selectedAccount?.name.includes('العملاء');
  const isSupplierAccount = selectedAccount?.name.includes('موردين') || selectedAccount?.name.includes('الموردين');

  const accountTransactions = entries.flatMap(entry => 
    (entry.items || [])
      .filter(item => {
        const matchesAccount = item.account_id === selectedAccountId;
        if (!matchesAccount) return false;

        if (selectedEntityIds.length > 0) {
          return selectedEntityIds.includes(item.customer_id || '') || 
                 selectedEntityIds.includes(item.supplier_id || '');
        }
        return true;
      })
      .map(item => ({
        ...item,
        date: entry.date,
        description: item.description || entry.description,
        reference_number: entry.reference_number,
        reference_type: entry.reference_type,
        customer_name: item.customer_name,
        supplier_name: item.supplier_name,
        entry_id: entry.id
      }))
  );

  const filteredTransactions = accountTransactions.filter(tx => {
    const txDate = new Date(tx.date);
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    endDate.setHours(23, 59, 59, 999);
    return txDate >= startDate && txDate <= endDate;
  });

  // Calculate Running Balance including opening balance and transactions before start date
  useEffect(() => {
    if (selectedAccountId) {
      const account = accounts.find(a => a.id === selectedAccountId);
      const opBal = account?.opening_balance || 0;
      
      const transactionsBefore = accountTransactions.filter(tx => {
        const txDate = new Date(tx.date);
        const startDate = new Date(dateRange.start);
        return txDate < startDate;
      });
      
      const balBefore = transactionsBefore.reduce((sum, tx) => sum + (tx.debit - tx.credit), 0);
      setStartBalance(opBal + balBefore);
    }
  }, [selectedAccountId, accountTransactions, dateRange.start, accounts]);

  let runningBalance = startBalance;
  const transactionsWithBalance = filteredTransactions.map(tx => {
    runningBalance += (tx.debit - tx.credit);
    return { ...tx, balance: runningBalance };
  });

  const totals = transactionsWithBalance.reduce((acc, tx) => ({
    debit: acc.debit + tx.debit,
    credit: acc.credit + tx.credit
  }), { 
    debit: startBalance > 0 ? startBalance : 0, 
    credit: startBalance < 0 ? Math.abs(startBalance) : 0 
  });

  const handleExportPDF = async () => {
    if (reportRef.current) {
      const account = accounts.find(a => a.id === selectedAccountId);
      await exportToPDF(reportRef.current, { 
        filename: `General_Ledger_${account?.name || 'Account'}`, 
        orientation: 'landscape',
        reportTitle: `${t('ledger.title')}: ${account?.name || ''}`
      });
    }
  };

  const handleExportExcel = () => {
    const account = accounts.find(a => a.id === selectedAccountId);
    const data = transactionsWithBalance.map(tx => ({
      [t('journal.column_date')]: tx.date,
      [t('ledger.column_entity')]: tx.customer_name || tx.supplier_name || '-',
      [t('journal.column_description')]: tx.description,
      [t('journal.column_reference')]: tx.reference_number || '-',
      [t('journal.column_debit')]: tx.debit,
      [t('journal.column_credit')]: tx.credit,
      [t('ledger.column_balance')]: tx.balance
    }));
    exportToExcel(data, { filename: `General_Ledger_${account?.name || 'Account'}` });
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
          <h2 className="text-2xl font-black text-zinc-900">{t('ledger.title')}</h2>
          <p className="text-zinc-500 font-medium mt-1">{t('ledger.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportPDF} disabled={!selectedAccountId} className="p-2.5 bg-white border border-zinc-200 text-zinc-600 rounded-xl hover:bg-zinc-50 transition-all shadow-sm disabled:opacity-50"><Printer size={20} /></button>
          <button onClick={handleExportExcel} disabled={!selectedAccountId} className="p-2.5 bg-white border border-zinc-200 text-zinc-600 rounded-xl hover:bg-zinc-50 transition-all shadow-sm disabled:opacity-50"><Download size={20} /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 relative">
          <BookOpen className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={20} />
          <select
            className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium appearance-none`}
            value={selectedAccountId}
            onChange={(e) => {
              setSelectedAccountId(e.target.value);
            }}
          >
            <option value="">{t('ledger.select_account')}</option>
            {accounts.map(account => (
              <option key={account.id} value={account.id}>
                {account.code} - {account.name}
              </option>
            ))}
          </select>
        </div>
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

      <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm space-y-4">
        <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
          <div className={`flex items-center gap-2 text-zinc-600 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
            <Users size={20} className="text-emerald-500" />
            <span className="font-bold">{t('ledger.filter_entities')}</span>
          </div>
          {selectedEntityIds.length > 0 && (
            <button 
              onClick={() => setSelectedEntityIds([])}
              className="text-xs font-black text-rose-500 hover:text-rose-600 transition-colors flex items-center gap-1"
            >
              {t('ledger.deselect_all')} ({selectedEntityIds.length})
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className={`text-xs font-bold text-zinc-400 uppercase tracking-tighter flex items-center gap-1 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
              <User size={14} /> {t('nav.customers')}
            </label>
            <div className={`flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-zinc-200 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
              {customers.map(entity => (
                <button
                  key={entity.id}
                  onClick={() => {
                    setSelectedEntityIds(prev => 
                      prev.includes(entity.id) 
                        ? prev.filter(id => id !== entity.id)
                        : [...prev, entity.id]
                    );
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    selectedEntityIds.includes(entity.id)
                      ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                      : 'bg-zinc-50 text-zinc-600 border-zinc-100 hover:border-zinc-200'
                  }`}
                >
                  {entity.name}
                </button>
              ))}
              {customers.length === 0 && <p className="text-xs text-zinc-400 italic">{t('ledger.no_customers')}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <label className={`text-xs font-bold text-zinc-400 uppercase tracking-tighter flex items-center gap-1 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
              <Users size={14} /> {t('nav.suppliers')}
            </label>
            <div className={`flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-zinc-200 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
              {suppliers.map(entity => (
                <button
                  key={entity.id}
                  onClick={() => {
                    setSelectedEntityIds(prev => 
                      prev.includes(entity.id) 
                        ? prev.filter(id => id !== entity.id)
                        : [...prev, entity.id]
                    );
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    selectedEntityIds.includes(entity.id)
                      ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                      : 'bg-zinc-50 text-zinc-600 border-zinc-100 hover:border-zinc-200'
                  }`}
                >
                  {entity.name}
                </button>
              ))}
              {suppliers.length === 0 && <p className="text-xs text-zinc-400 italic">{t('ledger.no_suppliers')}</p>}
            </div>
          </div>
        </div>
      </div>

      {!selectedAccountId ? (
        <div className="bg-white border border-zinc-200 rounded-3xl p-12 text-center">
          <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-400 mx-auto mb-4">
            <BookOpen size={32} />
          </div>
          <h3 className="text-lg font-bold text-zinc-900">{t('ledger.please_select')}</h3>
          <p className="text-zinc-500 font-medium">{t('ledger.select_hint')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
              <p className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-1">{t('ledger.total_debit')}</p>
              <p className="text-2xl font-black text-emerald-600">{totals.debit.toLocaleString()}</p>
            </div>
            <div className={`bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
              <p className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-1">{t('ledger.total_credit')}</p>
              <p className="text-2xl font-black text-rose-600">{totals.credit.toLocaleString()}</p>
            </div>
            <div className={`bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
              <p className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-1">{t('ledger.final_balance')}</p>
              <p className={`text-2xl font-black ${runningBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {runningBalance.toLocaleString()}
              </p>
            </div>
          </div>

          <div ref={reportRef} className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'} border-collapse`}>
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200">
                    <th className="px-6 py-4 text-sm font-bold text-zinc-700">{t('journal.column_date')}</th>
                    <th className="px-6 py-4 text-sm font-bold text-zinc-700">{t('ledger.column_entity')}</th>
                    <th className="px-6 py-4 text-sm font-bold text-zinc-700">{t('journal.column_description')}</th>
                    <th className="px-6 py-4 text-sm font-bold text-zinc-700">{t('journal.column_reference')}</th>
                    <th className="px-6 py-4 text-sm font-bold text-zinc-700 text-center">{t('journal.column_debit')}</th>
                    <th className="px-6 py-4 text-sm font-bold text-zinc-700 text-center">{t('journal.column_credit')}</th>
                    <th className="px-6 py-4 text-sm font-bold text-zinc-700 text-center">{t('ledger.column_balance')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {/* Opening Balance Row */}
                  <tr className="bg-zinc-50/50">
                    <td className="px-6 py-4 text-sm font-bold text-zinc-900">{dateRange.start}</td>
                    <td className="px-6 py-4 text-sm text-zinc-400">-</td>
                    <td className="px-6 py-4 text-sm font-medium text-zinc-600">{t('ledger.opening_balance_row')}</td>
                    <td className="px-6 py-4 text-sm text-zinc-400 text-center">-</td>
                    <td className="px-6 py-4 text-sm font-black text-emerald-600 text-center">{startBalance > 0 ? startBalance.toLocaleString() : '-'}</td>
                    <td className="px-6 py-4 text-sm font-black text-rose-600 text-center">{startBalance < 0 ? Math.abs(startBalance).toLocaleString() : '-'}</td>
                    <td className="px-6 py-4 text-sm font-black text-zinc-900 text-center">{startBalance.toLocaleString()}</td>
                  </tr>
                  {transactionsWithBalance.map((tx, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-bold text-zinc-900">{tx.date}</td>
                      <td className="px-6 py-4 text-sm font-bold text-emerald-600">
                        {tx.customer_name || tx.supplier_name || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-zinc-600 max-w-xs truncate">
                        {tx.description}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-zinc-100 text-zinc-600 rounded-lg text-xs font-bold">
                          {tx.reference_number || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-black text-emerald-600 text-center">{tx.debit > 0 ? tx.debit.toLocaleString() : '-'}</td>
                      <td className="px-6 py-4 text-sm font-black text-rose-600 text-center">{tx.credit > 0 ? tx.credit.toLocaleString() : '-'}</td>
                      <td className="px-6 py-4 text-sm font-black text-zinc-900 text-center">{tx.balance.toLocaleString()}</td>
                    </tr>
                  ))}
                  {transactionsWithBalance.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-zinc-500 font-medium">
                        {t('ledger.no_transactions')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
