import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  Calendar, 
  Download, 
  Printer, 
  PieChart, 
  TrendingDown, 
  ChevronRight, 
  ChevronDown,
  ArrowRightLeft,
  Filter,
  RefreshCcw,
  FileText
} from 'lucide-react';
import { exportToPDF } from '../utils/pdfUtils';
import { exportToExcel } from '../utils/excelUtils';
import { dbService } from '../services/dbService';
import { formatNumber, formatDate, formatMoney } from '../utils/formatUtils';
import { motion, AnimatePresence } from 'framer-motion';

interface ExpenseRow {
  type: 'category' | 'account' | 'misc';
  id: string;
  name: string;
  code: string;
  amount: number;
  count: number;
  subItems?: ExpenseRow[];
}

export const ExpensesReport: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const reportRef = useRef<HTMLDivElement>(null);
  
  const [startDate, setStartDate] = useState<string>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  
  const [expenseData, setExpenseData] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

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

      // 1. Find all expense type IDs
      const expenseTypeIds = accountTypes
        .filter((t: any) => 
          t.classification === 'expense' || 
          t.name?.toLowerCase().includes('expense') || 
          t.name?.includes('مصاريف')
        )
        .map((t: any) => t.id);
      
      const expenseAccountIds = new Set(
        accounts
          .filter((a: any) => expenseTypeIds.includes(a.type_id))
          .map((a: any) => a.id)
      );

      // 2. Data aggregation structures
      // Group by Category ID
      const categoryAggregate: Record<string, { amount: number; count: number; accounts: Record<string, { amount: number; count: number }> }> = {};
      // Group by Account ID (for those not categorized)
      const uncategorizedAccountAggregate: Record<string, { amount: number; count: number }> = {};

      // Initialize category map
      categories.forEach((cat: any) => {
        categoryAggregate[cat.id] = {
          amount: 0,
          count: 0,
          accounts: {}
        };
      });

      // 3. Process entries
      journalEntries.forEach((je: any) => {
        const jeDate = new Date(je.date);
        if (jeDate < start || jeDate > end) return;

        je.items?.forEach((item: any) => {
          if (!expenseAccountIds.has(item.account_id)) return;

          const amount = (Number(item.debit) || 0) - (Number(item.credit) || 0);
          if (amount === 0) return;

          let identified = false;

          // A. Check if it has a sub-account of type 'expense'
          if (item.sub_account_type === 'expense' && item.sub_account_id) {
            const catId = item.sub_account_id;
            if (categoryAggregate[catId]) {
              categoryAggregate[catId].amount += amount;
              categoryAggregate[catId].count++;
              
              if (!categoryAggregate[catId].accounts[item.account_id]) {
                categoryAggregate[catId].accounts[item.account_id] = { amount: 0, count: 0 };
              }
              categoryAggregate[catId].accounts[item.account_id].amount += amount;
              categoryAggregate[catId].accounts[item.account_id].count++;
              identified = true;
            }
          }

          // B. Fallback: Check if this account is the default for a category (common pattern in this ERP)
          if (!identified) {
            const defaultCat = categories.find((c: any) => c.account_id === item.account_id);
            if (defaultCat) {
              categoryAggregate[defaultCat.id].amount += amount;
              categoryAggregate[defaultCat.id].count++;
              
              if (!categoryAggregate[defaultCat.id].accounts[item.account_id]) {
                categoryAggregate[defaultCat.id].accounts[item.account_id] = { amount: 0, count: 0 };
              }
              categoryAggregate[defaultCat.id].accounts[item.account_id].amount += amount;
              categoryAggregate[defaultCat.id].accounts[item.account_id].count++;
              identified = true;
            }
          }

          // C. Final Fallback: Uncategorized usage of an expense account
          if (!identified) {
            if (!uncategorizedAccountAggregate[item.account_id]) {
              uncategorizedAccountAggregate[item.account_id] = { amount: 0, count: 0 };
            }
            uncategorizedAccountAggregate[item.account_id].amount += amount;
            uncategorizedAccountAggregate[item.account_id].count++;
          }
        });
      });

      // 4. Assemble report rows
      const reportRows: ExpenseRow[] = [];

      // Add Categorized rows
      Object.entries(categoryAggregate).forEach(([id, data]) => {
        if (data.amount === 0) return;

        const cat = categories.find((c: any) => c.id === id);
        const subItems: ExpenseRow[] = Object.entries(data.accounts).map(([accId, accData]) => {
          const acc = accounts.find((a: any) => a.id === accId);
          return {
            type: 'account',
            id: `${id}-${accId}`,
            name: acc?.name || t('reports.unknown_account'),
            code: acc?.code || '',
            amount: accData.amount,
            count: accData.count
          };
        });

        reportRows.push({
          type: 'category',
          id,
          name: cat?.name || t('reports.unknown_category'),
          code: cat?.code || '',
          amount: data.amount,
          count: data.count,
          subItems: subItems.sort((a, b) => b.amount - a.amount)
        });
      });

      // Add Uncategorized Account rows
      Object.entries(uncategorizedAccountAggregate).forEach(([accId, data]) => {
        const acc = accounts.find((a: any) => a.id === accId);
        reportRows.push({
          type: 'misc',
          id: `misc-${accId}`,
          name: `${acc?.name || t('reports.unknown_account')} (${language === 'ar' ? 'بدون تصنيف' : 'Uncategorized'})`,
          code: acc?.code || '',
          amount: data.amount,
          count: data.count
        });
      });

      // Sort and set state
      setExpenseData(reportRows.sort((a, b) => b.amount - a.amount));
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
        filename: `Expenses_Report_${startDate}_${endDate}`,
        orientation: 'portrait',
        reportTitle: t('reports.expenses_title')
      });
    }
  };

  const totalExpenses = useMemo(() => {
    return expenseData.reduce((acc, curr) => acc + curr.amount, 0);
  }, [expenseData]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8" dir={dir}>
      {/* Header section with glass effect */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/50 backdrop-blur-md p-8 rounded-[2rem] border border-zinc-200/50 shadow-xl shadow-zinc-200/20">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-rose-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-rose-200 transform -rotate-3">
            <TrendingDown size={28} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-zinc-900 tracking-tight">{t('reports.expenses_title')}</h2>
            <p className="text-zinc-500 font-medium">{t('reports.expenses_subtitle')}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchData}
            className="p-3 bg-white border border-zinc-200 text-zinc-600 rounded-2xl hover:bg-zinc-50 hover:text-indigo-600 transition-all hover:scale-105 active:scale-95 shadow-sm"
          >
            <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          <div className="w-px h-8 bg-zinc-200 mx-1" />
          <button 
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-5 py-3 bg-zinc-900 text-white rounded-2xl hover:bg-zinc-800 transition-all hover:translate-y-[-2px] active:translate-y-0 shadow-lg shadow-zinc-200 font-bold text-sm"
          >
            <Printer size={18} />
            {t('common.print')}
          </button>
          <button 
            onClick={() => exportToExcel(expenseData, { filename: 'Expenses_Report' })}
            className="flex items-center gap-2 px-5 py-3 bg-white border border-zinc-200 text-zinc-900 rounded-2xl hover:bg-zinc-50 transition-all hover:translate-y-[-2px] active:translate-y-0 shadow-sm font-bold text-sm"
          >
            <Download size={18} />
            Excel
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-white p-6 rounded-[2rem] border border-zinc-200 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
          <Filter size={64} />
        </div>
        
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-1">{t('reports.from_date')}</label>
          <div className="relative">
            <Calendar className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
            <input
              type="date"
              className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all font-bold text-zinc-700`}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-1">{t('reports.to_date')}</label>
          <div className="relative">
            <Calendar className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
            <input
              type="date"
              className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all font-bold text-zinc-700`}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="md:col-span-2 flex items-end">
            <div className="w-full bg-rose-50 p-4 rounded-2xl border border-rose-100 flex items-center justify-between">
                <div>
                   <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">{t('reports.total_expenses')}</p>
                   <p className="text-2xl font-black text-rose-600">{formatMoney(totalExpenses)}</p>
                </div>
                <PieChart size={32} className="text-rose-200" />
            </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[2rem] border border-zinc-200 border-dashed">
          <RefreshCcw className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
          <p className="text-zinc-500 font-bold text-lg animate-pulse">{t('common.loading')}</p>
        </div>
      ) : (
        <div ref={reportRef} className="space-y-6">
          {/* Main List */}
          <div className="bg-white border border-zinc-200 rounded-[2rem] overflow-hidden shadow-xl shadow-zinc-200/20">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-zinc-50/50 border-b border-zinc-200 uppercase tracking-tighter">
                    <th className="w-16"></th>
                    <th className="px-6 py-5 text-[11px] font-black text-zinc-400 text-right">{t('expenses.column_code')}</th>
                    <th className="px-6 py-5 text-[11px] font-black text-zinc-400 text-right">{t('expenses.column_name')}</th>
                    <th className="px-6 py-5 text-[11px] font-black text-zinc-400 text-center">{t('reports.percentage')}</th>
                    <th className="px-6 py-5 text-[11px] font-black text-zinc-400 text-left">{t('common.amount')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {expenseData.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center text-zinc-200">
                            <FileText size={40} />
                          </div>
                          <p className="text-zinc-400 font-bold">{t('reports.no_expenses')}</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    expenseData.map((row) => (
                      <React.Fragment key={row.id}>
                        <tr 
                          className={`
                            hover:bg-zinc-50/50 transition-colors cursor-pointer group
                            ${expandedRows.has(row.id) ? 'bg-zinc-50/80 shadow-inner' : ''}
                          `}
                          onClick={() => toggleRow(row.id)}
                        >
                          <td className="pl-6 py-5 text-center">
                            {row.subItems && row.subItems.length > 0 && (
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${expandedRows.has(row.id) ? 'bg-rose-500 text-white rotate-180 shadow-md' : 'bg-zinc-100 text-zinc-400 group-hover:bg-zinc-200'}`}>
                                    <ChevronDown size={18} />
                                </div>
                            )}
                          </td>
                          <td className="px-6 py-5 font-mono text-[11px] font-bold text-zinc-400">
                            {row.code}
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex flex-col">
                              <span className="text-sm font-black text-zinc-900 leading-tight">{row.name}</span>
                              <span className="text-[10px] text-zinc-400 font-bold mt-1 uppercase tracking-wider flex items-center gap-1.5 underline decoration-zinc-100 italic">
                                {row.count} {language === 'ar' ? 'عمليات' : 'transactions'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-5 min-w-[140px]">
                            <div className="flex items-center justify-center gap-3">
                              <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden shadow-inner">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(row.amount / totalExpenses * 100).toFixed(1)}%` }}
                                  className={`h-full ${row.type === 'misc' ? 'bg-zinc-400' : 'bg-rose-500'} rounded-full`}
                                />
                              </div>
                              <span className={`text-[11px] font-black min-w-[40px] text-left ${row.type === 'misc' ? 'text-zinc-500' : 'text-rose-500 underline'}`}>
                                {(row.amount / totalExpenses * 100).toFixed(1)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-left">
                            <span className={`text-base font-black tracking-tight ${row.type === 'misc' ? 'text-zinc-600' : 'text-zinc-900'}`}>
                              {formatMoney(row.amount)}
                            </span>
                          </td>
                        </tr>

                        {/* Collapsible Sub Items (Accounts) */}
                        <AnimatePresence>
                          {expandedRows.has(row.id) && row.subItems && (
                            <motion.tr
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                            >
                              <td colSpan={5} className="p-0 bg-zinc-50/30">
                                <div className="px-14 pb-4 pt-1 space-y-1.5 border-r-2 border-rose-200/50 m-4 rounded-r-2xl">
                                  {row.subItems.map(sub => (
                                    <div key={sub.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-zinc-100 shadow-sm hover:border-rose-100 transition-colors group/sub">
                                      <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-zinc-50 flex items-center justify-center text-zinc-300 group-hover/sub:bg-rose-50 group-hover/sub:text-rose-400 transition-colors">
                                            <ArrowRightLeft size={14} />
                                        </div>
                                        <div>
                                          <p className="text-xs font-bold text-zinc-700">{sub.name}</p>
                                          <p className="text-[9px] font-black text-zinc-400 uppercase">{sub.code}</p>
                                        </div>
                                      </div>
                                      <div className="text-left">
                                        <p className="text-sm font-black text-zinc-900">{formatMoney(sub.amount)}</p>
                                        <p className="text-[9px] font-bold text-zinc-400">{sub.count} {language === 'ar' ? 'حركات' : 'items'}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </motion.tr>
                          )}
                        </AnimatePresence>
                      </React.Fragment>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-zinc-900 text-white shadow-xl">
                    <td colSpan={4} className="px-8 py-6 text-sm font-black uppercase tracking-widest border-r border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                                <TrendingDown className="text-rose-400" size={20} />
                            </div>
                            {t('reports.total_overall')}
                        </div>
                    </td>
                    <td className="px-8 py-6 text-left text-2xl font-black italic">
                      {formatMoney(totalExpenses)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Additional Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
            <div className="bg-white p-8 rounded-[2rem] border border-zinc-200 shadow-sm flex items-start gap-5">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 shadow-inner">
                <PieChart size={28} />
              </div>
              <div>
                <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">{t('reports.expense_categories_count')}</h4>
                <p className="text-3xl font-black text-zinc-900">{expenseData.length}</p>
                <p className="text-xs text-zinc-500 mt-1 font-medium">{language === 'ar' ? 'تصنيف مالي مختلف مسجل' : 'Different financial categories recorded'}</p>
              </div>
            </div>
            
            <div className="bg-white p-8 rounded-[2rem] border border-zinc-200 shadow-sm flex items-start gap-5">
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 shadow-inner">
                <FileText size={28} />
              </div>
              <div>
                <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">{language === 'ar' ? 'إجمالي الحركات' : 'Total Transactions'}</h4>
                <p className="text-3xl font-black text-zinc-900">
                    {expenseData.reduce((acc, curr) => acc + curr.count, 0)}
                </p>
                <p className="text-xs text-zinc-500 mt-1 font-medium">{language === 'ar' ? 'قيد محاسبي خلال هذه الفترة' : 'Journal lines processed in this period'}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
