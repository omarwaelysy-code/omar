import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Supplier } from '../types';
import { FileSpreadsheet, Download, Search, Truck, ArrowDownLeft, Wallet, RefreshCcw, Calendar } from 'lucide-react';
import { exportToPDF } from '../utils/pdfUtils';
import { exportToExcel } from '../utils/excelUtils';
import { dbService } from '../services/dbService';
import { formatNumber, formatMoney, formatDate } from '../utils/formatUtils';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigation } from '../contexts/NavigationContext';

export const SupplierBalances: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const reportRef = useRef<HTMLDivElement>(null);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const { setCurrentPage } = useNavigation();

  const applyPreset = (preset: 'last_month' | 'last_year' | 'current_year' | 'last_quarter' | 'all') => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed (0 = Jan, 11 = Dec)
    
    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
      return;
    }
    
    let start = '';
    let end = '';
    
    switch (preset) {
      case 'last_month':
        const lmStart = new Date(year, month - 1, 1);
        const lmEnd = new Date(year, month, 0);
        start = lmStart.toISOString().slice(0, 10);
        end = lmEnd.toISOString().slice(0, 10);
        break;
      case 'last_year':
        start = `${year - 1}-01-01`;
        end = `${year - 1}-12-31`;
        break;
      case 'current_year':
        start = `${year}-01-01`;
        end = now.toISOString().slice(0, 10);
        break;
      case 'last_quarter':
        const currentQuarter = Math.floor(month / 3);
        if (currentQuarter === 0) {
          start = `${year - 1}-10-01`;
          end = `${year - 1}-12-31`;
        } else {
          const qStartMonth = (currentQuarter - 1) * 3;
          const lqStart = new Date(year, qStartMonth, 1);
          const lqEnd = new Date(year, qStartMonth + 3, 0);
          start = lqStart.toISOString().slice(0, 10);
          end = lqEnd.toISOString().slice(0, 10);
        }
        break;
      default:
        break;
    }
    setStartDate(start);
    setEndDate(end);
  };

  const handleNavigateToStatement = (supplierId: string) => {
    sessionStorage.setItem('supplier_statement_filter_supplier_id', supplierId);
    sessionStorage.setItem('supplier_statement_filter_start_date', startDate);
    sessionStorage.setItem('supplier_statement_filter_end_date', endDate);
    setCurrentPage('supplier_statement');
  };

  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [sups, journalEntries] = await Promise.all([
        dbService.list<Supplier>('suppliers', user.company_id),
        dbService.list<any>('journal_entries', user.company_id)
      ]);

      const balances = sups.map((supplier: any) => {
        // Find all journal entry lines matching this supplier and their ledger account
        const supplierLines: any[] = [];
        journalEntries.forEach((je: any) => {
          je.items?.forEach((item: any) => {
            const matchesEntity = item.supplier_id === supplier.id || item.sub_account_id === supplier.id;
            if (matchesEntity && item.account_id === supplier.account_id) {
              supplierLines.push({
                date: je.date,
                reference_type: je.reference_type,
                debit: Number(item.debit) || 0,
                credit: Number(item.credit) || 0,
                description: item.description || je.description || ''
              });
            }
          });
        });

        // Determine if opening balance is already represented in journal entries
        const hasOpeningBalanceInEntries = supplierLines.some(
          (line: any) => line.reference_type === 'opening_balance' || line.description.includes('رصيد افتتاحي')
        );
        const manualOpBal = hasOpeningBalanceInEntries ? 0 : (Number(supplier.opening_balance) || 0);

        let openingBalance = manualOpBal;
        let totalInvoices = 0;
        let totalReturns = 0;
        let totalVouchers = 0;
        let totalDiscounts = 0;
        let manualJournalImpact = 0;

        supplierLines.forEach((line: any) => {
          const lineDateStr = (line.date || '').slice(0, 10);
          const isBefore = startDate && lineDateStr < startDate;
          const isAfter = endDate && lineDateStr > endDate;

          if (isBefore) {
            openingBalance += (line.credit - line.debit);
          } else if (!isAfter) {
            // Group by standard accounting reference types
            if (line.reference_type === 'purchase_invoice' || line.reference_type === 'invoice') {
              totalInvoices += line.credit;
              totalVouchers += line.debit; // Cash purchase payments
            } else if (line.reference_type === 'purchase_return' || line.reference_type === 'return') {
              totalReturns += (line.debit - line.credit);
            } else if (line.reference_type === 'payment' || line.reference_type === 'payment_voucher') {
              totalVouchers += (line.debit - line.credit);
            } else if (line.reference_type === 'supplier_discount' || line.reference_type === 'discount') {
              totalDiscounts += (line.debit - line.credit);
            } else if (line.reference_type === 'opening_balance') {
              openingBalance += (line.credit - line.debit);
            } else {
              // Manual journals and non-standard reference types
              manualJournalImpact += (line.credit - line.debit);
            }
          }
        });

        const currentBalance = openingBalance + totalInvoices - totalReturns - totalVouchers - totalDiscounts + manualJournalImpact;

        return {
          ...supplier,
          openingBalance,
          totalInvoices,
          totalReturns,
          totalVouchers,
          totalDiscounts,
          manualJournalImpact,
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
  }, [user, startDate, endDate]);

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
    const num = formatNumber(Math.abs(balance));
    return balance < 0 ? `(${num})` : num;
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
      <div className="flex flex-col items-center justify-center h-64 gap-4 p-8 bg-emerald-50 rounded-3xl border border-emerald-100 italic text-center">
        <p className="text-emerald-600 font-bold">{error}</p>
        <button 
          onClick={fetchData}
          className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
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
            onClick={fetchData}
            className="p-3 bg-white border border-zinc-200 text-zinc-600 rounded-2xl hover:bg-zinc-50 hover:text-emerald-600 transition-all hover:scale-105 active:scale-95 shadow-sm"
            title="تحديث البيانات"
          >
            <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
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

      <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm space-y-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
          <input 
            type="text" 
            placeholder="البحث باسم المورد أو الكود..."
            className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-zinc-100">
          <div>
            <label className="block text-sm font-bold text-zinc-700 mb-1">من تاريخ</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 text-zinc-400" size={18} />
              <input 
                type="date" 
                className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-sm"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-zinc-700 mb-1">إلى تاريخ</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 text-zinc-400" size={18} />
              <input 
                type="date" 
                className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-sm"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <span className="text-xs font-bold text-zinc-400 ml-2">الفترات السريعة:</span>
          <button 
            type="button"
            onClick={() => applyPreset('last_month')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all hover:scale-105 ${
              startDate && endDate && startDate === new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().slice(0, 10) && endDate === new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().slice(0, 10)
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' 
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            آخر الشهر الماضي
          </button>
          <button 
            type="button"
            onClick={() => applyPreset('last_year')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all hover:scale-105 ${
              startDate && endDate && startDate === `${new Date().getFullYear() - 1}-01-01` && endDate === `${new Date().getFullYear() - 1}-12-31`
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' 
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            آخر العام الماضي
          </button>
          <button 
            type="button"
            onClick={() => applyPreset('current_year')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all hover:scale-105 ${
              startDate && endDate && startDate === `${new Date().getFullYear()}-01-01` && endDate === new Date().toISOString().slice(0, 10)
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' 
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            العام الحالي
          </button>
          <button 
            type="button"
            onClick={() => applyPreset('last_quarter')}
            className="px-4 py-1.5 rounded-xl text-xs font-bold bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-all hover:scale-105"
          >
            آخر ربع سنة
          </button>
          <button 
            type="button"
            onClick={() => applyPreset('all')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all hover:scale-105 ${
              !startDate && !endDate ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            كل الفترات
          </button>
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
                    <span 
                      onClick={() => handleNavigateToStatement(supplier.id)}
                      className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg uppercase tracking-wider cursor-pointer hover:bg-emerald-100 hover:text-emerald-700 active:scale-95 transition-all inline-block"
                      title={language === 'ar' ? 'عرض كشف الحساب لهذه الفترة' : 'View statement for this period'}
                    >
                      {supplier.code}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="font-bold text-zinc-900 text-sm">{supplier.name}</span>
                  </td>
                  <td className="px-4 py-4 text-zinc-500 text-sm">{formatBalance(supplier.openingBalance)}</td>
                  <td className="px-4 py-4 text-emerald-600 font-medium text-sm">{formatBalance(supplier.totalInvoices)}</td>
                  <td className="px-4 py-4 text-emerald-600 font-medium text-sm">{formatBalance(-supplier.totalReturns)}</td>
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
                  <td className="px-4 py-4 text-white">{formatBalance(totalOutstanding)}</td>
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
                <span 
                  onClick={() => handleNavigateToStatement(supplier.id)}
                  className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg uppercase tracking-wider cursor-pointer hover:bg-emerald-100 hover:text-emerald-700 active:scale-95 transition-all inline-block"
                  title={language === 'ar' ? 'عرض كشف الحساب لهذه الفترة' : 'View statement for this period'}
                >
                  {supplier.code}
                </span>
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
                  <span className="text-emerald-600 font-medium">{formatNumber(supplier.totalReturns)}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-50 pb-1">
                  <span className="text-zinc-400">سداد (-):</span>
                  <span className="text-blue-600 font-medium">{formatNumber(supplier.totalVouchers)}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-50 pb-1">
                  <span className="text-zinc-400">قيود (+/-):</span>
                  <span className="text-zinc-600 font-medium">{formatNumber(supplier.manualJournalImpact)}</span>
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
