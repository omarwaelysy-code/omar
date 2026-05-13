import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Customer, Invoice, ReceiptVoucher, Return } from '../types';
import { Search, FileText, Download, Calendar, User, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { exportToPDF } from '../utils/pdfUtils';
import { exportToExcel } from '../utils/excelUtils';
import { dbService } from '../services/dbService';
import { formatNumber, formatMoney, formatDate } from '../utils/formatUtils';
import { useLanguage } from '../contexts/LanguageContext';

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
      const customerOpBal = Number(customer?.opening_balance || 0);
      let balanceForward = customerOpBal;
      let filteredEntries = allEntries;

      if (startDate) {
        const entriesBefore = allEntries.filter(e => e.date < startDate);
        balanceForward = customerOpBal + entriesBefore.reduce((sum, e) => sum + (Number(e.debit || 0) - Number(e.credit || 0)), 0);
        filteredEntries = allEntries.filter(e => e.date >= startDate);
      } else {
        // If no start date, we show all entries.
        // We don't start from balanceForward because the opening balance might be one of the entries.
        balanceForward = 0;
      }

      // Add Balance Forward entry OR Opening Balance from profile if not in entries
      const finalAllEntries = [];
      const hasOpeningBalanceInEntries = allEntries.some(e => 
        e.type === 'opening_balance' || 
        e.description.includes('رصيد افتتاحي')
      );

      if (startDate) {
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
      } else if (customerOpBal !== 0 && !hasOpeningBalanceInEntries) {
        // If no start date, only add manual opening balance if it's NOT already in the transaction list
        finalAllEntries.push({
          id: 'opening-balance',
          date: allEntries[0]?.date || new Date().toISOString().slice(0, 10),
          type: 'opening_balance',
          reference: '-',
          description: language === 'ar' ? 'رصيد افتتاحي' : 'Opening Balance',
          debit: customerOpBal > 0 ? customerOpBal : 0,
          credit: customerOpBal < 0 ? Math.abs(customerOpBal) : 0,
          balance: customerOpBal
        });
        balanceForward = customerOpBal;
      } else {
        // No start date, and either no opening balance OR it's already in the entries.
        // If it's already in entries, the first entry will set the starting point correctly.
        balanceForward = 0;
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

  const { language } = useLanguage();

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
                        <td className="px-4 py-3 text-sm font-mono">{formatDate(entry.date)}</td>
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
                        <td className="px-4 py-3 text-sm font-bold text-emerald-600">{entry.debit > 0 ? formatNumber(entry.debit) : '-'}</td>
                        <td className="px-4 py-3 text-sm font-bold text-rose-600">{entry.credit > 0 ? formatNumber(entry.credit) : '-'}</td>
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
