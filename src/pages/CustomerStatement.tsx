import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Customer, Invoice, ReceiptVoucher, Return } from '../types';
import { Search, FileText, Download, Calendar, User, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { exportToPDF } from '../utils/pdfUtils';
import { dbService } from '../services/dbService';

import { utils, writeFile } from 'xlsx';

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
  const [customers, setCustomers] = useState<Customer[]>([]);
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

      let allEntries: any[] = [];

      // Add all journal entries related to this customer's account
      journalEntries.forEach((je: any) => {
        je.items?.forEach((item: any) => {
          // Only count lines that have the customer_id AND match the customer's ledger account
          // This prevents double entries if customer_id was accidentally set on both sides of a transaction
          if (item.customer_id === selectedCustomerId && item.account_id === customer?.account_id) {
            allEntries.push({
              id: `je-${je.id}-${Math.random()}`,
              date: je.date,
              type: je.reference_type || 'journal',
              reference: je.reference_number || '-',
              description: item.description || je.description || 'قيد مالي',
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
      let balanceForward = 0;
      let filteredEntries = allEntries;

      if (startDate) {
        const entriesBefore = allEntries.filter(e => e.date < startDate);
        balanceForward = entriesBefore.reduce((sum, e) => sum + (e.debit - e.credit), 0);
        filteredEntries = allEntries.filter(e => e.date >= startDate);
      }

      // Add Balance Forward entry if filtering by date OR if it's the start
      const finalAllEntries = [];
      if (startDate) {
        finalAllEntries.push({
          id: 'balance-forward',
          date: startDate,
          type: 'opening_balance',
          reference: '-',
          description: 'رصيد منقول',
          debit: balanceForward > 0 ? balanceForward : 0,
          credit: balanceForward < 0 ? -balanceForward : 0,
          balance: balanceForward
        });
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
    return balance > 0 ? `+${balance.toLocaleString()}` : balance.toLocaleString();
  };

  const handleExportExcel = () => {
    if (entries.length === 0 || !customerInfo) return;
    const data = entries.map(entry => ({
      'التاريخ': entry.date,
      'النوع': entry.type,
      'المرجع': entry.reference,
      'البيان': entry.description,
      'مدين (+)': entry.debit,
      'دائن (-)': entry.credit,
      'الرصيد': entry.balance
    }));
    const ws = utils.json_to_sheet(data);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Statement");
    writeFile(wb, `statement_${customerInfo.name}_${new Date().toISOString().slice(0,10)}.xlsx`);
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
          <button 
            onClick={generateStatement}
            disabled={loading || !selectedCustomerId}
            className="flex items-center justify-center gap-2 px-6 py-2 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-all disabled:opacity-50 h-[42px]"
          >
            {loading ? 'جاري التحميل...' : 'عرض التقرير'}
          </button>
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
                        <td className="px-4 py-3 text-sm font-mono">{entry.date}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            entry.type === 'invoice' ? 'bg-emerald-50 text-emerald-600' :
                            entry.type === 'receipt' ? 'bg-amber-50 text-amber-600' :
                            entry.type === 'receipt_voucher' ? 'bg-amber-50 text-amber-600' :
                            entry.type === 'return' ? 'bg-rose-50 text-rose-600' :
                            entry.type === 'journal' ? 'bg-blue-50 text-blue-600' :
                            entry.type === 'manual' ? 'bg-blue-50 text-blue-600' :
                            entry.type === 'opening_balance' ? 'bg-zinc-100 text-zinc-600' :
                            'bg-zinc-100 text-zinc-600'
                          }`}>
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
                        <td className="px-4 py-3 text-sm font-mono">{entry.reference}</td>
                        <td className="px-4 py-3 text-sm">{entry.description}</td>
                        <td className="px-4 py-3 text-sm font-bold text-emerald-600">{entry.debit > 0 ? entry.debit.toLocaleString() : '-'}</td>
                        <td className="px-4 py-3 text-sm font-bold text-rose-600">{entry.credit > 0 ? entry.credit.toLocaleString() : '-'}</td>
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
                      <td className="px-4 py-3">{(entries.filter(e => e.id !== 'balance-forward').reduce((sum, e) => sum + e.debit, 0) + (entries.find(e => e.id === 'balance-forward')?.debit || 0)).toLocaleString()}</td>
                      <td className="px-4 py-3">{(entries.filter(e => e.id !== 'balance-forward').reduce((sum, e) => sum + e.credit, 0) + (entries.find(e => e.id === 'balance-forward')?.credit || 0)).toLocaleString()}</td>
                      <td className="px-4 py-3">{formatBalance(entries[entries.length - 1]?.balance)}</td>
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
