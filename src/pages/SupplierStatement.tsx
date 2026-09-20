import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Supplier, PurchaseInvoice, PaymentVoucher, PurchaseReturn, Currency, Company } from '../types';
import { Search, Calendar, FileText, Download, User, ArrowUpRight, ArrowDownLeft, Wallet, RefreshCcw } from 'lucide-react';
import { exportToPDF } from '../utils/pdfUtils';
import { exportToExcel } from '../utils/excelUtils';
import { dbService } from '../services/dbService';
import { formatNumber, formatMoney, formatDate, isSupplierAccount } from '../utils/formatUtils';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigation } from '../contexts/NavigationContext';

interface StatementItem {
  id: string;
  date: string;
  type: string;
  reference: string;
  entry_number?: string;
  currency?: string;
  amount?: number;
  signed_amount?: number;
  debit: number; // المبلغ المستحق علينا (مشتريات)
  credit: number; // المبلغ المدفوع منا (سندات صرف، مرتجعات، خصومات)
  notes: string;
  balance?: number;
}

const buildSupplierStatement = ({
  allJournalEntries,
  invoices,
  returns,
  vouchers,
  currencies,
  company,
  supplier,
  accounts,
  selectedSupplierId,
  startDate,
  endDate,
  language
}: {
  allJournalEntries: any[];
  invoices: PurchaseInvoice[];
  returns: PurchaseReturn[];
  vouchers: PaymentVoucher[];
  currencies: Currency[];
  company: Company | null;
  supplier: Supplier | null | undefined;
  accounts: any[];
  selectedSupplierId: string;
  startDate: string;
  endDate: string;
  language: string;
}): { items: StatementItem[]; startBalance: number; systemCurrency: string } => {
  const sysCurr = company?.settings?.currency || 'EGP';

  const currenciesMap = (currencies || []).reduce((acc, c) => {
    acc[c.id] = c;
    return acc;
  }, {} as Record<string, Currency>);

  const invoicesMap = invoices.reduce((acc, inv) => {
    acc[inv.invoice_number] = inv;
    return acc;
  }, {} as Record<string, PurchaseInvoice>);

  const vouchersMap = vouchers.reduce((acc, v) => {
    const ref = v.voucher_number || v.manual_reference || v.internal_reference;
    if (ref) acc[ref] = v;
    if (v.voucher_number) acc[v.voucher_number] = v;
    return acc;
  }, {} as Record<string, PaymentVoucher>);

  const returnsMap = returns.reduce((acc, ret) => {
    acc[ret.return_number] = ret;
    return acc;
  }, {} as Record<string, PurchaseReturn>);

  const allItems: StatementItem[] = [];

  allJournalEntries.forEach((je: any) => {
    je.items?.forEach((item: any) => {
      const matchesEntity = item.supplier_id === selectedSupplierId || item.sub_account_id === selectedSupplierId;
      if (matchesEntity && isSupplierAccount(item.account_id, supplier, accounts)) {
        let notes = item.description || je.description || (language === 'ar' ? 'قيد مالي' : 'Journal Entry');
        let mappedType = je.reference_type || 'manual';
        if (mappedType === 'payment') mappedType = 'payment_voucher';

        let currencyCode = sysCurr;
        let rate = 1;
        let docTotal = 0;

        if (je.reference_type === 'purchase_invoice' && je.reference_number) {
          const inv = invoicesMap[je.reference_number];
          notes = inv?.description || (language === 'ar' ? 'فاتورة مشتريات' : 'Purchase Invoice');
          if (inv) {
            if (inv.currency_id && currenciesMap[inv.currency_id]) {
              currencyCode = currenciesMap[inv.currency_id].code;
            } else if (inv.currency_code) {
              currencyCode = inv.currency_code;
            }
            rate = Number(inv.exchange_rate) || 1;
            docTotal = Number(inv.total_amount) || 0;
          }
        } else if ((je.reference_type === 'payment_voucher' || je.reference_type === 'payment') && je.reference_number) {
          const voucher = vouchersMap[je.reference_number];
          notes = voucher?.description || (language === 'ar' ? 'سند صرف' : 'Payment Voucher');
          if (voucher) {
            const vAny = voucher as any;
            if (vAny.currency_id && currenciesMap[vAny.currency_id]) {
              currencyCode = currenciesMap[vAny.currency_id].code;
            } else if (vAny.currency_code) {
              currencyCode = vAny.currency_code;
            }
            rate = Number(vAny.exchange_rate) || 1;
            docTotal = Number(voucher.amount) || 0;
          }
        } else if (je.reference_type === 'purchase_return' && je.reference_number) {
          const ret = returnsMap[je.reference_number];
          notes = ret?.description || ret?.notes || (language === 'ar' ? 'مرتجع مشتريات' : 'Purchase Return');
          if (ret) {
            const retAny = ret as any;
            if (retAny.currency_id && currenciesMap[retAny.currency_id]) {
              currencyCode = currenciesMap[retAny.currency_id].code;
            } else if (retAny.currency_code) {
              currencyCode = retAny.currency_code;
            }
            rate = Number(retAny.exchange_rate) || 1;
            docTotal = Number(ret.total_amount) || 0;
          }
        }

        if (item.currency && item.currency !== 'local') {
          const itemCurrCode = currenciesMap[item.currency]?.code || item.currency;
          if (itemCurrCode) currencyCode = itemCurrCode;
          if (item.exchange_rate && Number(item.exchange_rate) > 0) {
            rate = Number(item.exchange_rate);
          }
        }

        const itemDebit = Number(item.debit) || 0;
        const itemCredit = Number(item.credit) || 0;
        const isForeign = currencyCode !== sysCurr && rate > 0 && rate !== 1;

        let finalDebit = itemDebit;
        let finalCredit = itemCredit;
        let rawAmount = 0;

        if (isForeign) {
          if (item.foreign_amount && Number(item.foreign_amount) > 0) {
            rawAmount = Number(item.foreign_amount);
            finalDebit = itemDebit;
            finalCredit = itemCredit;
          } else {
            const isCreditUnconverted = itemCredit > 0 && (
              (docTotal > 0 && Math.abs(itemCredit - docTotal) < 0.05) ||
              (docTotal > 0 && Math.abs(itemCredit - docTotal) < Math.abs(itemCredit - docTotal * rate))
            );
            const isDebitUnconverted = itemDebit > 0 && (
              (docTotal > 0 && Math.abs(itemDebit - docTotal) < 0.05) ||
              (docTotal > 0 && Math.abs(itemDebit - docTotal) < Math.abs(itemDebit - docTotal * rate))
            );

            if (isCreditUnconverted) {
              rawAmount = itemCredit;
              finalCredit = Number((itemCredit * rate).toFixed(2));
              finalDebit = 0;
            } else if (isDebitUnconverted) {
              rawAmount = itemDebit;
              finalDebit = Number((itemDebit * rate).toFixed(2));
              finalCredit = 0;
            } else {
              finalDebit = itemDebit;
              finalCredit = itemCredit;
              const val = itemCredit > 0 ? itemCredit : itemDebit;
              rawAmount = Number((val / rate).toFixed(2));
            }
          }
        } else {
          finalDebit = itemDebit;
          finalCredit = itemCredit;
          rawAmount = itemCredit > 0 ? itemCredit : itemDebit;
        }

        // For supplier: Credit is positive (+) (owed to supplier), Debit is negative (-) (payment/return)
        const isCredit = finalCredit > 0 || itemCredit > 0;
        const isDebit = finalDebit > 0 || itemDebit > 0;
        const signedAmount = isCredit ? rawAmount : (isDebit ? -rawAmount : 0);

        allItems.push({
          id: `je-${je.id}-${Math.random()}`,
          date: je.date,
          type: mappedType,
          reference: je.reference_number || '-',
          entry_number: je.entry_number || '',
          currency: currencyCode,
          amount: rawAmount,
          signed_amount: signedAmount,
          debit: finalDebit,
          credit: finalCredit,
          notes: notes
        });
      }
    });
  });

  allItems.sort((a, b) => {
    const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (dateDiff !== 0) return dateDiff;
    return a.id.localeCompare(b.id);
  });

  const startVal = startDate || '';
  const endVal = endDate || new Date().toISOString().slice(0, 10);

  const filteredItems = allItems.filter(item => {
    const itemDateStr = (item.date || '').slice(0, 10);
    return (!startVal || itemDateStr >= startVal) && (!endVal || itemDateStr <= endVal);
  });

  const supplierOpBal = Number(supplier?.opening_balance || 0);
  const hasOpeningBalanceInItems = allItems.some(item => item.type === 'opening_balance' || item.notes.includes(language === 'ar' ? 'رصيد افتتاحي' : 'Opening Balance'));
  const manualOpBal = hasOpeningBalanceInItems ? 0 : supplierOpBal;
  let balanceBefore = 0;
  
  if (startVal) {
    const itemsBefore = allItems.filter(item => (item.date || '').slice(0, 10) < startVal);
    balanceBefore = manualOpBal + itemsBefore.reduce((sum, item) => sum + (Number(item.credit || 0) - Number(item.debit || 0)), 0);
  } else {
    if (manualOpBal !== 0) {
      balanceBefore = manualOpBal;
    }
  }
  
  const initialBalance = balanceBefore;
  let currentBalance = initialBalance;
  const finalItems = filteredItems.map(item => {
    currentBalance += (item.credit - item.debit);
    return { ...item, balance: currentBalance };
  });

  return {
    items: finalItems,
    startBalance: initialBalance,
    systemCurrency: sysCurr
  };
};

