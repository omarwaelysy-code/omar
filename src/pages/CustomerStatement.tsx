import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Customer, Invoice, ReceiptVoucher, Return, Currency, Company, PaymentVoucher } from '../types';
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
  currency?: string;
  amount?: number;
  signed_amount?: number;
  debit: number;
  credit: number;
  balance: number;
}

const buildCustomerStatement = ({
  allJournalEntries,
  invoices,
  receipts,
  vouchers,
  returns,
  currencies,
  company,
  customer,
  accounts,
  selectedCustomerId,
  startDate,
  endDate,
  language
}: {
  allJournalEntries: any[];
  invoices: Invoice[];
  receipts: ReceiptVoucher[];
  vouchers: PaymentVoucher[];
  returns: Return[];
  currencies: Currency[];
  company: Company | null;
  customer: Customer | null;
  accounts: any[];
  selectedCustomerId: string;
  startDate: string;
  endDate: string;
  language: string;
}): { entries: StatementEntry[]; systemCurrency: string } => {
  const sysCurr = company?.settings?.currency || 'EGP';

  const currenciesMap = (currencies || []).reduce((acc, c) => {
    acc[c.id] = c;
    return acc;
  }, {} as Record<string, Currency>);

  const invoicesMap = (invoices || []).reduce((acc, inv) => {
    acc[inv.invoice_number] = inv;
    return acc;
  }, {} as Record<string, Invoice>);

  const receiptsMap = (receipts || []).reduce((acc, r) => {
    const ref = r.voucher_number || r.internal_reference || r.manual_reference;
    if (ref) acc[ref] = r;
    if (r.voucher_number) acc[r.voucher_number] = r;
    return acc;
  }, {} as Record<string, ReceiptVoucher>);

  const vouchersMap = (vouchers || []).reduce((acc, v) => {
    const ref = v.voucher_number || v.internal_reference || v.manual_reference;
    if (ref) acc[ref] = v;
    if (v.voucher_number) acc[v.voucher_number] = v;
    return acc;
  }, {} as Record<string, PaymentVoucher>);

  const returnsMap = (returns || []).reduce((acc, ret) => {
    acc[ret.return_number] = ret;
    return acc;
  }, {} as Record<string, Return>);

  const allEntries: StatementEntry[] = [];

  allJournalEntries.forEach((je: any) => {
    const customerItems = (je.items || []).filter((item: any) => {
      const matchesEntity = item.customer_id === selectedCustomerId || item.sub_account_id === selectedCustomerId;
      return matchesEntity && isCustomerAccount(item.account_id, customer, accounts);
    });

    if (customerItems.length === 0) return;

    let description = customerItems[0]?.description || je.description || (language === 'ar' ? 'قيد مالي' : 'Journal Entry');
    let mappedType = je.reference_type || 'journal';
    if (mappedType === 'receipt') mappedType = 'receipt_voucher';

    let currencyCode = sysCurr;
    let rate = 1;
    let docTotal = 0;

    if (je.reference_type === 'invoice' && je.reference_number) {
      const inv = invoicesMap[je.reference_number];
      description = inv?.description || (language === 'ar' ? 'فاتورة مبيعات' : 'Sales Invoice');
      if (inv) {
        if (inv.currency_id && currenciesMap[inv.currency_id]) {
          currencyCode = currenciesMap[inv.currency_id].code;
        } else if ((inv as any).currency_code) {
          currencyCode = (inv as any).currency_code;
        }
        rate = Number(inv.exchange_rate) || 1;
        docTotal = Number(inv.total_amount) || 0;
      }
    } else if ((je.reference_type === 'receipt' || je.reference_type === 'receipt_voucher') && je.reference_number) {
      const rect = receiptsMap[je.reference_number];
      description = rect?.description || (language === 'ar' ? 'سند قبض' : 'Receipt Voucher');
      if (rect) {
        const rAny = rect as any;
        if (rAny.currency_id && currenciesMap[rAny.currency_id]) {
          currencyCode = currenciesMap[rAny.currency_id].code;
        } else if (rAny.currency_code) {
          currencyCode = rAny.currency_code;
        }
        rate = Number(rAny.exchange_rate) || 1;
        docTotal = Number(rect.amount) || 0;
      }
    } else if ((je.reference_type === 'payment' || je.reference_type === 'payment_voucher') && je.reference_number) {
      const pv = vouchersMap[je.reference_number];
      description = pv?.description || (language === 'ar' ? 'سند صرف' : 'Payment Voucher');
      if (pv) {
        const pAny = pv as any;
        if (pAny.currency_id && currenciesMap[pAny.currency_id]) {
          currencyCode = currenciesMap[pAny.currency_id].code;
        } else if (pAny.currency_code) {
          currencyCode = pAny.currency_code;
        }
        rate = Number(pAny.exchange_rate) || 1;
        docTotal = Number(pv.amount) || 0;
      }
    } else if (je.reference_type === 'return' && je.reference_number) {
      const ret = returnsMap[je.reference_number];
      description = ret?.description || ret?.notes || (language === 'ar' ? 'مرتجع مبيعات' : 'Sales Return');
      if (ret) {
        const retAny = ret as any;
        if (ret.currency_id && currenciesMap[ret.currency_id]) {
          currencyCode = currenciesMap[ret.currency_id].code;
        } else if (retAny.currency_code) {
          currencyCode = retAny.currency_code;
        }
        rate = Number(ret.exchange_rate) || 1;
        docTotal = Number(ret.total_amount) || 0;
      }
    }

    for (const item of customerItems) {
      if (item.currency && item.currency !== 'local') {
        const itemCurrCode = currenciesMap[item.currency]?.code || item.currency;
        if (itemCurrCode) currencyCode = itemCurrCode;
        if (item.exchange_rate && Number(item.exchange_rate) > 0) {
          rate = Number(item.exchange_rate);
        }
        break;
      }
    }

    const sumDebit = Number(customerItems.reduce((sum: number, item: any) => sum + (Number(item.debit) || 0), 0).toFixed(2));
    const sumCredit = Number(customerItems.reduce((sum: number, item: any) => sum + (Number(item.credit) || 0), 0).toFixed(2));
    const sumForeign = Number(customerItems.reduce((sum: number, item: any) => sum + (Number(item.foreign_amount) || 0), 0).toFixed(2));

    const isForeign = currencyCode !== sysCurr && rate > 0 && rate !== 1;

    let finalDebit = sumDebit;
    let finalCredit = sumCredit;
    let rawAmount = 0;

    if (isForeign) {
      if (sumForeign > 0) {
        rawAmount = sumForeign;
        finalDebit = sumDebit;
        finalCredit = sumCredit;
      } else {
        // Detect if stored amounts were unconverted (stored in foreign currency rather than system currency)
        const isDebitUnconverted = sumDebit > 0 && docTotal > 0 && Math.abs(sumDebit - docTotal) < 0.05;
        const isCreditUnconverted = sumCredit > 0 && docTotal > 0 && Math.abs(sumCredit - docTotal) < 0.05;

        if (isDebitUnconverted) {
          rawAmount = sumDebit;
          finalDebit = Number((sumDebit * rate).toFixed(2));
          finalCredit = 0;
        } else if (isCreditUnconverted) {
          rawAmount = sumCredit;
          finalCredit = Number((sumCredit * rate).toFixed(2));
          finalDebit = 0;
        } else {
          finalDebit = sumDebit;
          finalCredit = sumCredit;
          // Check if system amounts match document total * rate
          if (docTotal > 0 && (
            Math.abs(sumDebit - Number((docTotal * rate).toFixed(2))) < 1.0 ||
            Math.abs(sumCredit - Number((docTotal * rate).toFixed(2))) < 1.0
          )) {
            rawAmount = docTotal;
          } else {
            const val = sumDebit > 0 ? sumDebit : sumCredit;
            rawAmount = Number((val / rate).toFixed(2));
          }
        }
      }
    } else {
      finalDebit = sumDebit;
      finalCredit = sumCredit;
      rawAmount = sumDebit > 0 ? sumDebit : sumCredit;
    }

    const isDebit = finalDebit > 0;
    const isCredit = finalCredit > 0;
    const signedAmount = isDebit ? rawAmount : (isCredit ? -rawAmount : 0);

    allEntries.push({
      id: `je-${je.id}`,
      date: je.date,
      type: mappedType,
      reference: je.reference_number || '-',
      entry_number: je.entry_number || '',
      description: description,
      currency: currencyCode,
      amount: rawAmount,
      signed_amount: signedAmount,
      debit: finalDebit,
      credit: finalCredit,
      balance: 0
    });
  });

  allEntries.sort((a, b) => {
    const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (dateDiff !== 0) return dateDiff;
    return a.id.localeCompare(b.id);
  });

  const customerOpBal = Number(customer?.opening_balance || 0);
  const hasOpeningBalanceInEntries = allEntries.some(e => 
    e.type === 'opening_balance' || 
    e.description.includes('رصيد افتتاحي') ||
    e.description.includes('Opening Balance')
  );
  
  const manualOpBal = hasOpeningBalanceInEntries ? 0 : customerOpBal;
  let balanceForward = 0;
  let filteredEntries = allEntries;
  const finalAllEntries: StatementEntry[] = [];

  if (startDate) {
    const entriesBefore = allEntries.filter(e => (e.date || '').slice(0, 10) < startDate);
    balanceForward = manualOpBal + entriesBefore.reduce((sum, e) => sum + (Number(e.debit || 0) - Number(e.credit || 0)), 0);
    filteredEntries = allEntries.filter(e => (e.date || '').slice(0, 10) >= startDate);
    
    finalAllEntries.push({
      id: 'balance-forward',
      date: startDate,
      type: 'opening_balance',
      reference: '-',
      description: language === 'ar' ? 'رصيد منقول' : 'Balance Forward',
      currency: sysCurr,
      amount: Math.abs(balanceForward),
      signed_amount: balanceForward,
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
        currency: sysCurr,
        amount: Math.abs(manualOpBal),
        signed_amount: manualOpBal,
        debit: manualOpBal > 0 ? manualOpBal : 0,
        credit: manualOpBal < 0 ? Math.abs(manualOpBal) : 0,
        balance: manualOpBal
      });
      balanceForward = manualOpBal;
    }
  }

  let currentBalance = balanceForward;
  const finalEntries = filteredEntries.filter(e => !endDate || (e.date || '').slice(0, 10) <= endDate).map(entry => {
    currentBalance += (entry.debit - entry.credit);
    return { ...entry, balance: currentBalance };
  });

  return {
    entries: [...finalAllEntries, ...finalEntries],
    systemCurrency: sysCurr
  };
};

