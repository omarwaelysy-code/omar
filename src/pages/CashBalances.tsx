import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PaymentMethod } from '../types';
import { Calendar, Download, Printer, Wallet, ArrowLeftRight, BarChart3 } from 'lucide-react';
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
  }, [user]);

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
        const [invoices, returns, receipts, purInvoices, purReturns, vouchers, transfers, journalEntries] = await Promise.all([
          dbService.list<any>('invoices', user.company_id),
          dbService.list<any>('returns', user.company_id),
          dbService.list<any>('receipt_vouchers', user.company_id),
          dbService.list<any>('purchase_invoices', user.company_id),
          dbService.list<any>('purchase_returns', user.company_id),
          dbService.list<any>('payment_vouchers', user.company_id),
          dbService.list<any>('cash_transfers', user.company_id),
          dbService.list<any>('journal_entries', user.company_id)
        ]);

        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999);

        const methodMap = new Map(paymentMethods.map(m => [m.id, m.account_id]));

        const calculatedBalances = paymentMethods.map(method => {
          let opIn = Number(method.opening_balance) > 0 ? Number(method.opening_balance) : 0;
          let opOut = Number(method.opening_balance) < 0 ? Math.abs(Number(method.opening_balance)) : 0;
          let movIn = 0;
          let movOut = 0;

          const opDate = method.opening_balance_date ? new Date(method.opening_balance_date) : new Date(0);

          const processTrans = (trans: any[], direction: 'in' | 'out') => {
            trans.forEach(t => {
              if (!t) return;
              const matchesMethod = t.payment_method_id === method.id;
              const matchesAccount = method.account_id && t.account_id === method.account_id;
              
              if (!(matchesMethod || matchesAccount)) return;

              // Only count invoices/purchase invoices if they are paid (cash transactions)
              const isPaid = !t.status || t.status === 'paid' || t.payment_status === 'paid' || t.payment_status === 'partially_paid';
              if (!isPaid && (t.invoice_number || t.return_number)) return;

              const d = new Date(t.date);
              d.setHours(0, 0, 0, 0);
              // Skip transactions before opening balance date. Transactions ON the date are movements.
              if (d < opDate) return;

              const amount = Number(t.paid_amount || t.amount || t.total_amount || 0);
              if (amount === 0) return;

              if (d < startDate) {
                if (direction === 'in') opIn = Number(opIn) + amount;
                else opOut = Number(opOut) + amount;
              } else if (d >= startDate && d <= endDate) {
                if (direction === 'in') movIn = Number(movIn) + amount;
                else movOut = Number(movOut) + amount;
              }
            });
          };

          processTrans(invoices, 'in');
          processTrans(receipts, 'in');
          processTrans(purReturns, 'in');
          processTrans(returns, 'out');
          processTrans(purInvoices, 'out');
          processTrans(vouchers, 'out');

          // Handle transfers
          transfers.forEach(tr => {
            const d = new Date(tr.date);
            d.setHours(0, 0, 0, 0);
            if (d < opDate) return;

            const amount = Number(tr.amount);
            const fromMatches = tr.from_payment_method_id === method.id || 
                               (method.account_id && methodMap.get(tr.from_payment_method_id) === method.account_id);
            const toMatches = tr.to_payment_method_id === method.id || 
                             (method.account_id && methodMap.get(tr.to_payment_method_id) === method.account_id);
            
            if (fromMatches) {
              if (d < startDate) opOut = Number(opOut) + amount;
              else if (d >= startDate && d <= endDate) movOut = Number(movOut) + amount;
            }
            
            if (toMatches) {
              if (d < startDate) opIn = Number(opIn) + amount;
              else if (d >= startDate && d <= endDate) movIn = Number(movIn) + amount;
            }
          });

          // Handle manual journal entries
          if (method.account_id) {
            journalEntries.forEach(je => {
              if (je.reference_type === 'manual') {
                je.items?.forEach((item: any) => {
                  if (item.account_id === method.account_id) {
                    const d = new Date(je.date);
                    d.setHours(0, 0, 0, 0);
                    if (d < opDate) return;

                    if (d < startDate) {
                      opIn = Number(opIn) + Number(item.debit || 0);
                      opOut = Number(opOut) + Number(item.credit || 0);
                    } else if (d >= startDate && d <= endDate) {
                      movIn = Number(movIn) + Number(item.debit || 0);
                      movOut = Number(movOut) + Number(item.credit || 0);
                    }
                  }
                });
              }
            });
          }

          const opBalance = opIn - opOut;
          const clBalance = opBalance + (movIn - movOut);

          return {
            id: method.id,
            name: method.name,
            opening: {
              in: opIn,
              out: opOut,
              balance: opBalance
            },
            movement: {
              in: movIn,
              out: movOut
            },
            closing: {
              in: opIn + movIn,
              out: opOut + movOut,
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
  }, [user, paymentMethods, dateRange]);

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
      <div className="flex flex-col items-center justify-center h-64 gap-4 p-8 bg-rose-50 rounded-3xl border border-rose-100 italic">
        <p className="text-rose-600 font-bold">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all"
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
                  <td className="px-4 py-4 text-sm font-black text-rose-600 text-center border-l border-zinc-100">{b.opening.out > 0 ? formatNumber(b.opening.out) : '-'}</td>
                  <td className="px-4 py-4 text-sm font-black text-emerald-600 text-center border-l border-zinc-100">{b.movement.in > 0 ? formatNumber(b.movement.in) : '-'}</td>
                  <td className="px-4 py-4 text-sm font-black text-rose-600 text-center border-l border-zinc-100">{b.movement.out > 0 ? formatNumber(b.movement.out) : '-'}</td>
                  <td className="px-4 py-4 text-sm font-black text-emerald-600 text-center border-l border-zinc-100">{b.closing.in > 0 ? formatNumber(b.closing.in) : '-'}</td>
                  <td className="px-4 py-4 text-sm font-black text-rose-600 text-center border-l border-zinc-100">{b.closing.out > 0 ? formatNumber(b.closing.out) : '-'}</td>
                  <td className="px-4 py-4 text-sm font-black text-zinc-900 text-center">
                    <span className={b.closing.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
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
