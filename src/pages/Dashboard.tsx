import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  FileText, 
  Receipt as ReceiptIcon, 
  ArrowUpRight, 
  Search,
  Sparkles,
  Clock
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  DashboardStats, 
  Invoice, 
  Return, 
  ReceiptVoucher, 
  PaymentVoucher, 
  Customer, 
  Supplier, 
  DashboardTransaction,
  PurchaseInvoice,
  PurchaseReturn,
  CustomerDiscount,
  SupplierDiscount,
  Account,
  AccountType
} from '../types';
import { smartSearch } from '../services/geminiService';
import { dbService } from '../services/dbService';

// Global cache for dashboard stats to reduce reads on tab switches
let statsCache: { [companyId: string]: { stats: DashboardStats, timestamp: number } } = {};
const CACHE_DURATION = 1000 * 60 * 5; // 5 minutes

export const Dashboard: React.FC = () => {
  const { user, isSuperAdmin, isCompanyAdmin } = useAuth();
  const { activeTabId } = useNavigation();
  const { t, dir, language } = useLanguage();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    if (user) {
      const companyId = isSuperAdmin ? 'super_admin' : user.company_id;
      const cached = statsCache[companyId];
      
      if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
        setStats(cached.stats);
        setLoading(false);
      } else {
        fetchStats();
      }
    }
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [user]);

  const fetchStats = async () => {
    if (!user) return;
    const companyId = isSuperAdmin ? 'super_admin' : user.company_id;
    
    try {
      setLoading(true);
      const [
        invoices, 
        returns, 
        receipts, 
        payments, 
        customers, 
        suppliers,
        purchaseInvoices,
        purchaseReturns,
        customerDiscounts,
        supplierDiscounts,
        journalEntries,
        accounts,
        accountTypes
      ] = await Promise.all([
        isSuperAdmin ? dbService.listAll<Invoice>('invoices') : dbService.list<Invoice>('invoices', user.company_id),
        isSuperAdmin ? dbService.listAll<Return>('returns') : dbService.list<Return>('returns', user.company_id),
        isSuperAdmin ? dbService.listAll<ReceiptVoucher>('receipt_vouchers') : dbService.list<ReceiptVoucher>('receipt_vouchers', user.company_id),
        isSuperAdmin ? dbService.listAll<PaymentVoucher>('payment_vouchers') : dbService.list<PaymentVoucher>('payment_vouchers', user.company_id),
        isSuperAdmin ? dbService.listAll<Customer>('customers') : dbService.list<Customer>('customers', user.company_id),
        isSuperAdmin ? dbService.listAll<Supplier>('suppliers') : dbService.list<Supplier>('suppliers', user.company_id),
        isSuperAdmin ? dbService.listAll<PurchaseInvoice>('purchase_invoices') : dbService.list<PurchaseInvoice>('purchase_invoices', user.company_id),
        isSuperAdmin ? dbService.listAll<PurchaseReturn>('purchase_returns') : dbService.list<PurchaseReturn>('purchase_returns', user.company_id),
        isSuperAdmin ? dbService.listAll<CustomerDiscount>('customer_discounts') : dbService.list<CustomerDiscount>('customer_discounts', user.company_id),
        isSuperAdmin ? dbService.listAll<SupplierDiscount>('supplier_discounts') : dbService.list<SupplierDiscount>('supplier_discounts', user.company_id),
        isSuperAdmin ? dbService.listAll<any>('journal_entries') : dbService.list<any>('journal_entries', user.company_id),
        isSuperAdmin ? dbService.listAll<Account>('accounts') : dbService.list<Account>('accounts', user.company_id),
        isSuperAdmin ? dbService.listAll<AccountType>('account_types') : dbService.list<AccountType>('account_types', user.company_id)
      ]);

      const totalInvoicesAmount = invoices.reduce((sum, inv) => sum + inv.total_amount, 0);
      const totalReturnsAmount = returns.reduce((sum, ret) => sum + ret.total_amount, 0);
      const netSales = totalInvoicesAmount - totalReturnsAmount;

      const cashSalesAmount = invoices.filter(i => i.payment_type === 'cash').reduce((sum, i) => sum + i.total_amount, 0);
      const cashPurchasesAmount = purchaseInvoices.filter(i => i.payment_type === 'cash').reduce((sum, i) => sum + i.total_amount, 0);

      const totalReceipts = receipts.reduce((sum, r) => sum + r.amount, 0) + cashSalesAmount;
      const totalExpenses = payments.reduce((sum, p) => sum + p.amount, 0) + cashPurchasesAmount;

      // Calculate Customer Balances (Matching Balance Sheet logic)
      const customerAccountIds = new Set([
        ...customers.map(c => c.account_id).filter(Boolean),
        ...accounts.filter(a => a.name === 'عملاء' || a.name === 'العملاء' || a.name === 'حساب العملاء').map(a => a.id)
      ]);

      const totalCustomerBalances = accounts
        .filter(acc => customerAccountIds.has(acc.id))
        .reduce((sum, acc) => {
          const type = accountTypes.find(t => t.id === acc.type_id);
          if (type?.classification !== 'asset') return sum;

          let balance = acc.opening_balance || 0;
          journalEntries.forEach((je: any) => {
            je.items?.forEach((item: any) => {
              if (item.account_id === acc.id) {
                balance += (item.debit || 0) - (item.credit || 0);
              }
            });
          });
          return sum + balance;
        }, 0);

      // Calculate Supplier Balances (Matching Balance Sheet logic)
      const supplierAccountIds = new Set([
        ...suppliers.map(s => s.account_id).filter(Boolean),
        ...accounts.filter(a => a.name === 'موردين' || a.name === 'الموردين' || a.name === 'حساب الموردين').map(a => a.id)
      ]);

      const totalSupplierBalances = accounts
        .filter(acc => supplierAccountIds.has(acc.id))
        .reduce((sum, acc) => {
          const type = accountTypes.find(t => t.id === acc.type_id);
          if (type?.classification !== 'liability_equity') return sum;

          let balance = acc.opening_balance || 0;
          journalEntries.forEach((je: any) => {
            je.items?.forEach((item: any) => {
              if (item.account_id === acc.id) {
                balance += (item.debit || 0) - (item.credit || 0);
              }
            });
          });
          // Balance Sheet logic: Liabilities are (Debit - Credit) * -1
          return sum + (balance * -1);
        }, 0);

      // Simple sales by month calculation
      const monthKeys = ['months.jan', 'months.feb', 'months.mar', 'months.apr', 'months.may', 'months.jun', 'months.jul', 'months.aug', 'months.sep', 'months.oct', 'months.nov', 'months.dec'];
      const salesByMonth = monthKeys.map((key, index) => {
        const monthInvoices = invoices.filter(inv => new Date(inv.date).getMonth() === index);
        const monthReturns = returns.filter(ret => new Date(ret.date).getMonth() === index);
        const total = monthInvoices.reduce((sum, inv) => sum + inv.total_amount, 0) - 
                      monthReturns.reduce((sum, ret) => sum + ret.total_amount, 0);
        return { month: t(key), total };
      });

      const recentTransactions: DashboardTransaction[] = [
        ...invoices.map(inv => ({
          id: inv.id,
          type: 'invoice' as const,
          number: inv.invoice_number,
          customer_name: inv.customer_name || t('dashboard.unknown_customer'),
          date: inv.date,
          total_amount: inv.total_amount
        })),
        ...returns.map(ret => ({
          id: ret.id,
          type: 'return' as const,
          number: ret.return_number,
          customer_name: ret.customer_name || t('dashboard.unknown_customer'),
          date: ret.date,
          total_amount: ret.total_amount
        })),
        ...journalEntries.filter((je: any) => je.reference_type === 'manual').map((je: any) => ({
          id: je.id,
          type: 'journal' as any,
          number: je.reference_number || `${t('journal.entry')}-${je.id.slice(-6)}`,
          customer_name: je.items?.find((item: any) => item.customer_name)?.customer_name || je.description || t('dashboard.manual_journal'),
          date: je.date,
          total_amount: je.total_debit
        }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
       .slice(0, 5);

      const newStats: DashboardStats = {
        netSales,
        totalInvoices: invoices.length,
        totalReceipts,
        totalExpenses,
        totalCustomerBalances,
        totalSupplierBalances,
        salesByMonth,
        recentTransactions
      };

      setStats(newStats);
      
      // Update cache
      statsCache[companyId] = {
        stats: newStats,
        timestamp: Date.now()
      };
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAiSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsAiSearching(true);
    try {
      const response = await smartSearch(searchQuery, stats);
      setAiResponse(response || t('dashboard.no_answer'));
    } catch (e: any) {
      console.error("AI Search Error:", e);
      setAiResponse(`${t('dashboard.ai_search_error')}: ${e.message || t('dashboard.unknown_error')}`);
    } finally {
      setIsAiSearching(false);
    }
  };

  const formatBalance = (value: number) => {
    const formatted = Math.abs(value).toLocaleString();
    if (value > 0) return `+${formatted}`;
    if (value < 0) return `-${formatted}`;
    return '0';
  };

  if (loading) return <div className="flex items-center justify-center h-full">{t('common.loading')}</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-900 italic serif">{t('dashboard.title')}</h2>
          <div className="flex items-center gap-4 mt-1">
            <div className="flex items-center gap-2 text-zinc-500">
              <Clock size={14} className="text-emerald-500" />
              <p className="text-xs md:text-sm font-medium">
                {currentTime.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })} | 
                <span className="text-zinc-900 ml-1 font-mono">{currentTime.toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span>
              </p>
            </div>
            {isCompanyAdmin && (
              <div className="flex items-center gap-2 px-3 py-1 bg-zinc-100 rounded-full border border-zinc-200">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">{t('dashboard.company_code')}</span>
                <code className="text-xs font-mono font-bold text-zinc-900 select-all cursor-pointer" title={t('dashboard.click_to_copy')} onClick={() => {
                  navigator.clipboard.writeText(user.company_id);
                  setAiResponse(t('dashboard.copied'));
                }}>{user.company_id}</code>
              </div>
            )}
          </div>
        </div>
        
        <form onSubmit={handleAiSearch} className="relative w-full md:w-96">
          <input
            type="text"
            placeholder={t('dashboard.ask_ai')}
            className={`w-full ${dir === 'rtl' ? 'pl-10 pr-12' : 'pr-10 pl-12'} py-3.5 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all shadow-sm text-base`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search className={`absolute ${dir === 'rtl' ? 'left-3' : 'right-3'} top-4 text-zinc-400`} size={18} />
          <button 
            type="submit"
            disabled={isAiSearching}
            className={`absolute ${dir === 'rtl' ? 'right-2' : 'left-2'} top-2 bottom-2 px-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-50`}
          >
            <Sparkles size={18} className={isAiSearching ? 'animate-pulse' : ''} />
          </button>
        </form>
      </div>

      {aiResponse && (
        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex gap-3 animate-in slide-in-from-top-2">
          <Sparkles className="text-emerald-500 shrink-0" size={20} />
          <div>
            <p className="text-sm font-medium text-emerald-900">{t('dashboard.ai_assistant')}</p>
            <p className="text-emerald-800">{aiResponse}</p>
            <button onClick={() => setAiResponse(null)} className="text-xs text-emerald-600 mt-2 hover:underline">{t('dashboard.close')}</button>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-white p-4 md:p-6 rounded-3xl border border-zinc-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <div className="p-2 md:p-3 bg-emerald-50 text-emerald-600 rounded-xl md:rounded-2xl">
              <TrendingUp size={20} className="md:w-6 md:h-6" />
            </div>
            <span className="text-[10px] md:text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg flex items-center gap-1">
              <ArrowUpRight size={10} className="md:w-3 md:h-3" /> +12%
            </span>
          </div>
          <p className="text-zinc-500 text-[10px] md:text-sm font-medium uppercase tracking-wider">{t('dashboard.net_profit')}</p>
          <h3 className="text-xl md:text-3xl font-bold text-zinc-900 mt-1">{(stats?.netSales || 0).toLocaleString()}</h3>
          <p className="text-[10px] text-zinc-400 mt-1">{t('dashboard.after_returns')}</p>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-3xl border border-zinc-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <div className="p-2 md:p-3 bg-indigo-50 text-indigo-600 rounded-xl md:rounded-2xl">
              <FileText size={20} className="md:w-6 md:h-6" />
            </div>
          </div>
          <p className="text-zinc-500 text-[10px] md:text-sm font-medium uppercase tracking-wider">{t('dashboard.total_invoices')}</p>
          <h3 className="text-xl md:text-3xl font-bold text-zinc-900 mt-1">{stats?.totalInvoices || 0}</h3>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-3xl border border-zinc-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <div className="p-2 md:p-3 bg-amber-50 text-amber-600 rounded-xl md:rounded-2xl">
              <ReceiptIcon size={20} className="md:w-6 md:h-6" />
            </div>
          </div>
          <p className="text-zinc-500 text-[10px] md:text-sm font-medium uppercase tracking-wider">{t('dashboard.receipt_vouchers')}</p>
          <h3 className="text-xl md:text-3xl font-bold text-zinc-900 mt-1">{(stats?.totalReceipts || 0).toLocaleString()}</h3>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-3xl border border-zinc-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <div className="p-2 md:p-3 bg-rose-50 text-rose-600 rounded-xl md:rounded-2xl">
              <TrendingUp size={20} className="md:w-6 md:h-6 rotate-180" />
            </div>
          </div>
          <p className="text-zinc-500 text-[10px] md:text-sm font-medium uppercase tracking-wider">{t('dashboard.total_expenses')}</p>
          <h3 className="text-xl md:text-3xl font-bold text-zinc-900 mt-1">{(stats?.totalExpenses || 0).toLocaleString()}</h3>
        </div>
      </div>

      {/* Balances Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-zinc-900 p-6 md:p-8 rounded-[2rem] text-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <TrendingUp size={120} />
          </div>
          <div className="relative z-10">
            <p className="text-zinc-400 text-sm md:text-base font-medium mb-2">{t('dashboard.customer_balances')}</p>
            <h3 className="text-3xl md:text-5xl font-bold tracking-tighter mb-4">
              {formatBalance(stats?.totalCustomerBalances || 0)} <span className="text-lg md:text-2xl font-normal text-zinc-500">{t('invoices.currency')}</span>
            </h3>
            <div className="flex items-center gap-2 text-emerald-400 text-xs md:text-sm font-medium">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {t('dashboard.active_receivables')}
            </div>
          </div>
        </div>

        <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-zinc-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-500">
            <ReceiptIcon size={120} />
          </div>
          <div className="relative z-10">
            <p className="text-zinc-500 text-sm md:text-base font-medium mb-2">{t('dashboard.supplier_balances')}</p>
            <h3 className="text-3xl md:text-5xl font-bold tracking-tighter text-zinc-900 mb-4">
              {formatBalance(stats?.totalSupplierBalances || 0)} <span className="text-lg md:text-2xl font-normal text-zinc-400">{t('invoices.currency')}</span>
            </h3>
            <div className="flex items-center gap-2 text-rose-500 text-xs md:text-sm font-medium">
              <div className="w-2 h-2 rounded-full bg-rose-500" />
              {t('dashboard.outstanding_debts')}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Chart */}
        <div className="bg-white p-8 rounded-3xl border border-zinc-100 shadow-sm">
          <h4 className="text-lg font-bold text-zinc-900 mb-6">{t('dashboard.sales_performance')}</h4>
          <div className="w-full min-h-[300px]">
            {activeTabId === 'dashboard' && (
              <ResponsiveContainer width="100%" aspect={2} minWidth={0}>
                <AreaChart data={stats?.salesByMonth}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#71717a', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#71717a', fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  />
                  <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white p-8 rounded-3xl border border-zinc-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-lg font-bold text-zinc-900">{t('dashboard.recent_transactions')}</h4>
            <button className="text-sm text-emerald-600 font-medium hover:underline">{t('dashboard.view_all')}</button>
          </div>
          <div className="space-y-4">
            {stats?.recentTransactions.map((tx) => (
              <div key={`${tx.type}-${tx.id}`} className={`flex items-center justify-between p-4 rounded-2xl hover:bg-zinc-50 transition-colors border border-transparent hover:border-zinc-100 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    tx.type === 'invoice' ? 'bg-emerald-50 text-emerald-600' : 
                    tx.type === 'return' ? 'bg-rose-50 text-rose-600' : 
                    'bg-blue-50 text-blue-600'
                  }`}>
                    {tx.type === 'invoice' ? <ArrowUpRight size={18} /> : 
                     tx.type === 'return' ? <ArrowUpRight size={18} className="rotate-180" /> :
                     <FileText size={18} />}
                  </div>
                  <div>
                    <p className="font-bold text-zinc-900">{tx.customer_name}</p>
                    <p className="text-xs text-zinc-500">
                      <span className={
                        tx.type === 'invoice' ? 'text-emerald-600' : 
                        tx.type === 'return' ? 'text-rose-600' : 
                        'text-blue-600'
                      }>
                        {tx.type === 'invoice' ? t('dashboard.invoice') : 
                         tx.type === 'return' ? t('dashboard.return') : 
                         t('dashboard.manual_journal')}
                      </span> • {tx.number} • {tx.date}
                    </p>
                  </div>
                </div>
                <p className={`font-bold ${tx.type === 'invoice' ? 'text-zinc-900' : 'text-rose-600'}`}>
                  {tx.type === 'invoice' ? '' : '-'}{(tx.total_amount || 0).toLocaleString()} {t('invoices.currency')}
                </p>
              </div>
            ))}
            {stats?.recentTransactions.length === 0 && (
              <p className="text-center text-zinc-500 py-8">{t('dashboard.no_recent')}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