export const CustomerStatement: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { setCurrentPage, setPendingViewDoc } = useNavigation();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [systemCurrency, setSystemCurrency] = useState<string>('EGP');

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

  const showCurrencyColumn = useMemo(() => {
    const currenciesSet = new Set<string>();
    entries.forEach(e => {
      if (e.id !== 'balance-forward' && e.id !== 'opening-balance' && e.currency) {
        currenciesSet.add(e.currency);
      }
    });
    return currenciesSet.size > 1 || (currenciesSet.size === 1 && !currenciesSet.has(systemCurrency));
  }, [entries, systemCurrency]);

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
            const [invoices, receipts, returns, discounts, journalEntries, accounts, paymentVouchers, currencies, company] = await Promise.all([
              dbService.list<Invoice>('invoices', user.company_id),
              dbService.list<ReceiptVoucher>('receipt_vouchers', user.company_id),
              dbService.list<Return>('returns', user.company_id),
              dbService.list<any>('customer_discounts', user.company_id),
              dbService.list<any>('journal_entries', user.company_id),
              dbService.list<any>('accounts', user.company_id),
              dbService.list<PaymentVoucher>('payment_vouchers', user.company_id),
              dbService.list<Currency>('currencies', user.company_id),
              dbService.get<Company>('companies', user.company_id)
            ]);

            const res = buildCustomerStatement({
              allJournalEntries: journalEntries,
              invoices,
              receipts,
              vouchers: paymentVouchers,
              returns,
              currencies,
              company,
              customer,
              accounts,
              selectedCustomerId: savedCustId,
              startDate: savedStart || '',
              endDate: savedEnd || new Date().toISOString().slice(0, 10),
              language
            });

            setSystemCurrency(res.systemCurrency);
            setEntries(res.entries);
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
      const [invoices, receipts, returns, discounts, journalEntries, accounts, paymentVouchers, currencies, company] = await Promise.all([
        dbService.list<Invoice>('invoices', user.company_id),
        dbService.list<ReceiptVoucher>('receipt_vouchers', user.company_id),
        dbService.list<Return>('returns', user.company_id),
        dbService.list<any>('customer_discounts', user.company_id),
        dbService.list<any>('journal_entries', user.company_id),
        dbService.list<any>('accounts', user.company_id),
        dbService.list<PaymentVoucher>('payment_vouchers', user.company_id),
        dbService.list<Currency>('currencies', user.company_id),
        dbService.get<Company>('companies', user.company_id)
      ]);

      const res = buildCustomerStatement({
        allJournalEntries: journalEntries,
        invoices,
        receipts,
        vouchers: paymentVouchers,
        returns,
        currencies,
        company,
        customer,
        accounts,
        selectedCustomerId,
        startDate,
        endDate,
        language
      });

      setSystemCurrency(res.systemCurrency);
      setEntries(res.entries);
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

  const formatSigned = (val: number) => {
    if (val === 0) return '0';
    return val > 0 ? `+${formatNumber(val)}` : formatNumber(val);
  };

  const handleExportExcel = () => {
    if (entries.length === 0 || !customerInfo) return;
    
    const data = entries.map(entry => {
      const row: Record<string, any> = {
        [language === 'ar' ? 'التاريخ' : 'Date']: entry.date,
        [language === 'ar' ? 'النوع' : 'Type']: entry.type,
        [language === 'ar' ? 'رقم القيد' : 'Entry No.']: entry.entry_number || '-',
        [language === 'ar' ? 'المرجع' : 'Reference']: entry.reference,
        [language === 'ar' ? 'البيان' : 'Description']: entry.description,
      };
      if (showCurrencyColumn) {
        row[language === 'ar' ? 'العملة' : 'Currency'] = entry.currency || systemCurrency;
      }
      row[language === 'ar' ? 'المبلغ (±)' : 'Amount (±)'] = entry.signed_amount || 0;
      row[language === 'ar' ? 'مدين (+)' : 'Debit (+)'] = entry.debit;
      row[language === 'ar' ? 'دائن (-)' : 'Credit (-)'] = entry.credit;
      row[language === 'ar' ? 'الرصيد (عملة النظام)' : 'Balance (System Currency)'] = entry.balance;
      return row;
    });
    
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
                      {showCurrencyColumn && (
                        <th className="px-4 py-3 text-sm font-bold text-zinc-700">{language === 'ar' ? 'العملة' : 'Currency'}</th>
                      )}
                      <th className="px-4 py-3 text-sm font-bold text-zinc-700">{language === 'ar' ? 'المبلغ (±)' : 'Amount (±)'}</th>
                      <th className="px-4 py-3 text-sm font-bold text-zinc-700">{language === 'ar' ? 'مدين' : 'Debit'}</th>
                      <th className="px-4 py-3 text-sm font-bold text-zinc-700">{language === 'ar' ? 'دائن' : 'Credit'}</th>
                      <th className="px-4 py-3 text-sm font-bold text-zinc-700">{language === 'ar' ? 'الرصيد (عملة النظام)' : 'Balance (System Currency)'}</th>
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
                        {showCurrencyColumn && (
                          <td className="px-4 py-3 text-sm font-mono font-bold text-zinc-600">
                            <span className="px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-xs">
                              {entry.currency || systemCurrency}
                            </span>
                          </td>
                        )}
                        <td className={`px-4 py-3 text-sm font-bold font-mono ${(entry.signed_amount || 0) > 0 ? 'text-emerald-600' : ((entry.signed_amount || 0) < 0 ? 'text-rose-600' : 'text-zinc-600')}`}>
                          {formatSigned(entry.signed_amount || 0)}
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-emerald-600">{entry.debit > 0 ? formatNumber(entry.debit) : '-'}</td>
                        <td className="px-4 py-3 text-sm font-bold text-emerald-600">{entry.credit > 0 ? formatNumber(entry.credit) : '-'}</td>
                        <td className="px-4 py-3 text-sm font-bold text-zinc-900">{formatBalance(entry.balance)}</td>
                      </tr>
                    ))}
                    {entries.length === 1 && entries[0].id === 'balance-forward' && (
                      <tr>
                        <td colSpan={showCurrencyColumn ? 10 : 9} className="px-4 py-8 text-center text-zinc-400 italic">{language === 'ar' ? 'لا توجد حركات في هذه الفترة' : 'No transactions in this period'}</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-zinc-900 text-white font-bold">
                      <td colSpan={showCurrencyColumn ? 6 : 5} className="px-4 py-3 text-left">{language === 'ar' ? 'الرصيد الختامي' : 'Ending Balance'}</td>
                      <td className="px-4 py-3 font-mono">{formatSigned(entries.reduce((sum, e) => sum + (Number(e.debit) || 0) - (Number(e.credit) || 0), 0))}</td>
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
