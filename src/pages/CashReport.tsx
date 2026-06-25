import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { PaymentMethod, JournalEntry } from '../types';
import { Search, Calendar, Download, Wallet, CreditCard, ArrowUpRight, ArrowDownLeft, FileText, RefreshCcw } from 'lucide-react';
import { exportToPDF as exportToPDFUtil } from '../utils/pdfUtils';
import { exportToExcel, formatDataForExcel } from '../utils/excelUtils';
import { dbService } from '../services/dbService';
import { ExportButtons } from '../components/ExportButtons';
import { formatNumber, formatMoney, formatDate } from '../utils/formatUtils';
import { useNavigation } from '../contexts/NavigationContext';

interface CashTransaction {
  id: string;
  date: string;
  type: string;
  reference: string;
  in: number;
  out: number;
  notes: string;
  balance?: number;
  doc_type?: string;
}

export const CashReport: React.FC = () => {
  const { user } = useAuth();
  const { t, dir } = useLanguage();
  const { setCurrentPage, setPendingViewDoc } = useNavigation();

  const handleTransactionClick = (type: string | undefined, reference: string) => {
    if (!reference || reference === '-' || reference === '') return;
    
    let normType = type;
    if (!normType) {
      if (reference.startsWith('INV-')) normType = 'invoice';
      else if (reference.startsWith('PINV-')) normType = 'purchase_invoice';
      else if (reference.startsWith('RCT-')) normType = 'receipt';
      else if (reference.startsWith('PAY-')) normType = 'payment_voucher';
      else if (reference.startsWith('RET-')) normType = 'return';
      else if (reference.startsWith('PRET-')) normType = 'purchase_return';
      else normType = 'manual';
    }
    
    if (normType === 'invoice') {
      setPendingViewDoc({ type: 'invoice', idOrNumber: reference });
      setCurrentPage('invoices');
    } else if (normType === 'purchase_invoice') {
      setPendingViewDoc({ type: 'purchase_invoice', idOrNumber: reference });
      setCurrentPage('purchase_invoices');
    } else if (normType === 'receipt' || normType === 'receipt_voucher') {
      setPendingViewDoc({ type: 'receipt', idOrNumber: reference });
      setCurrentPage('receipts');
    } else if (normType === 'payment_voucher') {
      setPendingViewDoc({ type: 'payment_voucher', idOrNumber: reference });
      setCurrentPage('payment_vouchers');
    } else if (normType === 'return') {
      setPendingViewDoc({ type: 'return', idOrNumber: reference });
      setCurrentPage('returns');
    } else if (normType === 'purchase_return') {
      setPendingViewDoc({ type: 'purchase_return', idOrNumber: reference });
      setCurrentPage('purchase_returns');
    } else {
      setPendingViewDoc({ type: 'manual', idOrNumber: reference });
      setCurrentPage('journal_entries');
    }
  };
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
      if (!method?.account_id) {
        setTransactions([]);
        setStartBalance(0);
        return;
      }

      const [journalEntries, invoices, purchaseInvoices] = await Promise.all([
        dbService.list<JournalEntry>('journal_entries', user.company_id),
        dbService.list<any>('invoices', user.company_id),
        dbService.list<any>('purchase_invoices', user.company_id)
      ]);

      const allTrans: CashTransaction[] = [];

      journalEntries.forEach(je => {
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
              const sharingMethods = paymentMethods.filter(p => p.account_id === method.account_id);
              if (sharingMethods.length === 1) {
                isMatch = true;
              } else {
                const matchDesc = (desc: string) => {
                  if (!desc) return false;
                  const hasName = desc.includes(method.name) || (method.code && desc.includes(method.code));
                  if (!hasName) return false;
                  
                  const longerMatch = paymentMethods.find(other => {
                    if (other.id === method.id) return false;
                    if (other.name.length <= method.name.length) return false;
                    if (!other.name.includes(method.name)) return false;
                    return desc.includes(other.name) || (other.code && desc.includes(other.code));
                  });
                  return !longerMatch;
                };

                // Special handling for transfers to avoid double-matching when both names are in description
                if (je.reference_type === 'transfer' || je.reference_type === 'cash_transfer' || je.description?.includes('تحويل')) {
                  if (item.description) {
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
                const transType = je.reference_type === 'manual' 
                  ? t('journal.manual') 
                  : (t(`reference_types.${je.reference_type}`) || je.reference_type);
                
                const transNotes = je.reference_type === 'opening_balance'
                  ? t('reference_types.opening_balance')
                  : (item.description || je.description || '');

                allTrans.push({
                  id: `${je.id}-${item.account_id}`,
                  date: je.date,
                  type: transType,
                  reference: je.reference_number || je.id.slice(-6),
                  in: Number(item.debit) || 0,
                  out: Number(item.credit) || 0,
                  notes: transNotes,
                  doc_type: je.reference_type
                });
              }
        });
      });

      allTrans.sort((a, b) => {
        const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return a.id.localeCompare(b.id);
      });

      const before = allTrans.filter(t => {
        const tDateStr = (t.date || '').slice(0, 10);
        return startDate && tDateStr < startDate;
      });
      const during = allTrans.filter(t => {
        const tDateStr = (t.date || '').slice(0, 10);
        return (!startDate || tDateStr >= startDate) && (!endDate || tDateStr <= endDate);
      });

      const balBefore = before.reduce((sum, t) => sum + (t.in - t.out), 0);
      setStartBalance(balBefore);

      let currentBal = balBefore;
      const finalTrans = during.map(t => {
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
          <button 
            onClick={fetchData}
            disabled={!selectedMethodId}
            className="p-3 bg-white border border-zinc-200 text-zinc-600 rounded-2xl hover:bg-zinc-50 hover:text-emerald-600 transition-all hover:scale-105 active:scale-95 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            title={t('reports.update_data')}
          >
            <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
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
                      <td className="px-4 py-3 text-sm font-mono">{startDate || (paymentMethods.find(m => m.id === selectedMethodId)?.opening_balance_date) || '-'}</td>
                      <td className="px-4 py-3 text-sm"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-600">{t('reports.brought_forward')}</span></td>
                      <td className="px-4 py-3 text-sm font-mono">-</td>
                      <td className="px-4 py-3 text-sm">{t('reports.brought_forward')}</td>
                      <td className="px-4 py-3 text-sm font-bold text-emerald-600">{startBalance > 0 ? formatMoney(startBalance) : '-'}</td>
                      <td className="px-4 py-3 text-sm font-bold text-emerald-600">{startBalance < 0 ? formatMoney(Math.abs(startBalance)) : '-'}</td>
                      <td className="px-4 py-3 text-sm font-bold text-zinc-900">{formatMoney(startBalance)}</td>
                    </tr>
                    {transactions.map((t) => (
                      <tr key={t.id} className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors">
                        <td className="px-4 py-3 text-sm font-mono">{formatDate(t.date)}</td>
                        <td className="px-4 py-3 text-sm">
                          <span 
                            onClick={() => handleTransactionClick(t.doc_type, t.reference)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer hover:scale-105 transition-all inline-block ${
                              t.in > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-emerald-50 text-emerald-600'
                            }`}
                          >
                            {t.type}
                          </span>
                        </td>
                        <td 
                          onClick={() => handleTransactionClick(t.doc_type, t.reference)}
                          className={`px-4 py-3 text-sm font-bold font-mono transition-colors ${t.reference && t.reference !== '-' ? 'text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer' : ''}`}
                        >
                          {t.reference}
                        </td>
                        <td className="px-4 py-3 text-sm">{t.notes}</td>
                        <td className="px-4 py-3 text-sm font-bold text-emerald-600">{t.in > 0 ? formatMoney(t.in) : '-'}</td>
                        <td className="px-4 py-3 text-sm font-bold text-emerald-600">{t.out > 0 ? formatMoney(t.out) : '-'}</td>
                        <td className="px-4 py-3 text-sm font-bold text-zinc-900">{t.balance !== undefined ? formatMoney(t.balance) : '-'}</td>
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
                      <td className="px-4 py-3">{formatMoney(transactions.reduce((sum, t) => sum + Number(t.in), 0) + (startBalance > 0 ? startBalance : 0))}</td>
                      <td className="px-4 py-3">{formatMoney(transactions.reduce((sum, t) => sum + Number(t.out), 0) + (startBalance < 0 ? Math.abs(startBalance) : 0))}</td>
                      <td className="px-4 py-3">{formatMoney(transactions.length > 0 ? (transactions[transactions.length - 1].balance ?? 0) : startBalance)}</td>
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
