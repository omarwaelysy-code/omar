import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Supplier } from '../types';
import { FileSpreadsheet, Download, Search, Truck, ArrowDownLeft, Wallet } from 'lucide-react';
import { exportToPDF } from '../utils/pdfUtils';
import { exportToExcel } from '../utils/excelUtils';
import { dbService } from '../services/dbService';
import { formatNumber, formatMoney, formatDate } from '../utils/formatUtils';
import { useLanguage } from '../contexts/LanguageContext';

export const SupplierBalances: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const reportRef = useRef<HTMLDivElement>(null);

  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [sups, invoices, returns, vouchers, discounts, journalEntries] = await Promise.all([
        dbService.list<Supplier>('suppliers', user.company_id),
        dbService.list<any>('purchase_invoices', user.company_id),
        dbService.list<any>('purchase_returns', user.company_id),
        dbService.list<any>('payment_vouchers', user.company_id),
        dbService.list<any>('supplier_discounts', user.company_id),
        dbService.list<any>('journal_entries', user.company_id)
      ]);

      const balances = sups.map((supplier: any) => {
        const supInvoices = invoices.filter((i: any) => i.supplier_id === supplier.id);
        const supReturns = returns.filter((r: any) => r.supplier_id === supplier.id);
        const supVouchers = vouchers.filter((v: any) => {
          if (v.supplier_id === supplier.id) return true;
          if ((v.voucher_type === 'multi' || v.type === 'multi') && v.items && Array.isArray(v.items)) {
            return v.items.some((item: any) => item.type === 'supplier' && item.entity_id === supplier.id);
          }
          return false;
        });
        const supDiscounts = discounts.filter((d: any) => d.supplier_id === supplier.id);
        
        const openingBalance = supplier.opening_balance || 0;
        let journalDebit = 0;
        let journalCredit = 0;
        let manualJournalDebit = 0;
        let manualJournalCredit = 0;

        journalEntries.forEach((je: any) => {
          je.items?.forEach((item: any) => {
            if (item.supplier_id === supplier.id) {
              const debit = item.debit || 0;
              const credit = item.credit || 0;
              journalDebit += debit;
              journalCredit += credit;
              
              if (je.reference_type === 'manual' || je.reference_type === 'journal') {
                manualJournalDebit += debit;
                manualJournalCredit += credit;
              }
            }
          });
        });

        const totalInvoices = supInvoices.reduce((sum: number, i: any) => sum + (Number(i.total_amount) || 0), 0);
        const totalReturns = supReturns.reduce((sum: number, r: any) => sum + (Number(r.total_amount) || 0), 0);
        const cashInvoicesAmount = supInvoices.filter((i: any) => i.payment_type === 'cash').reduce((sum: number, i: any) => sum + (Number(i.total_amount) || 0), 0);
        
        const totalVouchers = supVouchers.reduce((sum: number, v: any) => {
          if ((v.voucher_type === 'multi' || v.type === 'multi') && v.items && Array.isArray(v.items)) {
             const itemsSum = v.items
               .filter((item: any) => item.type === 'supplier' && item.entity_id === supplier.id)
               .reduce((itemSum: number, item: any) => itemSum + (Number(item.amount) || 0), 0);
             return sum + itemsSum;
          }
          if (v.supplier_id === supplier.id) {
             return sum + (Number(v.amount) || 0);
          }
          return sum;
        }, 0) + cashInvoicesAmount;
        const totalDiscounts = supDiscounts.reduce((sum: number, d: any) => sum + (Number(d.amount) || 0), 0);

        const currentBalance = openingBalance + totalInvoices - totalReturns - totalVouchers - totalDiscounts + (manualJournalCredit - manualJournalDebit);
        
        return {
          ...supplier,
          openingBalance,
          totalInvoices,
          totalReturns,
          totalVouchers,
          totalDiscounts,
          journalDebit,
          journalCredit,
          manualJournalImpact: manualJournalCredit - manualJournalDebit,
          currentBalance
        };
      });
      setSuppliers(balances);
    } catch (err: any) {
      console.error('Error fetching supplier balances:', err);
      setError(err.message || 'Failed to load balances');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const { language } = useLanguage();

  const exportExcel = () => {
    if (suppliers.length === 0) return;
    const data = filteredSuppliers.map(s => ({
      [language === 'ar' ? 'كود' : 'Code']: s.code,
      [language === 'ar' ? 'الاسم' : 'Name']: s.name,
      [language === 'ar' ? 'رصيد أول' : 'Opening Balance']: s.openingBalance,
      [language === 'ar' ? 'مشتريات (+)' : 'Purchases (+)']: s.totalInvoices,
      [language === 'ar' ? 'مرتجع (-)' : 'Returns (-)']: -s.totalReturns,
      [language === 'ar' ? 'خصم (-)' : 'Discounts (-)']: -s.totalDiscounts,
      [language === 'ar' ? 'سداد (-)' : 'Payments (-)']: -s.totalVouchers,
      [language === 'ar' ? 'قيود (+/-)' : 'Adjustments (+/-)']: s.manualJournalImpact,
      [language === 'ar' ? 'الرصيد الحالي' : 'Current Balance']: s.currentBalance
    }));
    
    exportToExcel(data, { 
      filename: `supplier-balances-${new Date().toISOString().slice(0, 10)}`,
      sheetName: language === 'ar' ? 'أرصدة الموردين' : 'Supplier Balances'
    });
  };

  const formatBalance = (balance: number) => {
    if (balance === 0) return '0';
    return formatNumber(Math.abs(balance));
  };

  const exportReport = async () => {
    if (!reportRef.current) return;
    try {
      await exportToPDF(reportRef.current, {
        filename: `supplier-balances-${new Date().toISOString().slice(0, 10)}.pdf`,
        margin: 10,
        orientation: 'landscape'
      });
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء تصدير PDF', 'error');
    }
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalOutstanding = filteredSuppliers.reduce((sum, s) => sum + (Number(s.currentBalance) || 0), 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-zinc-500 font-medium italic animate-pulse">جاري تحميل أرصدة الموردين...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 p-8 bg-rose-50 rounded-3xl border border-rose-100 italic text-center">
        <p className="text-rose-600 font-bold">{error}</p>
        <button 
          onClick={fetchData}
          className="px-6 py-2 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200"
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
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">أرصدة الموردين التفصيلية</h2>
          <p className="text-zinc-500">ملخص مديونياتنا لكافة الموردين مع تفاصيل الحركات.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={exportExcel}
            disabled={suppliers.length === 0}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50"
          >
            <FileSpreadsheet size={20} />
            تصدير Excel
          </button>
          <button 
            onClick={exportReport}
            disabled={suppliers.length === 0}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
          >
            <Download size={20} />
            تصدير PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-zinc-900 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-full -mr-16 -mt-16 group-hover:bg-white/10 transition-colors" />
          <p className="text-zinc-400 text-sm font-bold uppercase tracking-widest mb-1">إجمالي المديونيات للموردين</p>
          <h3 className="text-3xl font-bold">{formatNumber(Math.abs(totalOutstanding))}</h3>
          <div className="mt-4 flex items-center gap-2 text-red-400 text-sm">
            <ArrowDownLeft size={16} />
            <span>مستحقات للموردين علينا</span>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-3xl border border-zinc-100 shadow-sm flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
          <input 
            type="text" 
            placeholder="البحث باسم المورد أو الكود..."
            className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden" ref={reportRef}>
        <div className="p-6 bg-zinc-50 border-b border-zinc-100 hidden print:block">
          <h3 className="text-xl font-bold text-zinc-900">تقرير أرصدة الموردين التفصيلي</h3>
          <p className="text-sm text-zinc-500">تاريخ التقرير: {formatDate(new Date())}</p>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 border-b border-zinc-100">
                <th className="px-4 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">كود</th>
                <th className="px-4 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">الاسم</th>
                <th className="px-4 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">رصيد أول</th>
                <th className="px-4 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">مشتريات (+)</th>
                <th className="px-4 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">مرتجع (-)</th>
                <th className="px-4 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">خصم (-)</th>
                <th className="px-4 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">سداد (-)</th>
                <th className="px-4 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">قيود (+/-)</th>
                <th className="px-4 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">الرصيد الحالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {loading ? (
                [1,2,3,4,5].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={8} className="px-6 py-4 h-16 bg-zinc-50/20" />
                  </tr>
                ))
              ) : filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-zinc-400 italic">لا توجد بيانات متاحة</td>
                </tr>
              ) : filteredSuppliers.map(supplier => (
                <tr key={supplier.id} className="hover:bg-zinc-50/50 transition-colors group">
                  <td className="px-4 py-4">
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg uppercase tracking-wider">{supplier.code}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="font-bold text-zinc-900 text-sm">{supplier.name}</span>
                  </td>
                  <td className="px-4 py-4 text-zinc-500 text-sm">{formatBalance(supplier.openingBalance)}</td>
                  <td className="px-4 py-4 text-emerald-600 font-medium text-sm">{formatBalance(supplier.totalInvoices)}</td>
                  <td className="px-4 py-4 text-rose-600 font-medium text-sm">{formatBalance(-supplier.totalReturns)}</td>
                  <td className="px-4 py-4 text-amber-600 font-medium text-sm">{formatBalance(-supplier.totalDiscounts)}</td>
                  <td className="px-4 py-4 text-blue-600 font-medium text-sm">{formatBalance(-supplier.totalVouchers)}</td>
                  <td className="px-4 py-4 text-zinc-600 font-medium text-sm">{formatBalance(supplier.manualJournalImpact)}</td>
                  <td className="px-4 py-4">
                    <span className={`font-bold text-sm ${supplier.currentBalance > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatBalance(supplier.currentBalance)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {!loading && filteredSuppliers.length > 0 && (
              <tfoot className="bg-zinc-900 text-white font-bold">
                <tr>
                  <td colSpan={2} className="px-4 py-4 text-left">الإجمالي:</td>
                  <td className="px-4 py-4">{formatNumber(Math.abs(filteredSuppliers.reduce((sum, s) => sum + (Number(s.openingBalance) || 0), 0)))}</td>
                  <td className="px-4 py-4">{formatNumber(Math.abs(filteredSuppliers.reduce((sum, s) => sum + (Number(s.totalInvoices) || 0), 0)))}</td>
                  <td className="px-4 py-4">{formatNumber(Math.abs(filteredSuppliers.reduce((sum, s) => sum + (Number(s.totalReturns) || 0), 0)))}</td>
                  <td className="px-4 py-4">{formatNumber(Math.abs(filteredSuppliers.reduce((sum, s) => sum + (Number(s.totalDiscounts) || 0), 0)))}</td>
                  <td className="px-4 py-4">{formatNumber(Math.abs(filteredSuppliers.reduce((sum, s) => sum + (Number(s.totalVouchers) || 0), 0)))}</td>
                  <td className="px-4 py-4">{formatNumber(Math.abs(filteredSuppliers.reduce((sum, s) => sum + (Number(s.manualJournalImpact) || 0), 0)))}</td>
                  <td className="px-4 py-4">{formatBalance(totalOutstanding)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-zinc-100">
          {loading ? (
            [1,2,3,4,5].map(i => (
              <div key={i} className="p-4 animate-pulse space-y-3">
                <div className="h-4 bg-zinc-100 rounded w-1/4" />
                <div className="h-6 bg-zinc-100 rounded w-3/4" />
                <div className="h-4 bg-zinc-100 rounded w-1/2" />
              </div>
            ))
          ) : filteredSuppliers.length === 0 ? (
            <div className="px-6 py-12 text-center text-zinc-400 italic">لا توجد بيانات متاحة</div>
          ) : filteredSuppliers.map(supplier => (
            <div key={supplier.id} className="p-4 space-y-3 active:bg-zinc-50 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg uppercase tracking-wider">{supplier.code}</span>
                <span className="font-bold text-zinc-900">{supplier.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="flex justify-between border-b border-zinc-50 pb-1">
                  <span className="text-zinc-400">رصيد أول:</span>
                  <span className="font-medium">{formatNumber(supplier.openingBalance)}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-50 pb-1">
                  <span className="text-zinc-400">مشتريات (+):</span>
                  <span className="text-emerald-600 font-medium">{formatNumber(supplier.totalInvoices)}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-50 pb-1">
                  <span className="text-zinc-400">مرتجع (-):</span>
                  <span className="text-rose-600 font-medium">{formatNumber(supplier.totalReturns)}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-50 pb-1">
                  <span className="text-zinc-400">سداد (-):</span>
                  <span className="text-blue-600 font-medium">{formatNumber(supplier.totalVouchers)}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-50 pb-1">
                  <span className="text-zinc-400">قيود (+/-):</span>
                  <span className="text-zinc-600 font-medium">{formatNumber(supplier.journalCredit - supplier.journalDebit)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
                <span className="text-xs font-bold text-zinc-500 uppercase">الرصيد الحالي</span>
                <span className={`font-bold ${supplier.currentBalance > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatBalance(supplier.currentBalance)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