export const SupplierStatement: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { setCurrentPage, setPendingViewDoc } = useNavigation();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [systemCurrency, setSystemCurrency] = useState<string>('EGP');

  const handleTransactionClick = (type: string, reference: string) => {
    if (!reference || reference === '-') return;
    
    if (reference.startsWith('SET-')) {
      setPendingViewDoc({ type: 'settlement', idOrNumber: reference });
      setCurrentPage('supplier_settlements');
      return;
    }
    
    if (type === 'purchase_invoice') {
      setPendingViewDoc({ type: 'purchase_invoice', idOrNumber: reference });
      setCurrentPage('purchase_invoices');
    } else if (type === 'payment_voucher' || type === 'payment') {
      setPendingViewDoc({ type: 'payment_voucher', idOrNumber: reference });
      setCurrentPage('payment_vouchers');
    } else if (type === 'purchase_return') {
      setPendingViewDoc({ type: 'purchase_return', idOrNumber: reference });
      setCurrentPage('purchase_returns');
    } else if (type === 'journal' || type === 'manual') {
      setPendingViewDoc({ type: 'manual', idOrNumber: reference });
      setCurrentPage('journal_entries');
    }
  };
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [statement, setStatement] = useState<StatementItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [startBalance, setStartBalance] = useState(0);
  const reportRef = useRef<HTMLDivElement>(null);

  const showCurrencyColumn = useMemo(() => {
    const currenciesSet = new Set<string>();
    statement.forEach(e => {
      if (e.currency) currenciesSet.add(e.currency);
    });
    return currenciesSet.size > 1 || (currenciesSet.size === 1 && !currenciesSet.has(systemCurrency));
  }, [statement, systemCurrency]);

  useEffect(() => {
    if (user) {
      const unsub = dbService.subscribe<Supplier>('suppliers', user.company_id, setSuppliers);
      return () => unsub();
    }
  }, [user]);

  // Auto-run statement generation if redirected from balances report
  useEffect(() => {
    if (user && suppliers.length > 0) {
      const savedSupId = sessionStorage.getItem('supplier_statement_filter_supplier_id');
      const savedStart = sessionStorage.getItem('supplier_statement_filter_start_date');
      const savedEnd = sessionStorage.getItem('supplier_statement_filter_end_date');
      
      if (savedSupId) {
        setSelectedSupplierId(savedSupId);
        setStartDate(savedStart || '');
        setEndDate(savedEnd || new Date().toISOString().slice(0, 10));
        
        sessionStorage.removeItem('supplier_statement_filter_supplier_id');
        sessionStorage.removeItem('supplier_statement_filter_start_date');
        sessionStorage.removeItem('supplier_statement_filter_end_date');
        
        const runAutoGenerate = async () => {
          setLoading(true);
          try {
            const supplier = suppliers.find(s => s.id === savedSupId);
            const opBal = supplier?.opening_balance || 0;
            setOpeningBalance(opBal);

            const [invoices, returns, vouchers, discounts, journalEntries, accounts, currencies, company] = await Promise.all([
              dbService.list<PurchaseInvoice>('purchase_invoices', user.company_id),
              dbService.list<PurchaseReturn>('purchase_returns', user.company_id),
              dbService.list<PaymentVoucher>('payment_vouchers', user.company_id),
              dbService.list<any>('supplier_discounts', user.company_id),
              dbService.list<any>('journal_entries', user.company_id),
              dbService.list<any>('accounts', user.company_id),
              dbService.list<Currency>('currencies', user.company_id),
              dbService.get<Company>('companies', user.company_id)
            ]);

            const res = buildSupplierStatement({
              allJournalEntries: journalEntries,
              invoices,
              returns,
              vouchers,
              currencies,
              company,
              supplier,
              accounts,
              selectedSupplierId: savedSupId,
              startDate: savedStart || '',
              endDate: savedEnd || new Date().toISOString().slice(0, 10),
              language
            });

            setSystemCurrency(res.systemCurrency);
            setStartBalance(res.startBalance);
            setStatement(res.items);
          } catch (e) {
            console.error(e);
          } finally {
            setLoading(false);
          }
        };
        runAutoGenerate();
      }
    }
  }, [user, suppliers]);

  const fetchStatement = async () => {
    if (!selectedSupplierId || !user) return;
    setLoading(true);
    try {
      const supplier = suppliers.find(s => s.id === selectedSupplierId);
      const opBal = supplier?.opening_balance || 0;
      setOpeningBalance(opBal);

      const [invoices, returns, vouchers, discounts, journalEntries, accounts, currencies, company] = await Promise.all([
        dbService.list<PurchaseInvoice>('purchase_invoices', user.company_id),
        dbService.list<PurchaseReturn>('purchase_returns', user.company_id),
        dbService.list<PaymentVoucher>('payment_vouchers', user.company_id),
        dbService.list<any>('supplier_discounts', user.company_id),
        dbService.list<any>('journal_entries', user.company_id),
        dbService.list<any>('accounts', user.company_id),
        dbService.list<Currency>('currencies', user.company_id),
        dbService.get<Company>('companies', user.company_id)
      ]);

      const res = buildSupplierStatement({
        allJournalEntries: journalEntries,
        invoices,
        returns,
        vouchers,
        currencies,
        company,
        supplier,
        accounts,
        selectedSupplierId,
        startDate,
        endDate,
        language
      });

      setSystemCurrency(res.systemCurrency);
      setStartBalance(res.startBalance);
      setStatement(res.items);
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
    if (statement.length === 0 || !selectedSupplierId) return;
    const supplier = suppliers.find(s => s.id === selectedSupplierId);
    const data = statement.map(entry => {
      const row: Record<string, any> = {
        [language === 'ar' ? 'التاريخ' : 'Date']: entry.date,
        [language === 'ar' ? 'النوع' : 'Type']: entry.type,
        [language === 'ar' ? 'رقم القيد' : 'Entry No.']: entry.entry_number || '-',
        [language === 'ar' ? 'المرجع' : 'Reference']: entry.reference,
        [language === 'ar' ? 'البيان' : 'Description']: entry.notes,
      };
      if (showCurrencyColumn) {
        row[language === 'ar' ? 'العملة' : 'Currency'] = entry.currency || systemCurrency;
      }
      row[language === 'ar' ? 'المبلغ (±)' : 'Amount (±)'] = entry.signed_amount || 0;
      row[language === 'ar' ? 'مدين (-)' : 'Debit (-)'] = entry.debit;
      row[language === 'ar' ? 'دائن (+)' : 'Credit (+)'] = entry.credit;
      row[language === 'ar' ? 'الرصيد (عملة النظام)' : 'Balance (System Currency)'] = entry.balance;
      return row;
    });
    
    exportToExcel(data, { 
      filename: `statement_${supplier?.name}_${new Date().toISOString().slice(0,10)}`,
      sheetName: language === 'ar' ? 'كشف الحساب' : 'Statement'
    });
  };

  const handleExportPDF = async () => {
    if (!reportRef.current || !selectedSupplierId) return;
    const supplier = suppliers.find(s => s.id === selectedSupplierId);
    try {
      await exportToPDF(reportRef.current, {
        filename: `statement_${supplier?.name}_${new Date().toISOString().slice(0,10)}.pdf`,
        orientation: 'landscape',
        reportTitle: `${language === 'ar' ? 'كشف حساب مورد' : 'Supplier Account Statement'} - ${supplier?.name}`
      });
    } catch (e) {
      console.error(e);
    }
  };

  const totalCredit = statement.reduce((sum, e) => sum + (Number(e.credit) || 0), 0) + (startBalance > 0 ? startBalance : 0);
  const totalDebit = statement.reduce((sum, e) => sum + (Number(e.debit) || 0), 0) + (startBalance < 0 ? Math.abs(startBalance) : 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">{t('nav.supplier_statement')}</h2>
          <p className="text-zinc-500">{language === 'ar' ? 'عرض الحركات المالية والارصدة لكل مورد.' : 'View financial transactions and balances for each supplier.'}</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-1">
            <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('discounts.column_supplier')}</label>
            <div className="relative">
              <User className="absolute left-3 top-3 text-zinc-400" size={18} />
              <select 
                className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
              >
                <option value="">{t('settlements.select_supplier')}</option>
                {suppliers.map(supplier => (
                  <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
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
              onClick={fetchStatement}
              disabled={loading || !selectedSupplierId}
              className="flex-grow flex items-center justify-center gap-2 px-6 py-2 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-all disabled:opacity-50 h-[42px] font-bold text-sm"
            >
              {loading ? t('common.loading') : (language === 'ar' ? 'عرض التقرير' : 'View Report')}
            </button>
            <button 
              onClick={fetchStatement}
              disabled={loading || !selectedSupplierId}
              className="p-2.5 bg-white border border-zinc-200 text-zinc-600 rounded-xl hover:bg-zinc-50 hover:text-emerald-600 transition-all active:scale-95 shadow-sm disabled:opacity-50 h-[42px] flex items-center justify-center"
              title={language === 'ar' ? 'تحديث البيانات' : 'Refresh Data'}
            >
              <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {(statement.length > 0 || startBalance !== 0) && (
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
                <h3 className="text-2xl font-bold text-zinc-900 mb-2">{language === 'ar' ? 'كشف حساب مورد' : 'Supplier Account Statement'}</h3>
                <div className="flex justify-center gap-8 text-sm text-zinc-500">
                  <p>{language === 'ar' ? 'المورد:' : 'Supplier:'} <span className="font-bold text-zinc-900">{suppliers.find(s => s.id === selectedSupplierId)?.name}</span></p>
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
                    {/* Opening Balance Row */}
                    {(startBalance !== 0 || startDate) && (
                      <tr className="border-b border-zinc-50 bg-zinc-50/30">
                        <td className="px-4 py-3 text-sm font-mono">{startDate || '-'}</td>
                        <td className="px-4 py-3 text-sm"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-600">{language === 'ar' ? 'رصيد' : 'Bal'}</span></td>
                        <td className="px-4 py-3 text-sm font-mono">-</td>
                        <td className="px-4 py-3 text-sm font-mono">-</td>
                        <td className="px-4 py-3 text-sm">{startDate ? (language === 'ar' ? 'رصيد منقول' : 'Balance Forward') : (language === 'ar' ? 'رصيد افتتاحي' : 'Opening Balance')}</td>
                        {showCurrencyColumn && (
                          <td className="px-4 py-3 text-sm font-mono font-bold text-zinc-600">
                            <span className="px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-xs">
                              {systemCurrency}
                            </span>
                          </td>
                        )}
                        <td className={`px-4 py-3 text-sm font-bold font-mono ${startBalance > 0 ? 'text-emerald-600' : (startBalance < 0 ? 'text-rose-600' : 'text-zinc-600')}`}>
                          {formatSigned(startBalance)}
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-emerald-600">{startBalance < 0 ? formatNumber(Math.abs(startBalance)) : '-'}</td>
                        <td className="px-4 py-3 text-sm font-bold text-emerald-600">{startBalance > 0 ? formatNumber(startBalance) : '-'}</td>
                        <td className="px-4 py-3 text-sm font-bold text-zinc-900">{formatBalance(startBalance)}</td>
                      </tr>
                    )}
                    {statement.map((item) => (
                      <tr key={item.id} className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors">
                        <td className="px-4 py-3 text-sm font-mono">{formatDate(item.date)}</td>
                        <td className="px-4 py-3 text-sm">
                          <span 
                            onClick={() => handleTransactionClick(item.type, item.reference)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer hover:scale-105 transition-transform inline-block ${
                              item.type === 'purchase_invoice' ? (item.debit > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600') :
                              item.type === 'payment_voucher' ? 'bg-amber-50 text-amber-600' :
                              item.type === 'purchase_return' ? 'bg-emerald-50 text-emerald-600' :
                              item.type === 'manual' ? 'bg-blue-50 text-blue-600' :
                              item.type === 'opening_balance' ? 'bg-zinc-100 text-zinc-600' :
                              'bg-zinc-100 text-zinc-600'
                            }`}
                          >
                            {item.type === 'purchase_invoice' ? (item.debit > 0 ? (language === 'ar' ? 'سداد نقدي' : 'Cash Payment') : (language === 'ar' ? 'فاتورة مشتريات' : 'Purchase Invoice')) :
                             item.type === 'payment_voucher' ? (language === 'ar' ? 'سند صرف' : 'Payment Voucher') :
                             item.type === 'purchase_return' ? (language === 'ar' ? 'مرتجع مشتريات' : 'Purchase Return') :
                             item.type === 'manual' ? (language === 'ar' ? 'قيد يدوي' : 'Manual Entry') :
                             item.type === 'opening_balance' ? (language === 'ar' ? 'رصيد أول' : 'Opening Balance') :
                             item.type === 'discount' ? (language === 'ar' ? 'خصم' : 'Discount') : (language === 'ar' ? 'قيد يومية' : 'Journal Entry')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-mono">
                          {item.entry_number ? (
                            <span 
                              onClick={() => {
                                setPendingViewDoc({ type: 'journal', idOrNumber: item.entry_number! });
                                setCurrentPage('journal_entries');
                              }}
                              className="text-indigo-600 hover:text-indigo-700 hover:underline cursor-pointer font-bold font-mono transition-colors"
                            >
                              {item.entry_number}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td 
                          onClick={() => handleTransactionClick(item.type, item.reference)}
                          className={`px-4 py-3 text-sm font-bold font-mono transition-colors ${item.reference !== '-' ? 'text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer' : ''}`}
                        >
                          {item.reference}
                        </td>
                        <td className="px-4 py-3 text-sm">{item.notes}</td>
                        {showCurrencyColumn && (
                          <td className="px-4 py-3 text-sm font-mono font-bold text-zinc-600">
                            <span className="px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-xs">
                              {item.currency || systemCurrency}
                            </span>
                          </td>
                        )}
                        <td className={`px-4 py-3 text-sm font-bold font-mono ${(item.signed_amount || 0) > 0 ? 'text-emerald-600' : ((item.signed_amount || 0) < 0 ? 'text-rose-600' : 'text-zinc-600')}`}>
                          {formatSigned(item.signed_amount || 0)}
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-emerald-600">{item.debit > 0 ? formatNumber(item.debit) : '-'}</td>
                        <td className="px-4 py-3 text-sm font-bold text-emerald-600">{item.credit > 0 ? formatNumber(item.credit) : '-'}</td>
                        <td className="px-4 py-3 text-sm font-bold text-zinc-900">{formatBalance(item.balance || 0)}</td>
                      </tr>
                    ))}
                    {statement.length === 0 && (
                      <tr>
                        <td colSpan={showCurrencyColumn ? 10 : 9} className="px-4 py-8 text-center text-zinc-400 italic">{language === 'ar' ? 'لا توجد حركات في هذه الفترة' : 'No transactions in this period'}</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-zinc-900 text-white font-bold">
                      <td colSpan={showCurrencyColumn ? 6 : 5} className="px-4 py-3 text-left">{language === 'ar' ? 'الرصيد الختامي' : 'Ending Balance'}</td>
                      <td className="px-4 py-3 font-mono">{formatSigned(totalCredit - totalDebit)}</td>
                      <td className="px-4 py-3">{formatNumber(totalDebit)}</td>
                      <td className="px-4 py-3">{formatNumber(totalCredit)}</td>
                      <td className="px-4 py-3">{formatBalance(statement.length > 0 ? (statement[statement.length - 1].balance || 0) : startBalance)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {!loading && statement.length === 0 && startBalance === 0 && selectedSupplierId && (
          <div className="text-center py-12 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
            <FileText className="mx-auto text-zinc-300 mb-4" size={48} />
            <p className="text-zinc-500">{language === 'ar' ? 'لا توجد حركات مالية لهذا المورد في الفترة المحددة.' : 'No financial transactions for this supplier in the specified period.'}</p>
          </div>
        )}
      </div>
    </div>
  );
};
