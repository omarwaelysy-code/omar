import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Calendar, Download, Printer, PieChart, TrendingDown } from 'lucide-react';
import { exportToPDF } from '../utils/pdfUtils';
import { exportToExcel } from '../utils/excelUtils';
import { dbService } from '../services/dbService';
import { formatNumber, formatDate, formatMoney } from '../utils/formatUtils';

export const ExpensesReport: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const reportRef = useRef<HTMLDivElement>(null);
  const [startDate, setStartDate] = useState<string>(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [expenseData, setExpenseData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [journalEntries, categories, accounts, accountTypes] = await Promise.all([
        dbService.list<any>('journal_entries', user.company_id),
        dbService.list<any>('expense_categories', user.company_id),
        dbService.list<any>('accounts', user.company_id),
        dbService.list<any>('account_types', user.company_id)
      ]);

      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      // 1. Identify which account types classify as "Expenses"
      const expenseTypeIds = accountTypes
        .filter((t: any) => t.classification === 'expense' || t.name === 'Expenses' || t.name === 'مصاريف')
        .map((t: any) => t.id);
      
      const expenseAccountIds = new Set(
        accounts
          .filter((a: any) => expenseTypeIds.includes(a.type_id))
          .map((a: any) => a.id)
      );

      // 2. Initialize a map for categories
      const categoryMap: Record<string, { code: string; name: string; total: number; count: number }> = {};
      categories.forEach((cat: any) => {
        categoryMap[cat.id] = {
          code: cat.code || '',
          name: cat.name || '',
          total: 0,
          count: 0
        };
      });

      // 3. Keep track of unclassified expenses
      let miscTotal = 0;
      let miscCount = 0;

      // 4. Process all journal entries
      journalEntries.forEach((je: any) => {
        const jeDate = new Date(je.date);
        if (jeDate >= start && jeDate <= end) {
          je.items?.forEach((item: any) => {
            // Net of debit - credit is the expense amount (usually expenses are debits)
            const amt = (Number(item.debit) || 0) - (Number(item.credit) || 0);
            if (amt === 0) return;

            // Only proceed if the account is an expense account
            if (!expenseAccountIds.has(item.account_id)) return;

            let classified = false;

            // A. Check if the item explicitly specifies a category (sub-account)
            if (item.sub_account_type === 'expense' && item.sub_account_id) {
              if (categoryMap[item.sub_account_id]) {
                categoryMap[item.sub_account_id].total += amt;
                categoryMap[item.sub_account_id].count++;
                classified = true;
              }
            }

            // B. Fallback: If not explicitly linked, check if this category is the default for this account
            if (!classified) {
              const defaultCat = categories.find((c: any) => c.account_id === item.account_id);
              if (defaultCat) {
                categoryMap[defaultCat.id].total += amt;
                categoryMap[defaultCat.id].count++;
                classified = true;
              }
            }

            // C. Final fallback to "Unclassified"
            if (!classified) {
              miscTotal += amt;
              miscCount++;
            }
          });
        }
      });

      // 5. Convert map to sorted array
      const reportRows = Object.keys(categoryMap)
        .map(id => ({ id, ...categoryMap[id] }))
        .filter(r => r.total !== 0)
        .sort((a, b) => b.total - a.total);

      if (miscTotal !== 0) {
        reportRows.push({
          id: 'misc',
          code: 'MISC',
          name: language === 'ar' ? 'مصروفات متنوعة' : 'Miscellaneous Expenses',
          total: miscTotal,
          count: miscCount
        });
      }

      setExpenseData(reportRows);
    } catch (e) {
      console.error('Failed to generate expenses report:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, startDate, endDate]);

  const handleExportPDF = async () => {
    if (reportRef.current) {
      await exportToPDF(reportRef.current, {
        filename: 'Expenses_Report',
        orientation: 'landscape',
        reportTitle: t('reports.expenses_title')
      });
    }
  };

  const totals = useMemo(() => {
    return expenseData.reduce((acc, curr) => acc + curr.total, 0);
  }, [expenseData]);

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-zinc-900">{t('reports.expenses_title')}</h2>
          <p className="text-zinc-500 font-medium italic">{t('reports.expenses_subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportPDF} className="p-2.5 bg-white border border-zinc-200 text-zinc-600 rounded-xl hover:bg-zinc-50 transition-all shadow-sm"><Printer size={20} /></button>
          <button onClick={() => exportToExcel(expenseData, { filename: 'Expenses_Report' })} className="p-2.5 bg-white border border-zinc-200 text-zinc-600 rounded-xl hover:bg-zinc-50 transition-all shadow-sm"><Download size={20} /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-3xl border border-zinc-200 shadow-sm">
        <div className="relative">
          <Calendar className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
          <input
            type="date"
            className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none font-bold`}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="relative">
          <Calendar className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
          <input
            type="date"
            className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none font-bold`}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      <div ref={reportRef} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-rose-500 p-6 rounded-3xl text-white shadow-lg relative overflow-hidden">
            <div className="relative z-10">
              <TrendingDown className="mb-4 opacity-50" size={32} />
              <p className="text-white/60 text-[10px] font-bold uppercase tracking-wider mb-1">{t('reports.total_expenses')}</p>
              <h3 className="text-3xl font-black">{formatMoney(totals)}</h3>
            </div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
            <PieChart className="mb-4 text-zinc-300" size={32} />
            <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-1">{t('reports.expense_categories_count')}</p>
            <h4 className="text-xl font-bold">{expenseData.length}</h4>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
            <Calendar className="mb-4 text-zinc-300" size={32} />
            <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-1">{t('common.period')}</p>
            <h4 className="text-sm font-bold">{formatDate(startDate)} - {formatDate(endDate)}</h4>
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t('expenses.column_code')}</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t('expenses.column_name')}</th>
                <th className="px-6 py-4 text-center text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t('reports.percentage')}</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t('common.amount')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {expenseData.map((cat) => (
                <tr key={cat.id} className="hover:bg-zinc-50/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-zinc-400">{cat.code}</td>
                  <td className="px-6 py-4 text-sm font-bold text-zinc-900">{cat.name}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-3">
                      <div className="flex-1 max-w-[100px] h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div className="h-full bg-rose-500" style={{ width: `${(cat.total / totals * 100).toFixed(1)}%` }} />
                      </div>
                      <span className="text-[10px] font-black text-rose-500">{(cat.total / totals * 100).toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-left text-sm font-black text-zinc-900">{formatMoney(cat.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-zinc-900 text-white">
                <td colSpan={3} className="px-6 py-4 text-sm font-black">{t('reports.total_overall')}</td>
                <td className="px-6 py-4 text-left text-sm font-black">{formatMoney(totals)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
