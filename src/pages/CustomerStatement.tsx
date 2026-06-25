import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Customer, Invoice, ReceiptVoucher, Return } from '../types';
import { Search, FileText, Download, Calendar, User, ArrowUpRight, ArrowDownLeft, RefreshCcw } from 'lucide-react';
import { exportToPDF } from '../utils/pdfUtils';
import { exportToExcel } from '../utils/excelUtils';
import { dbService } from '../services/dbService';
import { formatNumber, formatMoney, formatDate, isCustomerAccount } from '../utils/formatUtils';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigation } from '../contexts/NavigationContext';

interface StatementEntry {
  id: string;
  date: string;
  type: string;
  reference: string;
  entry_number?: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export const CustomerStatement: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { setCurrentPage, setPendingViewDoc } = useNavigation();
  const [customers, setCustomers] = useState<Customer[]>([]);

  const handleTransactionClick = (type: string, reference: string) => {
    if (!reference || reference === '-') return;
    
    if (reference.startsWith('SET-')) {
      setPendingViewDoc({ type: 'settlement', idOrNumber: reference });
      setCurrentPage('customer_settlements');
      return;
    }
    
    if (type === 'invoice') {
      setPendingViewDoc({ type: 'invoice', idOrNumber: reference });
      setCurrentPage('invoices');
    } else if (type === 'receipt' || type === 'receipt_voucher') {
      setPendingViewDoc({ type: 'receipt', idOrNumber: reference });
      setCurrentPage('receipts');
    } else if (type === 'payment_voucher' || type === 'payment') {
      setPendingViewDoc({ type: 'payment_voucher', idOrNumber: reference });
      setCurrentPage('payment_vouchers');
    } else if (type === 'return') {
      setPendingViewDoc({ type: 'return', idOrNumber: reference });
      setCurrentPage('returns');
    } else if (type === 'journal' || type === 'manual') {
      setPendingViewDoc({ type: 'manual', idOrNumber: reference });
      setCurrentPage('journal_entries');
    }
  };
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [entries, setEntries] = useState<StatementEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<Customer | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      const unsub = dbService.subscribe<Customer>('customers', user.company_id, setCustomers);
      return () => unsub();
    }
  }, [user]);

  // Auto-run statement generation if redirected from balances report
  useEffect(() => {
    if (user && customers.length > 0) {
      const savedCustId = sessionStorage.getItem('customer_statement_filter_customer_id');
      const savedStart = sessionStorage.getItem('customer_statement_filter_start_date');
      const savedEnd = sessionStorage.getItem('customer_statement_filter_end_date');
      
      if (savedCustId) {
        setSelectedCustomerId(savedCustId);
        setStartDate(savedStart || '');
        setEndDate(savedEnd || new Date().toISOString().slice(0, 10));
        
        sessionStorage.removeItem('customer_statement_filter_customer_id');
        sessionStorage.removeItem('customer_statement_filter_start_date');
        sessionStorage.removeItem('customer_statement_filter_end_date');
        
        const runAutoGenerate = async () => {
          setLoading(true);
          const customer = customers.find(c => c.id === savedCustId) || null;
          setCustomerInfo(customer);
          try {
            const [invoices, receipts, returns, discounts, journalEntries, accounts] = await Promise.all([
              dbService.list<Invoice>('invoices', user.company_id),
              dbService.list<ReceiptVoucher>('receipt_vouchers', user.company_id),
              dbService.list<Return>('returns', user.company_id),
              dbService.list<any>('customer_discounts', user.company_id),
              dbService.list<any>('journal_entries', user.company_id),
              dbService.list<any>('accounts', user.company_id)
            ]);

            const invoicesMap = invoices.reduce((acc, inv) => { acc[inv.invoice_number] = inv; return acc; }, {} as Record<string, Invoice>);
            const receiptsMap = receipts.reduce((acc, r) => { if (r.voucher_number) acc[r.voucher_number] = r; return acc; }, {} as Record<string, ReceiptVoucher>);
            const returnsMap = returns.reduce((acc, ret) => { acc[ret.return_number] = ret; return acc; }, {} as Record<string, Return>);

            let allEntries: any[] = [];
            journalEntries.forEach((je: any) => {
              je.items?.forEach((item: any) => {
                const matchesEntity = item.customer_id === savedCustId || item.sub_account_id === savedCustId;
                if (matchesEntity && isCustomerAccount(item.account_id, customer, accounts)) {
                  let description = item.description || je.description || (language === 'ar' ? 'قيد مالي' : 'Journal Entry');
                  let mappedType = je.reference_type || 'journal';
                  if (mappedType === 'receipt') mappedType = 'receipt_voucher';

                  if (je.reference_type === 'invoice' && je.reference_number) {
                    const inv = invoicesMap[je.reference_number];
                    description = inv?.description || (language === 'ar' ? 'فاتورة مبيعات' : 'Sales Invoice');
                  } else if ((je.reference_type === 'receipt' || je.reference_type === 'receipt_voucher') && je.reference_number) {
                    const rect = receiptsMap[je.reference_number];
                    description = rect?.description || (language === 'ar' ? 'سند قبض' : 'Receipt Voucher');
                  } else if (je.reference_type === 'return' && je.reference_number) {
                    const ret = returnsMap[je.reference_number];
                    description = ret?.description || ret?.notes || (language === 'ar' ? 'مرتجع مبيعات' : 'Sales Return');
                  }

                  allEntries.push({
                    id: `je-${je.id}-${Math.random()}`,
                    date: je.date,
                    type: mappedType,
                    reference: je.reference_number || '-',
                    entry_number: je.entry_number || '',
                    description: description,
                    debit: item.debit || 0,
                    credit: item.credit || 0,
                    balance: 0
                  });
                }
              });
            });

            allEntries.sort((a, b) => {
              const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
              if (dateDiff !== 0) return dateDiff;
              return a.id.localeCompare(b.id);
            });

            const customerOpBal = Number(customer?.opening_balance || 0);
            const hasOpeningBalanceInEntries = allEntries.some(e => e.type === 'opening_balance' || e.description.includes('رصيد افتتاحي') || e.description.includes('Opening Balance'));
            const manualOpBal = hasOpeningBalanceInEntries ? 0 : customerOpBal;
            let balanceForward = 0;
            let filteredEntries = allEntries;
            const finalAllEntries = [];

            const startVal = savedStart || '';
            const endVal = savedEnd || new Date().toISOString().slice(0, 10);

            if (startVal) {
              const entriesBefore = allEntries.filter(e => (e.date || '').slice(0, 10) < startVal);
              balanceForward = manualOpBal + entriesBefore.reduce((sum, e) => sum + (Number(e.debit || 0) - Number(e.credit || 0)), 0);
              filteredEntries = allEntries.filter(e => (e.date || '').slice(0, 10) >= startVal);
              
              finalAllEntries.push({
                id: 'balance-forward',
                date: startVal,
                type: 'opening_balance',
                reference: '-',
                description: language === 'ar' ? 'رصيد منقول' : 'Balance Forward',
                debit: balanceForward > 0 ? balanceForward : 0,
                credit: balanceForward < 0 ? Math.abs(balanceForward) : 0,
                balance: balanceForward
              });
            } else {
              if (manualOpBal !== 0) {
                finalAllEntries.push({
                  id: 'opening-balance',
                  date: allEntries[0]?.date || new Date().toISOString().slice(0, 10),
                  type: 'opening_balance',
                  reference: '-',
                  description: language === 'ar' ? 'رصيد افتتاحي' : 'Opening Balance',
                  debit: manualOpBal > 0 ? manualOpBal : 0,
                  credit: manualOpBal < 0 ? Math.abs(manualOpBal) : 0,
                  balance: manualOpBal
                });
                balanceForward = manualOpBal;
              }
            }

            let currentBalance = balanceForward;
            const finalEntries = filteredEntries.filter(e => !endVal || (e.date || '').slice(0, 10) <= endVal).map(entry => {
              currentBalance += (entry.debit - entry.credit);
              return { ...entry, balance: currentBalance };
            });

            setEntries([...finalAllEntries, ...finalEntries]);
          } catch (e) {
            console.error(e);
          } finally {
            setLoading(false);
          }
        };
        runAutoGenerate();
      }
    }
  }, [user, customers]);

  const generateStatement = async () => {
    if (!selectedCustomerId || !user) return;
    setLoading(true);
    const customer = customers.find(c => c.id === selectedCustomerId) || null;
    setCustomerInfo(customer);
    try {
      const [invoices, receipts, returns, discounts, journalEntries, accounts] = await Promise.all([
        dbService.list<Invoice>('invoices', user.company_id),
        dbService.list<ReceiptVoucher>('receipt_vouchers', user.company_id),
        dbService.list<Return>('returns', user.company_id),
        dbService.list<any>('customer_discounts', user.company_id),
        dbService.list<any>('journal_entries', user.company_id),
        dbService.list<any>('accounts', user.company_id)
      ]);

      // Create maps for efficient lookups
      const invoicesMap = invoices.reduce((acc, inv) => {
        acc[inv.invoice_number] = inv;
        return acc;
      }, {} as Record<string, Invoice>);

      const receiptsMap = receipts.reduce((acc, r) => {
        if (r.voucher_number) acc[r.voucher_number] = r;
        return acc;
      }, {} as Record<string, ReceiptVoucher>);

      const returnsMap = returns.reduce((acc, ret) => {
        acc[ret.return_number] = ret;
        return acc;
      }, {} as Record<string, Return>);

      let allEntries: any[] = [];

      // Add all journal entries related to this customer's account
      journalEntries.forEach((je: any) => {
        je.items?.forEach((item: any) => {
          // Only count lines that have the customer_id AND match the customer's ledger account
          // This prevents double entries if customer_id was accidentally set on both sides of a transaction
          const matchesEntity = item.customer_id === selectedCustomerId || item.sub_account_id === selectedCustomerId;
          if (matchesEntity && isCustomerAccount(item.account_id, customer, accounts)) {
            let description = item.description || je.description || (language === 'ar' ? 'قيد مالي' : 'Journal Entry');
            let mappedType = je.reference_type || 'journal';
            if (mappedType === 'receipt') mappedType = 'receipt_voucher';

            if (je.reference_type === 'invoice' && je.reference_number) {
              const inv = invoicesMap[je.reference_number];
              description = inv?.description || (language === 'ar' ? 'فاتورة مبيعات' : 'Sales Invoice');
            } else if ((je.reference_type === 'receipt' || je.reference_type === 'receipt_voucher') && je.reference_number) {
              const rect = receiptsMap[je.reference_number];
              description = rect?.description || (language === 'ar' ? 'سند قبض' : 'Receipt Voucher');
            } else if (je.reference_type === 'return' && je.reference_number) {
              const ret = returnsMap[je.reference_number];
              description = ret?.description || ret?.notes || (language === 'ar' ? 'مرتجع مبيعات' : 'Sales Return');
            }

            allEntries.push({
              id: `je-${je.id}-${Math.random()}`,
              date: je.date,
              type: mappedType,
              reference: je.reference_number || '-',
              entry_number: je.entry_number || '',
              description: description,
              debit: item.debit || 0,
              credit: item.credit || 0,
              balance: 0
            });
          }
        });
      });

      // Sort by date and then by ID to ensure consistent order
      allEntries.sort((a, b) => {
        const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return a.id.localeCompare(b.id);
      });

      // Calculate balance forward for date filtering
      const customerOpBal = Number(customer?.opening_balance || 0);
      const hasOpeningBalanceInEntries = allEntries.some(e => 
        e.type === 'opening_balance' || 
        e.description.includes('رصيد افتتاحي') ||
        e.description.includes('Opening Balance')
      );
      
      const manualOpBal = hasOpeningBalanceInEntries ? 0 : customerOpBal;
      let balanceForward = 0;
      let filteredEntries = allEntries;
      const finalAllEntries = [];

      if (startDate) {
        const entriesBefore = allEntries.filter(e => (e.date || '').slice(0, 10) < startDate);
        balanceForward = manualOpBal + entriesBefore.reduce((sum, e) => sum + (Number(e.debit || 0) - Number(e.credit || 0)), 0);
        filteredEntries = allEntries.filter(e => (e.date || '').slice(0, 10) >= startDate);
        
        // Always add balance forward (as "carried over" balance)
        finalAllEntries.push({
          id: 'balance-forward',
          date: startDate,
          type: 'opening_balance',
          reference: '-',
          description: language === 'ar' ? 'رصيد منقول' : 'Balance Forward',
          debit: balanceForward > 0 ? balanceForward : 0,
          credit: balanceForward < 0 ? Math.abs(balanceForward) : 0,
          balance: balanceForward
        });
      } else {
        if (manualOpBal !== 0) {
          finalAllEntries.push({
            id: 'opening-balance',
            date: allEntries[0]?.date || new Date().toISOString().slice(0, 10),
            type: 'opening_balance',
            reference: '-',
            description: language === 'ar' ? 'رصيد افتتاحي' : 'Opening Balance',
            debit: manualOpBal > 0 ? manualOpBal : 0,
            credit: manualOpBal < 0 ? Math.abs(manualOpBal) : 0,
            balance: manualOpBal
          });
          balanceForward = manualOpBal;
        }
      }

      // Calculate running balance
      let currentBalance = balanceForward;
      const finalEntries = filteredEntries.filter(e => !endDate || (e.date || '').slice(0, 10) <= endDate).map(entry => {
        currentBalance += (entry.debit - entry.credit);
        return { ...entry, balance: currentBalance };
      });

      setEntries([...finalAllEntries, ...finalEntries]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const formatBalance = (balance: number) => {
    if (balance === 0) return '0';
    return balance > 0 ? `+${formatNumber(balance)}` : formatNumber(balance);
  };

  const handleExportExcel = () => {
    if (entries.length === 0 || !customerInfo) return;
    
    const data = entries.map(entry => ({
      [language === 'ar' ? 'التاريخ' : 'Date']: entry.date,
      [language === 'ar' ? 'النوع' : 'Type']: entry.type,
      [language === 'ar' ? 'رقم القيد' : 'Entry No.']: entry.entry_number || '-',
      [language === 'ar' ? 'المرجع' : 'Reference']: entry.reference,
      [language === 'ar' ? 'البيان' : 'Description']: entry.description,
      [language === 'ar' ? 'مدين (+)' : 'Debit (+)']: entry.debit,
      [language === 'ar' ? 'دائن (-)' : 'Credit (-)']: entry.credit,
      [language === 'ar' ? 'الرصيد' : 'Balance']: entry.balance
    }));
    
    exportToExcel(data, { 
      filename: `statement_${customerInfo.name}_${new Date().toISOString().slice(0,10)}`,
      sheetName: language === 'ar' ? 'كشف الحساب' : 'Statement'
    });
  };

  const handleExportPDF = async () => {
    if (!reportRef.current || !customerInfo) return;
    try {
      await exportToPDF(reportRef.current, {
        filename: `statement_${customerInfo.name}_${new Date().toISOString().slice(0,10)}.pdf`,
        orientation: 'landscape',
        reportTitle: `${language === 'ar' ? 'كشف حساب عميل' : 'Customer Account Statement'} - ${customerInfo.name}`
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">{t('nav.customer_statement')}</h2>
          <p className="text-zinc-500">{language === 'ar' ? 'عرض الحركات المالية والارصدة لكل عميل.' : 'View financial movements and balances for each customer.'}</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-1">
            <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('discounts.column_customer')}</label>
            <div className="relative">
              <User className="absolute left-3 top-3 text-zinc-400" size={18} />
              <select 
                className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
              >
                <option value="">{t('settlements.select_customer')}</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>{customer.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{language === 'ar' ? 'من تاريخ' : 'From Date'}</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 text-zinc-400" size={18} />
              <input 
                type="date" 
                className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{language === 'ar' ? 'إلى تاريخ' : 'To Date'}</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 text-zinc-400" size={18} />
              <input 
                type="date" 
                className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={generateStatement}
              disabled={loading || !selectedCustomerId}
              className="flex-grow flex items-center justify-center gap-2 px-6 py-2 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-all disabled:opacity-50 h-[42px] font-bold text-sm"
            >
              {loading ? t('common.loading') : (language === 'ar' ? 'عرض التقرير' : 'View Report')}
            </button>
            <button 
              onClick={generateStatement}
              disabled={loading || !selectedCustomerId}
              className="p-2.5 bg-white border border-zinc-200 text-zinc-600 rounded-xl hover:bg-zinc-50 hover:text-emerald-600 transition-all active:scale-95 shadow-sm disabled:opacity-50 h-[42px] flex items-center justify-center"
              title={language === 'ar' ? 'تحديث البيانات' : 'Refresh Data'}
            >
              <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {entries.length > 0 && (
          <div className="space-y-4">
            <div className="flex justify-end gap-2">
              <button 
                onClick={handleExportExcel}
                className="flex items-center gap-2 px-4 py-2 text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 transition-all"
              >
                <Download size={18} />
                {language === 'ar' ? 'تصدير Excel' : 'Export Excel'}
              </button>
              <button 
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-4 py-2 text-emerald-600 border border-emerald-200 rounded-xl hover:bg-emerald-50 transition-all"
              >
                <Download size={18} />
                {language === 'ar' ? 'تصدير PDF' : 'Export PDF'}
              </button>
            </div>

            <div ref={reportRef} className="bg-white p-8 border border-zinc-100 rounded-2xl">
              <div className="text-center mb-8 border-b border-zinc-100 pb-6">
                <h3 className="text-2xl font-bold text-zinc-900 mb-2">{language === 'ar' ? 'كشف حساب عميل' : 'Customer Account Statement'}</h3>
                <div className="flex justify-center gap-8 text-sm text-zinc-500">
                  <p>{language === 'ar' ? 'العميل:' : 'Customer:'} <span className="font-bold text-zinc-900">{customerInfo?.name}</span></p>
                  <p>{language === 'ar' ? 'الفترة:' : 'Period:'} <span className="font-bold text-zinc-900">{startDate || (language === 'ar' ? 'البداية' : 'Start')}</span> {language === 'ar' ? 'إلى' : 'to'} <span className="font-bold text-zinc-900">{endDate}</span></p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 border-y border-zinc-100">
                      <th className="px-4 py-3 text-sm font-bold text-zinc-700">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                      <th className="px-4 py-3 text-sm font-bold text-zinc-700">{language === 'ar' ? 'النوع' : 'Type'}</th>
                      <th className="px-4 py-3 text-sm font-bold text-zinc-700">{language === 'ar' ? 'رقم القيد' : 'Entry No.'}</th>
                      <th className="px-4 py-3 text-sm font-bold text-zinc-700">{language === 'ar' ? 'المرجع' : 'Reference'}</th>
                      <th className="px-4 py-3 text-sm font-bold text-zinc-700">{language === 'ar' ? 'البيان' : 'Description'}</th>
                      <th className="px-4 py-3 text-sm font-bold text-zinc-700">{language === 'ar' ? 'مدين' : 'Debit'}</th>
                      <th className="px-4 py-3 text-sm font-bold text-zinc-700">{language === 'ar' ? 'دائن' : 'Credit'}</th>
                      <th className="px-4 py-3 text-sm font-bold text-zinc-700">{language === 'ar' ? 'الرصيد' : 'Balance'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.id} className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors">
                        <td className="px-4 py-3 text-sm font-mono">{formatDate(entry.date)}</td>
                        <td className="px-4 py-3 text-sm">
                          <span 
                            onClick={() => handleTransactionClick(entry.type, entry.reference)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer hover:scale-105 transition-transform inline-block ${
                              entry.type === 'invoice' ? (entry.credit > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600') :
                              entry.type === 'receipt' ? 'bg-amber-50 text-amber-600' :
                              entry.type === 'receipt_voucher' ? 'bg-amber-50 text-amber-600' :
                              entry.type === 'return' ? 'bg-emerald-50 text-emerald-600' :
                              entry.type === 'journal' ? 'bg-blue-50 text-blue-600' :
                              entry.type === 'manual' ? 'bg-blue-50 text-blue-600' :
                              entry.type === 'opening_balance' ? 'bg-zinc-100 text-zinc-600' :
                              'bg-zinc-100 text-zinc-600'
                            }`}
                          >
                            {entry.type === 'invoice' ? (entry.credit > 0 ? (language === 'ar' ? 'سداد نقدي' : 'Cash Payment') : (language === 'ar' ? 'فاتورة مبيعات' : 'Sales Invoice')) :
                             entry.type === 'receipt' ? (language === 'ar' ? 'سند قبض' : 'Receipt Voucher') :
                             entry.type === 'receipt_voucher' ? (language === 'ar' ? 'سند قبض' : 'Receipt Voucher') :
                             entry.type === 'return' ? (language === 'ar' ? 'مرتجع مبيعات' : 'Sales Return') :
                             entry.type === 'journal' ? (language === 'ar' ? 'قيد يدوي' : 'Manual Entry') :
                             entry.type === 'manual' ? (language === 'ar' ? 'قيد يدوي' : 'Manual Entry') :
                             entry.type === 'opening_balance' ? (language === 'ar' ? 'رصيد أول' : 'Opening Balance') :
                             entry.type === 'discount' ? (language === 'ar' ? 'خصم' : 'Discount') : (language === 'ar' ? 'قيد يومية' : 'Journal Entry')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-mono">
                          {entry.entry_number ? (
                            <span 
                              onClick={() => {
                                setPendingViewDoc({ type: 'journal', idOrNumber: entry.entry_number! });
                                setCurrentPage('journal_entries');
                              }}
                              className="text-indigo-600 hover:text-indigo-700 hover:underline cursor-pointer font-bold font-mono transition-colors"
                            >
                              {entry.entry_number}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td 
                          onClick={() => handleTransactionClick(entry.type, entry.reference)}
                          className={`px-4 py-3 text-sm font-bold font-mono transition-colors ${entry.reference !== '-' ? 'text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer' : ''}`}
                        >
                          {entry.reference}
                        </td>
                        <td className="px-4 py-3 text-sm">{entry.description}</td>
                        <td className="px-4 py-3 text-sm font-bold text-emerald-600">{entry.debit > 0 ? formatNumber(entry.debit) : '-'}</td>
                        <td className="px-4 py-3 text-sm font-bold text-emerald-600">{entry.credit > 0 ? formatNumber(entry.credit) : '-'}</td>
                        <td className="px-4 py-3 text-sm font-bold text-zinc-900">{formatBalance(entry.balance)}</td>
                      </tr>
                    ))}
                    {entries.length === 1 && entries[0].id === 'balance-forward' && (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-zinc-400 italic">{language === 'ar' ? 'لا توجد حركات في هذه الفترة' : 'No transactions in this period'}</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-zinc-900 text-white font-bold">
                      <td colSpan={5} className="px-4 py-3 text-left">{language === 'ar' ? 'الرصيد الختامي' : 'Ending Balance'}</td>
                      <td className="px-4 py-3">{formatNumber(entries.reduce((sum, e) => sum + (Number(e.debit) || 0), 0))}</td>
                      <td className="px-4 py-3">{formatNumber(entries.reduce((sum, e) => sum + (Number(e.credit) || 0), 0))}</td>
                      <td className="px-4 py-3">{formatBalance(entries[entries.length - 1]?.balance || 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {!loading && entries.length === 0 && selectedCustomerId && (
          <div className="text-center py-12 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
            <FileText className="mx-auto text-zinc-300 mb-4" size={48} />
            <p className="text-zinc-500">{language === 'ar' ? 'لا توجد حركات مالية لهذا العميل في الفترة المحددة.' : 'No financial transactions for this customer in the specified period.'}</p>
          </div>
        )}
      </div>
    </div>
  );
};
