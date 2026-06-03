import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Customer, Invoice, ReceiptVoucher, Return } from '../types';
import { Search, FileText, Download, Calendar, User, ArrowUpRight, ArrowDownLeft, RefreshCcw } from 'lucide-react';
import { exportToPDF } from '../utils/pdfUtils';
import { exportToExcel } from '../utils/excelUtils';
import { dbService } from '../services/dbService';
import { formatNumber, formatMoney, formatDate } from '../utils/formatUtils';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigation } from '../contexts/NavigationContext';

interface StatementEntry {
  id: string;
  date: string;
  type: string;
  reference: string;
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
    
    if (type === 'invoice') {
      setPendingViewDoc({ type: 'invoice', idOrNumber: reference });
      setCurrentPage('invoices');
    } else if (type === 'receipt' || type === 'receipt_voucher') {
      setPendingViewDoc({ type: 'receipt', idOrNumber: reference });
      setCurrentPage('receipts');
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
            const [invoices, receipts, returns, discounts, journalEntries] = await Promise.all([
              dbService.list<Invoice>('invoices', user.company_id),
              dbService.list<ReceiptVoucher>('receipt_vouchers', user.company_id),
              dbService.list<Return>('returns', user.company_id),
              dbService.list<any>('customer_discounts', user.company_id),
              dbService.list<any>('journal_entries', user.company_id)
            ]);

            const invoicesMap = invoices.reduce((acc, inv) => { acc[inv.invoice_number] = inv; return acc; }, {} as Record<string, Invoice>);
            const receiptsMap = receipts.reduce((acc, r) => { if (r.voucher_number) acc[r.voucher_number] = r; return acc; }, {} as Record<string, ReceiptVoucher>);
            const returnsMap = returns.reduce((acc, ret) => { acc[ret.return_number] = ret; return acc; }, {} as Record<string, Return>);

            let allEntries: any[] = [];
            journalEntries.forEach((je: any) => {
              je.items?.forEach((item: any) => {
                if (item.customer_id === savedCustId && item.account_id === customer?.account_id) {
                  let description = item.description || je.description || 'قيد مالي';
                  if (je.reference_type === 'invoice' && je.reference_number) {
                    const inv = invoicesMap[je.reference_number];
                    if (inv && inv.description) description += ` - ${inv.description}`;
                  } else if ((je.reference_type === 'receipt' || je.reference_type === 'receipt_voucher') && je.reference_number) {
                    const rect = receiptsMap[je.reference_number];
                    if (rect && rect.description) description += ` - ${rect.description}`;
                  } else if (je.reference_type === 'return' && je.reference_number) {
                    const ret = returnsMap[je.reference_number];
                    if (ret && ret.description) description += ` - ${ret.description}`;
                  }

                  allEntries.push({
                    id: `je-${je.id}-${Math.random()}`,
                    date: je.date,
                    type: je.reference_type || 'journal',
                    reference: je.reference_number || '-',
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
            const hasOpeningBalanceInEntries = allEntries.some(e => e.type === 'opening_balance' || e.description.includes('رصيد افتتاحي'));
            const manualOpBal = hasOpeningBalanceInEntries ? 0 : customerOpBal;
            let balanceForward = 0;
            let filteredEntries = allEntries;
            const finalAllEntries = [];

            const startVal = savedStart || '';
            const endVal = savedEnd || new Date().toISOString().slice(0, 10);

            if (startVal) {
              const entriesBefore = allEntries.filter(e => e.date < startVal);
              balanceForward = manualOpBal + entriesBefore.reduce((sum, e) => sum + (Number(e.debit || 0) - Number(e.credit || 0)), 0);
              filteredEntries = allEntries.filter(e => e.date >= startVal);
              
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
            const finalEntries = filteredEntries.filter(e => !endVal || e.date <= endVal).map(entry => {
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
      const [invoices, receipts, returns, discounts, journalEntries] = await Promise.all([
        dbService.list<Invoice>('invoices', user.company_id),
        dbService.list<ReceiptVoucher>('receipt_vouchers', user.company_id),
        dbService.list<Return>('returns', user.company_id),
        dbService.list<any>('customer_discounts', user.company_id),
        dbService.list<any>('journal_entries', user.company_id)
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
          if (item.customer_id === selectedCustomerId && item.account_id === customer?.account_id) {
            let description = item.description || je.description || 'قيد مالي';

            // Enrich description from source document if available
            if (je.reference_type === 'invoice' && je.reference_number) {
              const inv = invoicesMap[je.reference_number];
              if (inv) {
                const parts = [];
                if (inv.description) parts.push(inv.description);
                if (parts.length > 0) description += ` - ${parts.join(' | ')}`;
              }
            } else if ((je.reference_type === 'receipt' || je.reference_type === 'receipt_voucher') && je.reference_number) {
              const rect = receiptsMap[je.reference_number];
              if (rect) {
                const parts = [];
                if (rect.description) parts.push(rect.description);
                if (parts.length > 0) description += ` - ${parts.join(' | ')}`;
              }
            } else if (je.reference_type === 'return' && je.reference_number) {
              const ret = returnsMap[je.reference_number];
              if (ret) {
                const parts = [];
                if (ret.description) parts.push(ret.description);
                if (ret.notes) parts.push(ret.notes);
                if (parts.length > 0) description += ` - ${parts.join(' | ')}`;
              }
            }

            allEntries.push({
              id: `je-${je.id}-${Math.random()}`,
              date: je.date,
              type: je.reference_type || 'journal',
              reference: je.reference_number || '-',
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
        e.description.includes('رصيد افتتاحي')
      );
      
      const manualOpBal = hasOpeningBalanceInEntries ? 0 : customerOpBal;
      let balanceForward = 0;
      let filteredEntries = allEntries;
      const finalAllEntries = [];

      if (startDate) {
        const entriesBefore = allEntries.filter(e => e.date < startDate);
        balanceForward = manualOpBal + entriesBefore.reduce((sum, e) => sum + (Number(e.debit || 0) - Number(e.credit || 0)), 0);
        filteredEntries = allEntries.filter(e => e.date >= startDate);
        
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
      const finalEntries = filteredEntries.filter(e => !endDate || e.date <= endDate).map(entry => {
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
      [language === 'ar' ? 'المرجع' : 'Reference']: entry.reference,
      [language === 'ar' ? 'البيان' : 'Description']: entry.description,
      [language === 'ar' ? 'مدين (+)' : 'Debit (+)']: entry.debit,
      [language === 'ar' ? 'دائن (-)' : 'Credit (-)']: entry.credit,
      [language === 'ar' ? 'الرصيد' : 'Balance']: entry.balance
    }));
    
    exportToExcel(data, { 
      filename: `statement_${customerInfo.name}_${new Date().toISOString().slice(0,10)}`,
      sheetName: "Statement"
    });
  };

  const handleExportPDF = async () => {
    if (!reportRef.current || !customerInfo) return;
    try {
      await exportToPDF(reportRef.current, {
        filename: `statement_${customerInfo.name}_${new Date().toISOString().slice(0,10)}.pdf`,
        orientation: 'landscape',
        reportTitle: `كشف حساب عميل - ${customerInfo.name}`
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">كشف حساب العميل</h2>
          <p className="text-zinc-500">عرض الحركات المالية والارصدة لكل عميل.</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-1">
            <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">العميل</label>
            <div className="relative">
              <User className="absolute left-3 top-3 text-zinc-400" size={18} />
              <select 
                className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
              >
                <option value="">اختر العميل...</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>{customer.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">من تاريخ</label>
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
            <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">إلى تاريخ</label>
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
              {loading ? 'جاري التحميل...' : 'عرض التقرير'}
            </button>
            <button 
              onClick={generateStatement}
              disabled={loading || !selectedCustomerId}
              className="p-2.5 bg-white border border-zinc-200 text-zinc-600 rounded-xl hover:bg-zinc-50 hover:text-emerald-600 transition-all active:scale-95 shadow-sm disabled:opacity-50 h-[42px] flex items-center justify-center"
              title="تحديث البيانات"
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
                تصدير Excel
              </button>
              <button 
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-4 py-2 text-emerald-600 border border-emerald-200 rounded-xl hover:bg-emerald-50 transition-all"
              >
                <Download size={18} />
                تصدير PDF
              </button>
            </div>

            <div ref={reportRef} className="bg-white p-8 border border-zinc-100 rounded-2xl">
              <div className="text-center mb-8 border-b border-zinc-100 pb-6">
                <h3 className="text-2xl font-bold text-zinc-900 mb-2">كشف حساب عميل</h3>
                <div className="flex justify-center gap-8 text-sm text-zinc-500">
                  <p>العميل: <span className="font-bold text-zinc-900">{customerInfo?.name}</span></p>
                  <p>الفترة: <span className="font-bold text-zinc-900">{startDate || 'البداية'}</span> إلى <span className="font-bold text-zinc-900">{endDate}</span></p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 border-y border-zinc-100">
                      <th className="px-4 py-3 text-sm font-bold text-zinc-700">التاريخ</th>
                      <th className="px-4 py-3 text-sm font-bold text-zinc-700">النوع</th>
                      <th className="px-4 py-3 text-sm font-bold text-zinc-700">المرجع</th>
                      <th className="px-4 py-3 text-sm font-bold text-zinc-700">البيان</th>
                      <th className="px-4 py-3 text-sm font-bold text-zinc-700">مدين</th>
                      <th className="px-4 py-3 text-sm font-bold text-zinc-700">دائن</th>
                      <th className="px-4 py-3 text-sm font-bold text-zinc-700">الرصيد</th>
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
                              entry.type === 'invoice' ? 'bg-emerald-50 text-emerald-600' :
                              entry.type === 'receipt' ? 'bg-amber-50 text-amber-600' :
                              entry.type === 'receipt_voucher' ? 'bg-amber-50 text-amber-600' :
                              entry.type === 'return' ? 'bg-emerald-50 text-emerald-600' :
                              entry.type === 'journal' ? 'bg-blue-50 text-blue-600' :
                              entry.type === 'manual' ? 'bg-blue-50 text-blue-600' :
                              entry.type === 'opening_balance' ? 'bg-zinc-100 text-zinc-600' :
                              'bg-zinc-100 text-zinc-600'
                            }`}
                          >
                            {entry.type === 'invoice' ? 'فاتورة مبيعات' :
                             entry.type === 'receipt' ? 'سند قبض' :
                             entry.type === 'receipt_voucher' ? 'سند قبض' :
                             entry.type === 'return' ? 'مرتجع مبيعات' :
                             entry.type === 'journal' ? 'قيد يدوي' :
                             entry.type === 'manual' ? 'قيد يدوي' :
                             entry.type === 'opening_balance' ? 'رصيد أول' :
                             entry.type === 'discount' ? 'خصم' : 'قيد يومية'}
                          </span>
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
                        <td colSpan={7} className="px-4 py-8 text-center text-zinc-400 italic">لا توجد حركات في هذه الفترة</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-zinc-900 text-white font-bold">
                      <td colSpan={4} className="px-4 py-3 text-left">الرصيد الختامي</td>
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
            <p className="text-zinc-500">لا توجد حركات مالية لهذا العميل في الفترة المحددة.</p>
          </div>
        )}
      </div>
    </div>
  );
};
