import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PaymentMethod, JournalEntry } from '../types';
import { Calendar, Download, Printer, Wallet, ArrowLeftRight, BarChart3, RefreshCcw } from 'lucide-react';
import { exportToPDF } from '../utils/pdfUtils';
import { exportToExcel } from '../utils/excelUtils';
import { dbService } from '../services/dbService';
import { formatNumber } from '../utils/formatUtils';

interface CashBalanceData {
  id: string;
  name: string;
  opening: {
    in: number;
    out: number;
    balance: number;
  };
  movement: {
    in: number;
    out: number;
  };
  closing: {
    in: number;
    out: number;
    balance: number;
  };
}

export const CashBalances: React.FC = () => {
  const { user } = useAuth();
  const reportRef = useRef<HTMLDivElement>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [balances, setBalances] = useState<CashBalanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (user) {
      const unsub = dbService.subscribe<PaymentMethod>(
        'payment_methods', 
        user.company_id, 
        (data) => {
          setPaymentMethods(data);
          if (data.length === 0) setLoading(false);
        },
        (err) => {
          setError(err.message);
          setLoading(false);
        }
      );
      return () => unsub();
    } else {
      setLoading(false);
    }
  }, [user, refreshTrigger]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      // If we don't have payment methods yet, or the list is empty, we finish loading
      if (paymentMethods.length === 0) {
        if (!loading) return; 
        setLoading(false);
        return;
      }
      
      setError(null);
      setLoading(true);
      try {
        const [paymentMethodsData, journalEntries, invoices, purchaseInvoices] = await Promise.all([
          dbService.list<PaymentMethod>('payment_methods', user.company_id),
          dbService.list<JournalEntry>('journal_entries', user.company_id),
          dbService.list<any>('invoices', user.company_id),
          dbService.list<any>('purchase_invoices', user.company_id)
        ]);

        const startStr = dateRange.start;
        const endStr = dateRange.end;

        const calculatedBalances = paymentMethodsData.map(method => {
          let opIn = 0;
          let opOut = 0;
          let movIn = 0;
          let movOut = 0;

          // Process ALL journal entries for this method's account
          journalEntries.forEach(je => {
            const jeDateStr = (je.date || '').slice(0, 10);

            je.items?.forEach((item: any) => {
              let isMatch = false;

              // 1. Check strict sub_account match
              if (item.sub_account_id && item.sub_account_type === 'payment_method') {
                isMatch = item.sub_account_id === method.id && item.account_id === method.account_id;
              } 
              // 2. Check Opening Balances explicitly
              else if (je.reference_type === 'opening_balance' && je.reference_id === method.id) {
                isMatch = item.account_id === method.account_id;
              } 
              // 3. Look up real reference mapping for missing data (e.g. backend auto-generated JEs)
              else if (item.account_id === method.account_id && !item.sub_account_id) {
                if (je.reference_type === 'invoice') {
                  const invoice = invoices.find(i => i.id === je.reference_id);
                  if (invoice && invoice.payment_type === 'cash' && invoice.payment_method_id === method.id) {
                    isMatch = true;
                  }
                } else if (je.reference_type === 'purchase_invoice') {
                  const pInvoice = purchaseInvoices.find(i => i.id === je.reference_id);
                  if (pInvoice && pInvoice.payment_type === 'cash' && pInvoice.payment_method_id === method.id) {
                    isMatch = true;
                  }
                } else {
                  // Support for legacy entries before sub_accounts were enforced
                  const sharingMethods = paymentMethodsData.filter(p => p.account_id === method.account_id);
                  if (sharingMethods.length === 1) {
                    isMatch = true;
                  } else {
                    const matchDesc = (desc: string) => {
                      if (!desc) return false;
                      const hasName = desc.includes(method.name) || (method.code && desc.includes(method.code));
                      if (!hasName) return false;
                      
                      const longerMatch = paymentMethodsData.find(other => {
                        if (other.id === method.id) return false;
                        if (other.name.length <= method.name.length) return false;
                        if (!other.name.includes(method.name)) return false;
                        return desc.includes(other.name) || (other.code && desc.includes(other.code));
                      });
                      return !longerMatch;
                    };
                    
                    // Special handling for transfers to avoid double-matching when both names are in description
                    if (je.reference_type === 'transfer' || je.reference_type === 'cash_transfer' || je.description?.includes('تحويل')) {
                      // Try to be more specific with item description if available
                      if (item.description) {
                        // If it's a debit (incoming), it should only match if it's NOT explicitly from us
                        // or if it explicitly says it's to us
                        const isToUs = item.description.includes(`إلى ${method.name}`) || item.description.includes(`وارد ${method.name}`);
                        const isFromUs = item.description.includes(`من ${method.name}`) || item.description.includes(`صادر ${method.name}`);
                        
                        if (item.debit > 0) isMatch = isToUs || (matchDesc(item.description) && !isFromUs);
                        else if (item.credit > 0) isMatch = isFromUs || (matchDesc(item.description) && !isToUs);
                        else isMatch = matchDesc(item.description);
                      } else {
                        isMatch = matchDesc(je.description);
                      }
                    } else {
                      isMatch = matchDesc(item.description) || matchDesc(je.description);
                    }
                  }
                }
              }

              if (isMatch) {
                const amountDebit = Number(item.debit || 0);
                const amountCredit = Number(item.credit || 0);

                if (startStr && jeDateStr < startStr) {
                  opIn += amountDebit;
                  opOut += amountCredit;
                } else if ((!startStr || jeDateStr >= startStr) && (!endStr || jeDateStr <= endStr)) {
                  movIn += amountDebit;
                  movOut += amountCredit;
                }
              }
            });
          });

          const opBalance = opIn - opOut;
          const clBalance = opBalance + (movIn - movOut);

          const netOpIn = opBalance >= 0 ? opBalance : 0;
          const netOpOut = opBalance < 0 ? Math.abs(opBalance) : 0;

          return {
            id: method.id,
            name: method.name,
            opening: {
              in: netOpIn,
              out: netOpOut,
              balance: opBalance
            },
            movement: {
              in: movIn,
              out: movOut
            },
            closing: {
              in: netOpIn + movIn,
              out: netOpOut + movOut,
              balance: clBalance
            }
          };
        });

        setBalances(calculatedBalances);
      } catch (e: any) {
        console.error(e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, paymentMethods, dateRange, refreshTrigger]);

  const handleRefresh = () => {
    setLoading(true);
    setRefreshTrigger(prev => prev + 1);
  };

  const totals = balances.reduce((acc, b) => ({
    opIn: Number(acc.opIn) + Number(b.opening.in),
    opOut: Number(acc.opOut) + Number(b.opening.out),
    movIn: Number(acc.movIn) + Number(b.movement.in),
    movOut: Number(acc.movOut) + Number(b.movement.out),
    clIn: Number(acc.clIn) + Number(b.closing.in),
    clOut: Number(acc.clOut) + Number(b.closing.out),
    clBal: Number(acc.clBal) + Number(b.closing.balance)
  }), { opIn: 0, opOut: 0, movIn: 0, movOut: 0, clIn: 0, clOut: 0, clBal: 0 });

  const handleExportPDF = async () => {
    if (reportRef.current) {
      await exportToPDF(reportRef.current, { 
        filename: 'Cash_Balances', 
        orientation: 'landscape',
        reportTitle: 'ميزان مراجعة الخزائن والبنوك'
      });
    }
  };

  const handleExportExcel = () => {
    const data = balances.map(b => ({
      'الحساب': b.name,
      'رصيد أول وارد': b.opening.in,
      'رصيد أول صادر': b.opening.out,
      'حركة وارد': b.movement.in,
      'حركة صادر': b.movement.out,
      'رصيد آخر وارد': b.closing.in,
      'رصيد آخر صادر': b.closing.out,
      'الرصيد النهائي': b.closing.balance
    }));
    exportToExcel(data, { filename: 'Cash_Balances' });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-zinc-500 font-medium italic animate-pulse">جاري تحميل البيانات...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 p-8 bg-emerald-50 rounded-3xl border border-emerald-100 italic">
        <p className="text-emerald-600 font-bold">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-zinc-900">ميزان مراجعة الخزائن</h2>
          <p className="text-zinc-500 font-medium mt-1">عرض أرصدة وحركات كافة الخزائن والبنوك</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleRefresh}
            className="p-3 bg-white border border-zinc-200 text-zinc-600 rounded-2xl hover:bg-zinc-50 hover:text-emerald-600 transition-all hover:scale-105 active:scale-95 shadow-sm"
            title="تحديث البيانات"
          >
            <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={handleExportPDF} className="p-2.5 bg-white border border-zinc-200 text-zinc-600 rounded-xl hover:bg-zinc-50 transition-all shadow-sm"><Printer size={20} /></button>
          <button onClick={handleExportExcel} className="p-2.5 bg-white border border-zinc-200 text-zinc-600 rounded-xl hover:bg-zinc-50 transition-all shadow-sm"><Download size={20} /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <Calendar className="absolute right-3 top-3 text-zinc-400" size={20} />
          <input
            type="date"
            className="w-full pr-10 pl-4 py-3 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
          />
        </div>
        <div className="relative">
          <Calendar className="absolute right-3 top-3 text-zinc-400" size={20} />
          <input
            type="date"
            className="w-full pr-10 pl-4 py-3 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
          />
        </div>
      </div>

      <div ref={reportRef} className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-zinc-100 border-b border-zinc-200">
                <th rowSpan={2} className="px-6 py-4 text-sm font-bold text-zinc-700 border-l border-zinc-200">الحساب</th>
                <th colSpan={2} className="px-6 py-2 text-sm font-bold text-zinc-700 text-center border-b border-zinc-200 border-l border-zinc-200">رصيد أول</th>
                <th colSpan={2} className="px-6 py-2 text-sm font-bold text-zinc-700 text-center border-b border-zinc-200 border-l border-zinc-200">الحركة</th>
                <th colSpan={2} className="px-6 py-2 text-sm font-bold text-zinc-700 text-center border-b border-zinc-200 border-l border-zinc-200">المجاميع</th>
                <th rowSpan={2} className="px-6 py-4 text-sm font-bold text-zinc-700 text-center">الرصيد النهائي</th>
              </tr>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                <th className="px-4 py-2 text-xs font-bold text-zinc-600 text-center border-l border-zinc-200">وارد</th>
                <th className="px-4 py-2 text-xs font-bold text-zinc-600 text-center border-l border-zinc-200">صادر</th>
                <th className="px-4 py-2 text-xs font-bold text-zinc-600 text-center border-l border-zinc-200">وارد</th>
                <th className="px-4 py-2 text-xs font-bold text-zinc-600 text-center border-l border-zinc-200">صادر</th>
                <th className="px-4 py-2 text-xs font-bold text-zinc-600 text-center border-l border-zinc-200">وارد</th>
                <th className="px-4 py-2 text-xs font-bold text-zinc-600 text-center border-l border-zinc-200">صادر</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {balances.map((b) => (
                <tr key={b.id} className="hover:bg-zinc-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-bold text-zinc-900 border-l border-zinc-100">{b.name}</td>
                  <td className="px-4 py-4 text-sm font-black text-emerald-600 text-center border-l border-zinc-100">{b.opening.in > 0 ? formatNumber(b.opening.in) : '-'}</td>
                  <td className="px-4 py-4 text-sm font-black text-zinc-500 text-center border-l border-zinc-100">{b.opening.out > 0 ? formatNumber(b.opening.out) : '-'}</td>
                  <td className="px-4 py-4 text-sm font-black text-emerald-600 text-center border-l border-zinc-100">{b.movement.in > 0 ? formatNumber(b.movement.in) : '-'}</td>
                  <td className="px-4 py-4 text-sm font-black text-zinc-500 text-center border-l border-zinc-100">{b.movement.out > 0 ? formatNumber(b.movement.out) : '-'}</td>
                  <td className="px-4 py-4 text-sm font-black text-emerald-600 text-center border-l border-zinc-100">{b.closing.in > 0 ? formatNumber(b.closing.in) : '-'}</td>
                  <td className="px-4 py-4 text-sm font-black text-zinc-500 text-center border-l border-zinc-100">{b.closing.out > 0 ? formatNumber(b.closing.out) : '-'}</td>
                  <td className="px-4 py-4 text-sm font-black text-center">
                    <span className={b.closing.balance >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                      {formatNumber(b.closing.balance)}
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="bg-zinc-900 text-white font-black">
                <td className="px-6 py-4 text-sm text-center">الإجمالي</td>
                <td className="px-4 py-4 text-sm text-center">{formatNumber(totals.opIn)}</td>
                <td className="px-4 py-4 text-sm text-center">{formatNumber(totals.opOut)}</td>
                <td className="px-4 py-4 text-sm text-center">{formatNumber(totals.movIn)}</td>
                <td className="px-4 py-4 text-sm text-center">{formatNumber(totals.movOut)}</td>
                <td className="px-4 py-4 text-sm text-center">{formatNumber(totals.clIn)}</td>
                <td className="px-4 py-4 text-sm text-center">{formatNumber(totals.clOut)}</td>
                <td className="px-4 py-4 text-sm text-center">{formatNumber(totals.clBal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
