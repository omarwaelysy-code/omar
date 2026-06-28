import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { PaymentMethod, JournalEntry } from '../types';
import { Calendar, Download, Printer, Wallet, ArrowLeftRight, BarChart3, RefreshCcw, Search } from 'lucide-react';
import { exportToPDF } from '../utils/pdfUtils';
import { exportToExcel } from '../utils/excelUtils';
import { dbService } from '../services/dbService';
import { formatNumber } from '../utils/formatUtils';

interface CashBalanceData {
  id: string;
  code: string;
  name: string;
  openingBalance: number;
  incoming: number;
  outgoing: number;
  balance: number;
}

export const CashBalances: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const reportRef = useRef<HTMLDivElement>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0], // First day of current year
    end: new Date().toISOString().split('T')[0]
  });
  const [balances, setBalances] = useState<CashBalanceData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
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
      if (paymentMethods.length === 0) {
        if (!loading) return; 
        setLoading(false);
        return;
      }
      
      setError(null);
      setLoading(true);
      try {
        const [paymentMethodsData, journalEntries] = await Promise.all([
          dbService.list<PaymentMethod>('payment_methods', user.company_id),
          dbService.list<JournalEntry>('journal_entries', user.company_id)
        ]);

        const startStr = dateRange.start;
        const endStr = dateRange.end;

        const calculatedBalances = paymentMethodsData.map(method => {
          let opIn = 0;
          let opOut = 0;
          let movIn = 0;
          let movOut = 0;

          // Process journal entries for this payment method
          journalEntries.forEach(je => {
            const jeDateStr = (je.date || '').slice(0, 10);

            je.items?.forEach((item: any) => {
              // Rule: account matches the payment method's account_id and sub_account matches the payment method's id
              const isMatch = 
                item.account_id === method.account_id &&
                item.sub_account_type === 'payment_method' &&
                item.sub_account_id === method.id;

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

          // Beginning Balance = Method's Opening Balance + Debits before start - Credits before start
          const baseOpening = Number(method.opening_balance || 0);
          const beginningBalance = baseOpening + opIn - opOut;
          const endingBalance = beginningBalance + movIn - movOut;

          return {
            id: method.id,
            code: method.code || '-',
            name: method.name,
            openingBalance: beginningBalance,
            incoming: movIn,
            outgoing: movOut,
            balance: endingBalance
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

  const filteredBalances = balances.filter(b => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totals = filteredBalances.reduce((acc, b) => ({
    openingBalance: acc.openingBalance + b.openingBalance,
    incoming: acc.incoming + b.incoming,
    outgoing: acc.outgoing + b.outgoing,
    balance: acc.balance + b.balance
  }), { openingBalance: 0, incoming: 0, outgoing: 0, balance: 0 });

  const handleExportPDF = async () => {
    if (reportRef.current) {
      await exportToPDF(reportRef.current, { 
        filename: 'Cash_Balances_Report', 
        orientation: 'landscape',
        reportTitle: language === 'ar' ? 'تقرير النقدية (الخزائن والبنوك) خلال فترة' : 'Cash & Bank Report (Period)'
      });
    }
  };

  const handleExportExcel = () => {
    const data = filteredBalances.map(b => ({
      [language === 'ar' ? 'كود طريقة السداد' : 'Payment Method Code']: b.code,
      [language === 'ar' ? 'اسم طريقة السداد' : 'Payment Method Name']: b.name,
      [language === 'ar' ? 'رصيد أول الفترة' : 'Beginning Balance']: b.openingBalance,
      [language === 'ar' ? 'الوارد' : 'Incoming']: b.incoming,
      [language === 'ar' ? 'المنصرف' : 'Outgoing']: b.outgoing,
      [language === 'ar' ? 'الرصيد' : 'Balance']: b.balance
    }));
    exportToExcel(data, { filename: 'Cash_Balances_Report' });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-zinc-500 font-medium italic animate-pulse">
          {language === 'ar' ? 'جاري تحميل البيانات...' : 'Loading data...'}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 p-8 bg-rose-50 rounded-3xl border border-rose-100 italic">
        <p className="text-rose-600 font-bold">{error}</p>
        <button 
          onClick={handleRefresh}
          className="px-6 py-2 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all"
        >
          {language === 'ar' ? 'إعادة المحاولة' : 'Try Again'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-zinc-900">
            {language === 'ar' ? 'تقرير النقدية (الخزائن والبنوك) خلال فترة' : 'Cash & Bank Report (Period)'}
          </h2>
          <p className="text-zinc-500 font-medium mt-1">
            {language === 'ar' ? 'عرض أرصدة وحركات الخزائن والبنوك خلال فترة محددة' : 'View cash and bank balances and movements during a period'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleRefresh}
            className="p-3 bg-white border border-zinc-200 text-zinc-600 rounded-2xl hover:bg-zinc-50 hover:text-emerald-600 transition-all hover:scale-105 active:scale-95 shadow-sm cursor-pointer"
            title={language === 'ar' ? 'تحديث البيانات' : 'Refresh Data'}
          >
            <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          <button 
            onClick={handleExportPDF} 
            className="p-2.5 bg-white border border-zinc-200 text-zinc-600 rounded-xl hover:bg-zinc-50 transition-all shadow-sm cursor-pointer"
            title={language === 'ar' ? 'طباعة PDF' : 'Export PDF'}
          >
            <Printer size={20} />
          </button>
          <button 
            onClick={handleExportExcel} 
            className="p-2.5 bg-white border border-zinc-200 text-zinc-600 rounded-xl hover:bg-zinc-50 transition-all shadow-sm cursor-pointer"
            title={language === 'ar' ? 'تصدير Excel' : 'Export Excel'}
          >
            <Download size={20} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        <div className="relative">
          <Search className="absolute right-3 top-3 text-zinc-400" size={20} />
          <input
            type="text"
            placeholder={language === 'ar' ? 'بحث باسم أو كود طريقة السداد...' : 'Search by name or code...'}
            className="w-full pr-10 pl-4 py-3 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div ref={reportRef} className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                <th className="px-6 py-4 text-sm font-bold text-zinc-700 border-l border-zinc-200">
                  {language === 'ar' ? 'كود طريقة السداد' : 'Payment Method Code'}
                </th>
                <th className="px-6 py-4 text-sm font-bold text-zinc-700 border-l border-zinc-200">
                  {language === 'ar' ? 'اسم طريقة السداد' : 'Payment Method Name'}
                </th>
                <th className="px-6 py-4 text-sm font-bold text-zinc-700 text-center border-l border-zinc-200">
                  {language === 'ar' ? 'رصيد أول الفترة' : 'Beginning Balance'}
                </th>
                <th className="px-6 py-4 text-sm font-bold text-zinc-700 text-center border-l border-zinc-200">
                  {language === 'ar' ? 'الوارد' : 'Incoming'}
                </th>
                <th className="px-6 py-4 text-sm font-bold text-zinc-700 text-center border-l border-zinc-200">
                  {language === 'ar' ? 'المنصرف' : 'Outgoing'}
                </th>
                <th className="px-6 py-4 text-sm font-bold text-zinc-700 text-center">
                  {language === 'ar' ? 'الرصيد' : 'Balance'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredBalances.length > 0 ? (
                filteredBalances.map((b) => (
                  <tr key={b.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-zinc-500 border-l border-zinc-100">{b.code}</td>
                    <td className="px-6 py-4 text-sm font-bold text-zinc-900 border-l border-zinc-100">{b.name}</td>
                    <td className="px-6 py-4 text-sm font-black text-center border-l border-zinc-100 text-zinc-600">
                      {formatNumber(b.openingBalance)}
                    </td>
                    <td className="px-6 py-4 text-sm font-black text-emerald-600 text-center border-l border-zinc-100">
                      {b.incoming > 0 ? formatNumber(b.incoming) : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm font-black text-rose-600 text-center border-l border-zinc-100">
                      {b.outgoing > 0 ? formatNumber(b.outgoing) : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm font-black text-center">
                      <span className={b.balance >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                        {formatNumber(b.balance)}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-zinc-400 italic">
                    {language === 'ar' ? 'لا توجد بيانات تطابق البحث' : 'No data matching the search'}
                  </td>
                </tr>
              )}
              {/* Totals Row */}
              <tr className="bg-zinc-900 text-white font-black">
                <td colSpan={2} className="px-6 py-4 text-sm text-center border-l border-zinc-800">
                  {language === 'ar' ? 'الإجمالي' : 'Total'}
                </td>
                <td className="px-6 py-4 text-sm text-center border-l border-zinc-800">
                  {formatNumber(totals.openingBalance)}
                </td>
                <td className="px-6 py-4 text-sm text-center border-l border-zinc-800 text-emerald-400">
                  {formatNumber(totals.incoming)}
                </td>
                <td className="px-6 py-4 text-sm text-center border-l border-zinc-800 text-rose-400">
                  {formatNumber(totals.outgoing)}
                </td>
                <td className="px-6 py-4 text-sm text-center">
                  <span className={totals.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    {formatNumber(totals.balance)}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
