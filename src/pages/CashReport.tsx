import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { PaymentMethod } from '../types';
import { Search, Calendar, Download, Wallet, CreditCard, ArrowUpRight, ArrowDownLeft, FileText } from 'lucide-react';
import { exportToPDF as exportToPDFUtil } from '../utils/pdfUtils';
import { exportToExcel, formatDataForExcel } from '../utils/excelUtils';
import { dbService } from '../services/dbService';
import { ExportButtons } from '../components/ExportButtons';

interface CashTransaction {
  id: string;
  date: string;
  type: string;
  reference: string;
  in: number;
  out: number;
  notes: string;
  balance?: number;
}

export const CashReport: React.FC = () => {
  const { user } = useAuth();
  const { t, dir } = useLanguage();
  const reportRef = useRef<HTMLDivElement>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [startBalance, setStartBalance] = useState(0);

  useEffect(() => {
    if (user) {
      const unsub = dbService.subscribe<PaymentMethod>('payment_methods', user.company_id, setPaymentMethods);
      return () => unsub();
    }
  }, [user]);

  const fetchData = async () => {
    if (!selectedMethodId || !user) return;
    setLoading(true);
    try {
      const method = paymentMethods.find(m => m.id === selectedMethodId);
      setOpeningBalance(method?.opening_balance || 0);

      const [invoices, returns, receipts, purInvoices, purReturns, vouchers, transfers, journalEntries] = await Promise.all([
        dbService.getDocsByFilter<any>('invoices', user.company_id, [{ field: 'payment_method_id', operator: '==', value: selectedMethodId }]),
        dbService.getDocsByFilter<any>('returns', user.company_id, [{ field: 'payment_method_id', operator: '==', value: selectedMethodId }]),
        dbService.getDocsByFilter<any>('receipt_vouchers', user.company_id, [{ field: 'payment_method_id', operator: '==', value: selectedMethodId }]),
        dbService.getDocsByFilter<any>('purchase_invoices', user.company_id, [{ field: 'payment_method_id', operator: '==', value: selectedMethodId }]),
        dbService.getDocsByFilter<any>('purchase_returns', user.company_id, [{ field: 'payment_method_id', operator: '==', value: selectedMethodId }]),
        dbService.getDocsByFilter<any>('payment_vouchers', user.company_id, [{ field: 'payment_method_id', operator: '==', value: selectedMethodId }]),
        dbService.list<any>('cash_transfers', user.company_id),
        dbService.list<any>('journal_entries', user.company_id)
      ]);

      const allTrans: CashTransaction[] = [];

      invoices.forEach((inv: any) => {
        allTrans.push({ id: `inv-${inv.id}`, date: inv.date, type: t('invoices.title'), reference: inv.invoice_number, in: inv.total_amount, out: 0, notes: '' });
      });
      returns.forEach((ret: any) => {
        allTrans.push({ id: `ret-${ret.id}`, date: ret.date, type: t('returns.title'), reference: ret.return_number, in: 0, out: ret.total_amount, notes: '' });
      });
      receipts.forEach((rec: any) => {
        allTrans.push({ id: `rec-${rec.id}`, date: rec.date, type: t('vouchers.receipt'), reference: `${t('vouchers.voucher')}-${rec.id.slice(-6)}`, in: rec.amount, out: 0, notes: rec.description || '' });
      });
      purInvoices.forEach((pinv: any) => {
        allTrans.push({ id: `pinv-${pinv.id}`, date: pinv.date, type: t('purchase_invoices.title'), reference: pinv.invoice_number, in: 0, out: pinv.total_amount, notes: '' });
      });
      purReturns.forEach((pret: any) => {
        allTrans.push({ id: `pret-${pret.id}`, date: pret.date, type: t('purchase_returns.title'), reference: pret.return_number, in: pret.total_amount, out: 0, notes: '' });
      });
      vouchers.forEach((vou: any) => {
        allTrans.push({ id: `vou-${vou.id}`, date: vou.date, type: t('vouchers.payment'), reference: `${t('vouchers.voucher')}-${vou.id.slice(-6)}`, in: 0, out: vou.amount, notes: vou.description || '' });
      });
      transfers.forEach((tr: any) => {
        if (tr.from_payment_method_id === selectedMethodId) {
          allTrans.push({ id: `tr-out-${tr.id}`, date: tr.date, type: t('cash_transfers.outgoing'), reference: `${t('cash_transfers.transfer')}-${tr.id.slice(-6)}`, in: 0, out: tr.amount, notes: `${t('common.to')} ${tr.to_payment_method_name}: ${tr.description}` });
        }
        if (tr.to_payment_method_id === selectedMethodId) {
          allTrans.push({ id: `tr-in-${tr.id}`, date: tr.date, type: t('cash_transfers.incoming'), reference: `${t('cash_transfers.transfer')}-${tr.id.slice(-6)}`, in: tr.amount, out: 0, notes: `${t('common.from')} ${tr.from_payment_method_name}: ${tr.description}` });
        }
      });

      // Add manual journal entries that affect this account
      if (method?.account_id) {
        journalEntries.forEach((je: any) => {
          if (je.reference_type === 'manual') {
            je.items?.forEach((item: any) => {
              if (item.account_id === method.account_id) {
                if (item.debit > 0) {
                  allTrans.push({ 
                    id: `je-in-${je.id}-${item.account_id}`, 
                    date: je.date, 
                    type: `${t('journal.manual')} (${t('reports.in')})`, 
                    reference: je.reference_number || `${t('journal.entry')}-${je.id.slice(-6)}`, 
                    in: item.debit, 
                    out: 0, 
                    notes: je.description 
                  });
                }
                if (item.credit > 0) {
                  allTrans.push({ 
                    id: `je-out-${je.id}-${item.account_id}`, 
                    date: je.date, 
                    type: `${t('journal.manual')} (${t('reports.out')})`, 
                    reference: je.reference_number || `${t('journal.entry')}-${je.id.slice(-6)}`, 
                    in: 0, 
                    out: item.credit, 
                    notes: je.description 
                  });
                }
              }
            });
          }
        });
      }

      allTrans.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const filtered = allTrans.filter(t => {
        const d = new Date(t.date);
        const s = startDate ? new Date(startDate) : new Date(0);
        const e = endDate ? new Date(endDate) : new Date();
        e.setHours(23, 59, 59, 999);
        return d >= s && d <= e;
      });

      const before = allTrans.filter(t => startDate && new Date(t.date) < new Date(startDate));
      const balBefore = before.reduce((sum, t) => sum + (t.in - t.out), 0);

      const initialBalance = (method?.opening_balance || 0) + balBefore;
      setStartBalance(initialBalance);
      
      let currentBal = initialBalance;
      const finalTrans = filtered.map(t => {
        currentBal += (t.in - t.out);
        return { ...t, balance: currentBal };
      });

      setTransactions(finalTrans);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    const headers = {
      'date': t('common.date'),
      'type': t('reports.transaction_type'),
      'reference': t('reports.reference'),
      'in': t('reports.in'),
      'out': t('reports.out'),
      'balance': t('reports.balance'),
      'notes': t('reports.notes')
    };
    const formattedData = formatDataForExcel(transactions, headers);
    exportToExcel(formattedData, { filename: 'Cash_Report', sheetName: t('reports.cash') });
  };

  const handleExportPDF = async () => {
    if (reportRef.current) {
      await exportToPDFUtil(reportRef.current, { 
        filename: 'Cash_Report', 
        orientation: 'landscape',
        reportTitle: t('reports.cash_title')
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">{t('reports.cash_title')}</h2>
          <p className="text-zinc-500">{t('reports.cash_subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportButtons 
            onExportExcel={handleExportExcel} 
            onExportPDF={handleExportPDF} 
          />
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-1">
            <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('reports.financial_account')}</label>
            <div className="relative">
              <CreditCard className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
              <select 
                className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
                value={selectedMethodId}
                onChange={(e) => setSelectedMethodId(e.target.value)}
              >
                <option value="">{t('reports.select_account')}</option>
                {paymentMethods.map(method => (
                  <option key={method.id} value={method.id}>{method.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('reports.from_date')}</label>
            <div className="relative">
              <Calendar className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
              <input 
                type="date" 
                className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('reports.to_date')}</label>
            <div className="relative">
              <Calendar className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
              <input 
                type="date" 
                className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <button 
            onClick={fetchData}
            disabled={loading || !selectedMethodId}
            className="flex items-center justify-center gap-2 px-6 py-2 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-all disabled:opacity-50 h-[42px]"
          >
            {loading ? t('common.loading') : t('reports.view_report')}
          </button>
        </div>

        {(transactions.length > 0 || startBalance !== 0) && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button 
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-4 py-2 text-emerald-600 border border-emerald-200 rounded-xl hover:bg-emerald-50 transition-all"
              >
                <Download size={18} />
                {t('common.export_pdf')}
              </button>
            </div>

            <div ref={reportRef} className="bg-white p-8 border border-zinc-100 rounded-2xl">
              <div className="text-center mb-8 border-b border-zinc-100 pb-6">
                <h3 className="text-2xl font-bold text-zinc-900 mb-2">{t('reports.cash_movement_title')}</h3>
                <div className="flex justify-center gap-8 text-sm text-zinc-500">
                  <p>{t('reports.financial_account')}: <span className="font-bold text-zinc-900">{paymentMethods.find(m => m.id === selectedMethodId)?.name}</span></p>
                  <p>{t('common.period')}: <span className="font-bold text-zinc-900">{startDate || t('common.start')}</span> {t('common.to')} <span className="font-bold text-zinc-900">{endDate}</span></p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className={`w-full border-collapse ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                  <thead>
                    <tr className="bg-zinc-50 border-y border-zinc-100">
                      <th className="px-4 py-3 text-sm font-bold text-zinc-700">{t('common.date')}</th>
                      <th className="px-4 py-3 text-sm font-bold text-zinc-700">{t('reports.transaction_type')}</th>
                      <th className="px-4 py-3 text-sm font-bold text-zinc-700">{t('reports.reference')}</th>
                      <th className="px-4 py-3 text-sm font-bold text-zinc-700">{t('common.description')}</th>
                      <th className="px-4 py-3 text-sm font-bold text-zinc-700">{t('reports.total_in')}</th>
                      <th className="px-4 py-3 text-sm font-bold text-zinc-700">{t('reports.total_out')}</th>
                      <th className="px-4 py-3 text-sm font-bold text-zinc-700">{t('reports.balance')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Opening Balance Row */}
                    <tr className="border-b border-zinc-50 bg-zinc-50/30">
                      <td className="px-4 py-3 text-sm font-mono">{startDate || '-'}</td>
                      <td className="px-4 py-3 text-sm"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-600">{t('reports.balance')}</span></td>
                      <td className="px-4 py-3 text-sm font-mono">-</td>
                      <td className="px-4 py-3 text-sm">{t('reports.brought_forward')}</td>
                      <td className="px-4 py-3 text-sm font-bold text-emerald-600">{startBalance > 0 ? startBalance.toLocaleString() : '-'}</td>
                      <td className="px-4 py-3 text-sm font-bold text-rose-600">{startBalance < 0 ? Math.abs(startBalance).toLocaleString() : '-'}</td>
                      <td className="px-4 py-3 text-sm font-bold text-zinc-900">{startBalance.toLocaleString()}</td>
                    </tr>
                    {transactions.map((t) => (
                      <tr key={t.id} className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors">
                        <td className="px-4 py-3 text-sm font-mono">{t.date}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            t.in > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                          }`}>
                            {t.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-mono">{t.reference}</td>
                        <td className="px-4 py-3 text-sm">{t.notes}</td>
                        <td className="px-4 py-3 text-sm font-bold text-emerald-600">{t.in > 0 ? t.in.toLocaleString() : '-'}</td>
                        <td className="px-4 py-3 text-sm font-bold text-rose-600">{t.out > 0 ? t.out.toLocaleString() : '-'}</td>
                        <td className="px-4 py-3 text-sm font-bold text-zinc-900">{t.balance?.toLocaleString()}</td>
                      </tr>
                    ))}
                    {transactions.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-zinc-400 italic">{t('reports.no_transactions')}</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-zinc-900 text-white font-bold">
                      <td colSpan={4} className={`px-4 py-3 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>{t('common.total')}</td>
                      <td className="px-4 py-3">{(transactions.reduce((sum, t) => sum + t.in, 0) + (startBalance > 0 ? startBalance : 0)).toLocaleString()}</td>
                      <td className="px-4 py-3">{(transactions.reduce((sum, t) => sum + t.out, 0) + (startBalance < 0 ? Math.abs(startBalance) : 0)).toLocaleString()}</td>
                      <td className="px-4 py-3">{(transactions.length > 0 ? transactions[transactions.length - 1].balance : startBalance)?.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {!loading && transactions.length === 0 && startBalance === 0 && selectedMethodId && (
          <div className="text-center py-12 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
            <Wallet className="mx-auto text-zinc-300 mb-4" size={48} />
            <p className="text-zinc-500">{t('reports.no_data')}</p>
          </div>
        )}
      </div>
    </div>
  );
};
