import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Search, Calendar, Download, Wallet, PieChart, TrendingDown } from 'lucide-react';
import { exportToPDF } from '../utils/pdfUtils';
import { dbService } from '../services/dbService';

export const ExpensesReport: React.FC = () => {
  const { user } = useAuth();
  const { t, dir } = useLanguage();
  const reportRef = useRef<HTMLDivElement>(null);
  const [startDate, setStartDate] = useState<string>(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [expenseData, setExpenseData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [vouchers, categories] = await Promise.all([
        dbService.getDocsByFilter<any>('payment_vouchers', user.company_id, [
          { field: 'type', operator: '==', value: 'expense' }
        ]),
        dbService.list<any>('expense_categories', user.company_id)
      ]);

      const filteredVouchers = vouchers.filter((v: any) => {
        const d = v.date;
        return d >= startDate && d <= endDate;
      });

      const data = categories.map((cat: any) => {
        const catVouchers = filteredVouchers.filter((v: any) => v.expense_category_id === cat.id);
        const totalAmount = catVouchers.reduce((sum: number, v: any) => sum + v.amount, 0);

        return {
          code: cat.code,
          name: cat.name,
          totalAmount
        };
      }).filter((c: any) => c.totalAmount > 0);

      setExpenseData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, user]);

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    try {
      await exportToPDF(reportRef.current, {
        filename: `expenses_report_${new Date().toISOString().slice(0, 10)}.pdf`,
        orientation: 'landscape',
        reportTitle: t('reports.expenses_title')
      });
    } catch (e) {
      console.error(e);
    }
  };

  const totalExpenses = expenseData.reduce((sum, item) => sum + item.totalAmount, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">{t('reports.expenses_title')}</h2>
          <p className="text-zinc-500">{t('reports.expenses_subtitle')}</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
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
          <div className="flex gap-2">
            <button 
              onClick={fetchData}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-2 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-all disabled:opacity-50 h-[42px]"
            >
              {loading ? t('common.loading') : t('reports.update_data')}
            </button>
            <button 
              onClick={handleExportPDF}
              disabled={expenseData.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-emerald-600 border border-emerald-200 rounded-xl hover:bg-emerald-50 transition-all disabled:opacity-50"
            >
              <Download size={18} />
            </button>
          </div>
        </div>

        {expenseData.length > 0 ? (
          <div ref={reportRef} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100">
                <div className="flex items-center gap-3 text-rose-600 mb-2">
                  <TrendingDown size={20} />
                  <span className="text-sm font-bold uppercase tracking-tighter">{t('reports.total_expenses')}</span>
                </div>
                <div className="text-3xl font-bold text-rose-900">{totalExpenses.toLocaleString()}</div>
              </div>
              <div className="bg-zinc-50 p-6 rounded-2xl border border-zinc-100">
                <div className="flex items-center gap-3 text-zinc-600 mb-2">
                  <PieChart size={20} />
                  <span className="text-sm font-bold uppercase tracking-tighter">{t('reports.expense_categories_count')}</span>
                </div>
                <div className="text-3xl font-bold text-zinc-900">{expenseData.length}</div>
              </div>
              <div className="bg-zinc-50 p-6 rounded-2xl border border-zinc-100">
                <div className="flex items-center gap-3 text-zinc-600 mb-2">
                  <Calendar size={20} />
                  <span className="text-sm font-bold uppercase tracking-tighter">{t('common.period')}</span>
                </div>
                <div className="text-sm font-bold text-zinc-900">{startDate} {t('common.to')} {endDate}</div>
              </div>
            </div>

            <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden">
              <table className={`w-full border-collapse ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-100">
                    <th className="px-6 py-4 text-sm font-bold text-zinc-700">{t('expenses.column_code')}</th>
                    <th className="px-6 py-4 text-sm font-bold text-zinc-700">{t('expenses.column_name')}</th>
                    <th className="px-6 py-4 text-sm font-bold text-zinc-700">{t('common.total_amount')}</th>
                    <th className="px-6 py-4 text-sm font-bold text-zinc-700">{t('reports.percentage')}</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseData.map((item, index) => (
                    <tr key={index} className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-mono">{item.code}</td>
                      <td className="px-6 py-4 text-sm font-bold">{item.name}</td>
                      <td className="px-6 py-4 text-sm font-bold text-rose-600">{item.totalAmount.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-rose-500 rounded-full" 
                              style={{ width: `${(item.totalAmount / totalExpenses * 100).toFixed(1)}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-bold text-zinc-500 w-12">
                            {(item.totalAmount / totalExpenses * 100).toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-zinc-900 text-white font-bold">
                    <td colSpan={2} className={`px-6 py-4 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>{t('reports.total_overall')}</td>
                    <td colSpan={2} className={`${dir === 'rtl' ? 'text-right' : 'text-left'} px-6 py-4`}>{totalExpenses.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ) : (
          !loading && (
            <div className="text-center py-12 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
              <PieChart className="mx-auto text-zinc-300 mb-4" size={48} />
              <p className="text-zinc-500">{t('reports.no_expenses')}</p>
            </div>
          )
        )}
      </div>
    </div>
  );
};
