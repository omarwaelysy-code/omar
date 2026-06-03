import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Customer } from '../types';
import { FileSpreadsheet, Download, Search, User, Wallet, ArrowUpRight, RefreshCcw, Calendar } from 'lucide-react';
import { exportToPDF } from '../utils/pdfUtils';
import { exportToExcel } from '../utils/excelUtils';
import { dbService } from '../services/dbService';
import { formatNumber, formatMoney, formatDate } from '../utils/formatUtils';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigation } from '../contexts/NavigationContext';

export const CustomerBalances: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [customers, setCustomers] = useState<any[]>([]);
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

  const handleNavigateToStatement = (customerId: string) => {
    sessionStorage.setItem('customer_statement_filter_customer_id', customerId);
    sessionStorage.setItem('customer_statement_filter_start_date', startDate);
    sessionStorage.setItem('customer_statement_filter_end_date', endDate);
    setCurrentPage('customer_statement');
  };

  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [custs, invoices, returns, receipts, discounts, journalEntries] = await Promise.all([
        dbService.list<Customer>('customers', user.company_id),
        dbService.list<any>('invoices', user.company_id),
        dbService.list<any>('returns', user.company_id),
        dbService.list<any>('receipt_vouchers', user.company_id),
        dbService.list<any>('customer_discounts', user.company_id),
        dbService.list<any>('journal_entries', user.company_id)
      ]);

      const balances = custs.map((customer: any) => {
        const custInvoices = invoices.filter((i: any) => i.customer_id === customer.id);
        const custReturns = returns.filter((r: any) => r.customer_id === customer.id);
        const custReceipts = receipts.filter((r: any) => {
          if (r.customer_id === customer.id) return true;
          const isMulti = r.voucher_type === 'multi' || r.type === 'multi';
          if (isMulti && r.items && Array.isArray(r.items)) {
            return r.items.some((item: any) => item.type === 'customer' && item.entity_id === customer.id);
          }
          return false;
        });
        const custDiscounts = discounts.filter((d: any) => d.customer_id === customer.id);

        const getReceiptAmount = (r: any) => {
          const isMulti = r.voucher_type === 'multi' || r.type === 'multi';
          if (isMulti && r.items && Array.isArray(r.items)) {
             return r.items
               .filter((item: any) => item.type === 'customer' && item.entity_id === customer.id)
               .reduce((itemSum: number, item: any) => itemSum + (Number(item.amount) || 0), 0);
          }
          if (r.customer_id === customer.id) {
             return Number(r.amount) || 0;
          }
          return 0;
        };

        // Split standard transactions into "before" and "within" period
        const invoicesBefore = custInvoices.filter((i: any) => startDate && i.date < startDate);
        const invoicesPeriod = custInvoices.filter((i: any) => (!startDate || i.date >= startDate) && (!endDate || i.date <= endDate));

        const returnsBefore = custReturns.filter((r: any) => startDate && r.date < startDate);
        const returnsPeriod = custReturns.filter((r: any) => (!startDate || r.date >= startDate) && (!endDate || r.date <= endDate));

        const discountsBefore = custDiscounts.filter((d: any) => startDate && d.date < startDate);
        const discountsPeriod = custDiscounts.filter((d: any) => (!startDate || d.date >= startDate) && (!endDate || d.date <= endDate));

        const receiptsBefore = custReceipts.filter((r: any) => startDate && r.date < startDate);
        const receiptsPeriod = custReceipts.filter((r: any) => (!startDate || r.date >= startDate) && (!endDate || r.date <= endDate));

        // Cash Invoices amount behaves like a receipt
        const cashInvoicesBefore = invoicesBefore.filter((i: any) => i.payment_type === 'cash')
          .reduce((sum: number, i: any) => sum + (Number(i.total_amount) || 0), 0);
        const cashInvoicesPeriod = invoicesPeriod.filter((i: any) => i.payment_type === 'cash')
          .reduce((sum: number, i: any) => sum + (Number(i.total_amount) || 0), 0);

        const totalInvoicesBefore = invoicesBefore.reduce((sum: number, i: any) => sum + (Number(i.total_amount) || 0), 0);
        const totalInvoicesPeriod = invoicesPeriod.reduce((sum: number, i: any) => sum + (Number(i.total_amount) || 0), 0);

        const totalReturnsBefore = returnsBefore.reduce((sum: number, r: any) => sum + (Number(r.total_amount) || 0), 0);
        const totalReturnsPeriod = returnsPeriod.reduce((sum: number, r: any) => sum + (Number(r.total_amount) || 0), 0);

        const totalDiscountsBefore = discountsBefore.reduce((sum: number, d: any) => sum + (Number(d.amount) || 0), 0);
        const totalDiscountsPeriod = discountsPeriod.reduce((sum: number, d: any) => sum + (Number(d.amount) || 0), 0);

        const totalReceiptsBefore = receiptsBefore.reduce((sum: number, r: any) => sum + getReceiptAmount(r), 0) + cashInvoicesBefore;
        const totalReceiptsPeriod = receiptsPeriod.reduce((sum: number, r: any) => sum + getReceiptAmount(r), 0) + cashInvoicesPeriod;

        let manualJournalDebitBefore = 0;
        let manualJournalCreditBefore = 0;
        let manualJournalDebitPeriod = 0;
        let manualJournalCreditPeriod = 0;

        journalEntries.forEach((je: any) => {
          je.items?.forEach((item: any) => {
            if (item.customer_id === customer.id && item.account_id === customer.account_id) {
              const debit = Number(item.debit) || 0;
              const credit = Number(item.credit) || 0;
              
              const standardTypes = [
                'invoice', 'sales_invoice', 'cash_invoice', 
                'return', 'sales_return', 
                'receipt', 'receipt_voucher', 
                'customer_discount', 'discount',
                'opening_balance'
              ];
              
              if (je.reference_type === 'manual' || je.reference_type === 'journal' || 
                  !standardTypes.includes(je.reference_type)) {
                if (startDate && je.date < startDate) {
                  manualJournalDebitBefore += debit;
                  manualJournalCreditBefore += credit;
                } else if ((!startDate || je.date >= startDate) && (!endDate || je.date <= endDate)) {
                  manualJournalDebitPeriod += debit;
                  manualJournalCreditPeriod += credit;
                }
              }
            }
          });
        });

        const openingBalance = (Number(customer.opening_balance) || 0) + 
                               totalInvoicesBefore - 
                               totalReturnsBefore - 
                               totalReceiptsBefore - 
                               totalDiscountsBefore + 
                               (manualJournalDebitBefore - manualJournalCreditBefore);

        const totalInvoices = totalInvoicesPeriod;
        const totalReturns = totalReturnsPeriod;
        const totalReceipts = totalReceiptsPeriod;
        const totalDiscounts = totalDiscountsPeriod;
        const manualJournalImpact = manualJournalDebitPeriod - manualJournalCreditPeriod;

        const currentBalance = openingBalance + totalInvoices - totalReturns - totalReceipts - totalDiscounts + manualJournalImpact;

        return {
          ...customer,
          openingBalance,
          totalInvoices,
          totalReturns,
          totalReceipts,
          totalDiscounts,
          manualJournalImpact,
          currentBalance
        };
      });
      setCustomers(balances);
    } catch (err: any) {
      console.error('Error fetching customer balances:', err);
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
    if (customers.length === 0) return;
    const data = filteredCustomers.map(c => ({
      [language === 'ar' ? 'كود' : 'Code']: c.code,
      [language === 'ar' ? 'الاسم' : 'Name']: c.name,
      [language === 'ar' ? 'رصيد أول' : 'Opening Balance']: c.openingBalance,
      [language === 'ar' ? 'مبيعات (+)' : 'Total Sales (+)']: c.totalInvoices,
      [language === 'ar' ? 'مرتجع (-)' : 'Total Returns (-)']: -c.totalReturns,
      [language === 'ar' ? 'خصم (-)' : 'Total Discounts (-)']: -c.totalDiscounts,
      [language === 'ar' ? 'تحصيل (-)' : 'Total Receipts (-)']: -c.totalReceipts,
      [language === 'ar' ? 'قيود (+/-)' : 'Adjustments (+/-)']: c.manualJournalImpact,
      [language === 'ar' ? 'الرصيد الحالي' : 'Current Balance']: c.currentBalance
    }));
    
    exportToExcel(data, { 
      filename: `customer-balances-${new Date().toISOString().slice(0, 10)}`,
      sheetName: language === 'ar' ? 'أرصدة العملاء' : 'Customer Balances'
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
        filename: `customer-balances-${new Date().toISOString().slice(0, 10)}.pdf`,
        margin: 10,
        orientation: 'landscape'
      });
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء تصدير PDF', 'error');
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalOutstanding = filteredCustomers.reduce((sum, c) => sum + (Number(c.currentBalance) || 0), 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-zinc-500 font-medium italic animate-pulse">جاري تحميل أرصدة العملاء...</p>
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
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">أرصدة العملاء التفصيلية</h2>
          <p className="text-zinc-500">ملخص مديونيات كافة العملاء مع تفاصيل الحركات.</p>
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
            disabled={customers.length === 0}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50"
          >
            <FileSpreadsheet size={20} />
            تصدير Excel
          </button>
          <button 
            onClick={exportReport}
            disabled={customers.length === 0}
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
          <p className="text-zinc-400 text-sm font-bold uppercase tracking-widest mb-1">إجمالي المديونيات</p>
          <h3 className="text-3xl font-bold">{formatNumber(Math.abs(totalOutstanding))}</h3>
          <div className="mt-4 flex items-center gap-2 text-emerald-400 text-sm">
            <ArrowUpRight size={16} />
            <span>مستحقات لدى العملاء</span>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm space-y-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
          <input 
            type="text" 
            placeholder="البحث باسم العميل أو الكود..."
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
          <h3 className="text-xl font-bold text-zinc-900">تقرير أرصدة العملاء التفصيلي</h3>
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
                <th className="px-4 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">مبيعات (+)</th>
                <th className="px-4 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">مرتجع (-)</th>
                <th className="px-4 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">خصم (-)</th>
                <th className="px-4 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">تحصيل (-)</th>
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
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-zinc-400 italic">لا توجد بيانات متاحة</td>
                </tr>
              ) : filteredCustomers.map(customer => (
                <tr key={customer.id} className="hover:bg-zinc-50/50 transition-colors group">
                  <td className="px-4 py-4">
                    <span 
                      onClick={() => handleNavigateToStatement(customer.id)}
                      className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg uppercase tracking-wider cursor-pointer hover:bg-emerald-100 hover:text-emerald-700 active:scale-95 transition-all inline-block"
                      title={language === 'ar' ? 'عرض كشف الحساب لهذه الفترة' : 'View statement for this period'}
                    >
                      {customer.code}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="font-bold text-zinc-900 text-sm">{customer.name}</span>
                  </td>
                  <td className="px-4 py-4 text-zinc-500 text-sm">{formatBalance(customer.openingBalance)}</td>
                  <td className="px-4 py-4 text-emerald-600 font-medium text-sm">{formatBalance(customer.totalInvoices)}</td>
                  <td className="px-4 py-4 text-emerald-600 font-medium text-sm">{formatBalance(-customer.totalReturns)}</td>
                  <td className="px-4 py-4 text-amber-600 font-medium text-sm">{formatBalance(-customer.totalDiscounts)}</td>
                  <td className="px-4 py-4 text-blue-600 font-medium text-sm">{formatBalance(-customer.totalReceipts)}</td>
                  <td className="px-4 py-4 text-zinc-600 font-medium text-sm">{formatBalance(customer.manualJournalImpact)}</td>
                  <td className="px-4 py-4">
                    <span className={`font-bold text-sm ${customer.currentBalance > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatBalance(customer.currentBalance)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {!loading && filteredCustomers.length > 0 && (
              <tfoot className="bg-zinc-900 text-white font-bold">
                <tr>
                  <td colSpan={2} className="px-4 py-4 text-left">الإجمالي:</td>
                  <td className="px-4 py-4">{formatNumber(Math.abs(filteredCustomers.reduce((sum, c) => sum + (Number(c.openingBalance) || 0), 0)))}</td>
                  <td className="px-4 py-4">{formatNumber(Math.abs(filteredCustomers.reduce((sum, c) => sum + (Number(c.totalInvoices) || 0), 0)))}</td>
                  <td className="px-4 py-4">{formatNumber(Math.abs(filteredCustomers.reduce((sum, c) => sum + (Number(c.totalReturns) || 0), 0)))}</td>
                  <td className="px-4 py-4">{formatNumber(Math.abs(filteredCustomers.reduce((sum, c) => sum + (Number(c.totalDiscounts) || 0), 0)))}</td>
                  <td className="px-4 py-4">{formatNumber(Math.abs(filteredCustomers.reduce((sum, c) => sum + (Number(c.totalReceipts) || 0), 0)))}</td>
                  <td className="px-4 py-4">{formatNumber(Math.abs(filteredCustomers.reduce((sum, c) => sum + (Number(c.manualJournalImpact) || 0), 0)))}</td>
                  <td className="px-4 py-3 font-bold text-white">{formatBalance(totalOutstanding)}</td>
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
          ) : filteredCustomers.length === 0 ? (
            <div className="px-6 py-12 text-center text-zinc-400 italic">لا توجد بيانات متاحة</div>
          ) : filteredCustomers.map(customer => (
            <div key={customer.id} className="p-4 space-y-3 active:bg-zinc-50 transition-colors">
              <div className="flex items-center justify-between">
                <span 
                  onClick={() => handleNavigateToStatement(customer.id)}
                  className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg uppercase tracking-wider cursor-pointer hover:bg-emerald-100 hover:text-emerald-700 active:scale-95 transition-all inline-block"
                  title={language === 'ar' ? 'عرض كشف الحساب لهذه الفترة' : 'View statement for this period'}
                >
                  {customer.code}
                </span>
                <span className="font-bold text-zinc-900">{customer.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="flex justify-between border-b border-zinc-50 pb-1">
                  <span className="text-zinc-400">رصيد أول:</span>
                  <span className="font-medium">{formatNumber(customer.openingBalance)}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-50 pb-1">
                  <span className="text-zinc-400">مبيعات (+):</span>
                  <span className="text-emerald-600 font-medium">{formatNumber(customer.totalInvoices)}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-50 pb-1">
                  <span className="text-zinc-400">مرتجع (-):</span>
                  <span className="text-emerald-600 font-medium">{formatNumber(customer.totalReturns)}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-50 pb-1">
                  <span className="text-zinc-400">تحصيل (-):</span>
                  <span className="text-blue-600 font-medium">{formatNumber(customer.totalReceipts)}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-50 pb-1">
                  <span className="text-zinc-400">قيود (+/-):</span>
                  <span className="text-zinc-600 font-medium">{formatNumber(customer.manualJournalImpact)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
                <span className="text-xs font-bold text-zinc-500 uppercase">الرصيد الحالي</span>
                <span className={`font-bold ${customer.currentBalance > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatBalance(customer.currentBalance)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
