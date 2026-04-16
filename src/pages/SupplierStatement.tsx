import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Supplier, PurchaseInvoice, PaymentVoucher, PurchaseReturn } from '../types';
import { Search, Calendar, FileText, Download, User, ArrowUpRight, ArrowDownLeft, Wallet } from 'lucide-react';
import { exportToPDF } from '../utils/pdfUtils';
import { dbService } from '../services/dbService';

import { utils, writeFile } from 'xlsx';

interface StatementItem {
  id: string;
  date: string;
  type: string;
  reference: string;
  debit: number; // المبلغ المستحق علينا (مشتريات)
  credit: number; // المبلغ المدفوع منا (سندات صرف، مرتجعات، خصومات)
  notes: string;
  balance?: number;
}

export const SupplierStatement: React.FC = () => {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [statement, setStatement] = useState<StatementItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [startBalance, setStartBalance] = useState(0);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      const unsub = dbService.subscribe<Supplier>('suppliers', user.company_id, setSuppliers);
      return () => unsub();
    }
  }, [user]);

  const fetchStatement = async () => {
    if (!selectedSupplierId || !user) return;
    setLoading(true);
    try {
      const supplier = suppliers.find(s => s.id === selectedSupplierId);
      const opBal = supplier?.opening_balance || 0;
      setOpeningBalance(opBal);

      const [invoices, returns, vouchers, discounts, journalEntries] = await Promise.all([
        dbService.list<PurchaseInvoice>('purchase_invoices', user.company_id),
        dbService.list<PurchaseReturn>('purchase_returns', user.company_id),
        dbService.list<PaymentVoucher>('payment_vouchers', user.company_id),
        dbService.list<any>('supplier_discounts', user.company_id),
        dbService.list<any>('journal_entries', user.company_id)
      ]);

      const allItems: StatementItem[] = [];

      // Add all journal entries related to this supplier's account
      journalEntries.forEach((je: any) => {
        je.items?.forEach((item: any) => {
          // Only count lines that have the supplier_id AND match the supplier's ledger account
          // This prevents double entries if supplier_id was accidentally set on both sides of a transaction
          if (item.supplier_id === selectedSupplierId && item.account_id === supplier?.account_id) {
            allItems.push({
              id: `je-${je.id}-${Math.random()}`,
              date: je.date,
              type: je.reference_type || 'manual',
              reference: je.reference_number || '-',
              debit: item.debit || 0,
              credit: item.credit || 0,
              notes: item.description || je.description || 'قيد مالي'
            });
          }
        });
      });

      // Sort by date and then by ID to ensure consistent order
      allItems.sort((a, b) => {
        const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return a.id.localeCompare(b.id);
      });

      // Filter by date range
      const filteredItems = allItems.filter(item => {
        const itemDate = new Date(item.date);
        const start = startDate ? new Date(startDate) : new Date(0);
        const end = endDate ? new Date(endDate) : new Date();
        end.setHours(23, 59, 59, 999);
        return itemDate >= start && itemDate <= end;
      });

      // Calculate balance forward
      const itemsBefore = allItems.filter(item => startDate && new Date(item.date) < new Date(startDate));
      const balanceBefore = itemsBefore.reduce((sum, item) => sum + (item.credit - item.debit), 0);
      
      const initialBalance = balanceBefore;
      setStartBalance(initialBalance);
      
      let currentBalance = initialBalance;
      const finalItems = filteredItems.map(item => {
        currentBalance += (item.credit - item.debit);
        return { ...item, balance: currentBalance };
      });

      setStatement(finalItems);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const formatBalance = (balance: number) => {
    if (balance === 0) return '0';
    // For suppliers, Credit is positive (+)
    return balance > 0 ? `+${balance.toLocaleString()}` : balance.toLocaleString();
  };

  const handleExportExcel = () => {
    if (statement.length === 0 || !selectedSupplierId) return;
    const supplier = suppliers.find(s => s.id === selectedSupplierId);
    const data = statement.map(entry => ({
      'التاريخ': entry.date,
      'النوع': entry.type,
      'المرجع': entry.reference,
      'البيان': entry.notes,
      'مدين (-)': entry.debit,
      'دائن (+)': entry.credit,
      'الرصيد': entry.balance
    }));
    const ws = utils.json_to_sheet(data);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Statement");
    writeFile(wb, `statement_${supplier?.name}_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const handleExportPDF = async () => {
    if (!reportRef.current || !selectedSupplierId) return;
    const supplier = suppliers.find(s => s.id === selectedSupplierId);
    try {
      await exportToPDF(reportRef.current, {
        filename: `statement_${supplier?.name}_${new Date().toISOString().slice(0,10)}.pdf`,
        orientation: 'landscape',
        reportTitle: `كشف حساب مورد - ${supplier?.name}`
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">كشف حساب مورد</h2>
          <p className="text-zinc-500">عرض الحركات المالية والارصدة لكل مورد.</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-1">
            <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">المورد</label>
            <div className="relative">
              <User className="absolute left-3 top-3 text-zinc-400" size={18} />
              <select 
                className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
              >
                <option value="">اختر المورد...</option>
                {suppliers.map(supplier => (
                  <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
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
            onClick={fetchStatement}
            disabled={loading || !selectedSupplierId}
            className="flex items-center justify-center gap-2 px-6 py-2 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-all disabled:opacity-50 h-[42px]"
          >
            {loading ? 'جاري التحميل...' : 'عرض التقرير'}
          </button>
        </div>

        {(statement.length > 0 || startBalance !== 0) && (
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
                <h3 className="text-2xl font-bold text-zinc-900 mb-2">كشف حساب مورد</h3>
                <div className="flex justify-center gap-8 text-sm text-zinc-500">
                  <p>المورد: <span className="font-bold text-zinc-900">{suppliers.find(s => s.id === selectedSupplierId)?.name}</span></p>
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
                    {/* Opening Balance Row */}
                    <tr className="border-b border-zinc-50 bg-zinc-50/30">
                      <td className="px-4 py-3 text-sm font-mono">{startDate || '-'}</td>
                      <td className="px-4 py-3 text-sm"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-600">رصيد</span></td>
                      <td className="px-4 py-3 text-sm font-mono">-</td>
                      <td className="px-4 py-3 text-sm">رصيد منقول</td>
                      <td className="px-4 py-3 text-sm font-bold text-emerald-600">{startBalance > 0 ? startBalance.toLocaleString() : '-'}</td>
                      <td className="px-4 py-3 text-sm font-bold text-rose-600">{startBalance < 0 ? Math.abs(startBalance).toLocaleString() : '-'}</td>
                      <td className="px-4 py-3 text-sm font-bold text-zinc-900">{formatBalance(startBalance)}</td>
                    </tr>
                    {statement.map((item) => (
                      <tr key={item.id} className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors">
                        <td className="px-4 py-3 text-sm font-mono">{item.date}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.type === 'purchase_invoice' ? 'bg-emerald-50 text-emerald-600' :
                            item.type === 'payment_voucher' ? 'bg-amber-50 text-amber-600' :
                            item.type === 'purchase_return' ? 'bg-rose-50 text-rose-600' :
                            item.type === 'manual' ? 'bg-blue-50 text-blue-600' :
                            item.type === 'opening_balance' ? 'bg-zinc-100 text-zinc-600' :
                            'bg-zinc-100 text-zinc-600'
                          }`}>
                            {item.type === 'purchase_invoice' ? 'فاتورة مشتريات' :
                             item.type === 'payment_voucher' ? 'سند صرف' :
                             item.type === 'purchase_return' ? 'مرتجع مشتريات' :
                             item.type === 'manual' ? 'قيد يدوي' :
                             item.type === 'opening_balance' ? 'رصيد أول' :
                             item.type === 'discount' ? 'خصم' : 'قيد يومية'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-mono">{item.reference}</td>
                        <td className="px-4 py-3 text-sm">{item.notes}</td>
                        <td className="px-4 py-3 text-sm font-bold text-emerald-600">{item.debit > 0 ? item.debit.toLocaleString() : '-'}</td>
                        <td className="px-4 py-3 text-sm font-bold text-rose-600">{item.credit > 0 ? item.credit.toLocaleString() : '-'}</td>
                        <td className="px-4 py-3 text-sm font-bold text-zinc-900">{formatBalance(item.balance || 0)}</td>
                      </tr>
                    ))}
                    {statement.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-zinc-400 italic">لا توجد حركات في هذه الفترة</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-zinc-900 text-white font-bold">
                      <td colSpan={4} className="px-4 py-3 text-left">الرصيد الختامي</td>
                      <td className="px-4 py-3">{(statement.reduce((sum, e) => sum + e.debit, 0) + (startBalance > 0 ? startBalance : 0)).toLocaleString()}</td>
                      <td className="px-4 py-3">{(statement.reduce((sum, e) => sum + e.credit, 0) + (startBalance < 0 ? Math.abs(startBalance) : 0)).toLocaleString()}</td>
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
            <p className="text-zinc-500">لا توجد حركات مالية لهذا المورد في الفترة المحددة.</p>
          </div>
        )}
      </div>
    </div>
  );
};
