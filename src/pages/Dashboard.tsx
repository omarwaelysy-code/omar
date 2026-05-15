import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  FileText, 
  Receipt as ReceiptIcon, 
  ArrowUpRight, 
  Search,
  Sparkles,
  Clock,
  ArrowDownRight,
  Zap,
  Users as UsersIcon,
  Calendar,
  Wallet
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
import { motion } from 'framer-motion';
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
import { AccountingEngine } from '../services/AccountingEngine';
import { formatNumber, formatMoney, formatDate } from '../utils/formatUtils';

// Global cache for dashboard stats to reduce reads on tab switches
let statsCache: { [companyId: string]: { stats: DashboardStats, timestamp: number } } = {};
const CACHE_DURATION = 1000 * 30; // 30 seconds

// Listen for database changes GLOBALLY to invalidate cache even if Dashboard is not mounted
if (typeof window !== 'undefined') {
  window.addEventListener('db-refresh', () => {
    statsCache = {};
  });
}

export const clearDashboardCache = () => {
  statsCache = {};
};

const StatCard = ({ title, value, subtitle, icon: Icon, trend, colorClass }: any) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className="bg-white border border-slate-200 rounded-2xl p-6 relative overflow-hidden group shadow-sm transition-all"
  >
    <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${colorClass} opacity-[0.03] rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500`} />
    
    <div className="flex items-center justify-between mb-4 relative z-10">
            <div className={`p-3 rounded-xl bg-slate-50 border border-slate-100 group-hover:scale-110 transition-transform`}>
        <Icon size={24} className={colorClass && typeof colorClass === 'string' ? colorClass.split(' ')[0].replace('from-', 'text-') : ''} />
      </div>
      {trend && (
        <span className={`text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 ${trend > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
          {trend > 0 ? <TrendingUp size={12} /> : <ArrowDownRight size={12} />}
          {Math.abs(trend)}%
        </span>
      )}
    </div>
    
    <div className="relative z-10">
      <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{value}</h3>
      {subtitle && <p className="text-[10px] text-slate-400 font-medium mt-1 uppercase tracking-tight">{subtitle}</p>}
    </div>
  </motion.div>
);

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
    if (user && !isSuperAdmin) {
      const companyId = user.company_id;
      const cacheKey = `${user.id}_${companyId}`;
      const cached = statsCache[cacheKey];
      
      if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
        setStats(cached.stats);
        setLoading(false);
      } else {
        fetchStats();
      }
    } else if (isSuperAdmin) {
      setLoading(false);
    }
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    const handleFocus = () => fetchStats(false);
    const handleDbRefresh = () => {
      if (user) {
        const cacheKey = `${user.id}_${user.company_id}`;
        delete statsCache[cacheKey];
      }
      fetchStats(false);
    };

    window.addEventListener('db-refresh', handleDbRefresh);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(timer);
      window.removeEventListener('db-refresh', handleDbRefresh);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user, isSuperAdmin]);

  const fetchStats = async (showLoading = true) => {
    if (!user || isSuperAdmin) return;
    const companyId = user.company_id;
    
    try {
      if (showLoading) setLoading(true);
      
      const results = await Promise.allSettled([
        dbService.list<Invoice>('invoices', user.company_id),
        dbService.list<Return>('returns', user.company_id),
        dbService.list<ReceiptVoucher>('receipt_vouchers', user.company_id),
        dbService.list<PaymentVoucher>('payment_vouchers', user.company_id),
        dbService.list<Customer>('customers', user.company_id),
        dbService.list<Supplier>('suppliers', user.company_id),
        dbService.list<PurchaseInvoice>('purchase_invoices', user.company_id),
        dbService.list<PurchaseReturn>('purchase_returns', user.company_id),
        dbService.list<CustomerDiscount>('customer_discounts', user.company_id),
        dbService.list<SupplierDiscount>('supplier_discounts', user.company_id),
        dbService.list<any>('journal_entries', user.company_id),
        dbService.list<Account>('accounts', user.company_id),
        dbService.list<AccountType>('account_types', user.company_id),
        dbService.list<any>('payment_methods', user.company_id)
      ]);

      const [
        invoices, returns, receipts, payments, customers, suppliers,
        purchaseInvoices, purchaseReturns, customerDiscounts, supplierDiscounts,
        journalEntries, accounts, accountTypes, paymentMethods
      ] = results.map(r => r.status === 'fulfilled' ? r.value : []) as [
        Invoice[], Return[], ReceiptVoucher[], PaymentVoucher[], Customer[], Supplier[],
        PurchaseInvoice[], PurchaseReturn[], CustomerDiscount[], SupplierDiscount[],
        any[], Account[], AccountType[], any[]
      ];

      const now = new Date();
      const statsMonth = now.getMonth();
      const statsYear = now.getFullYear();
      
      const startOfMonth = `${statsYear}-${String(statsMonth + 1).padStart(2, '0')}-01`;
      const today = now.toISOString().split('T')[0];

      const incomeStatement = AccountingEngine.calculateIncomeStatement(accounts, accountTypes, journalEntries, startOfMonth, today);
      const balanceSheet = AccountingEngine.calculateBalanceSheet(accounts, accountTypes, journalEntries, today);

      const netProfit = incomeStatement.netProfit;
      const netSales = incomeStatement.totalRevenues;
      const totalExpensesValue = incomeStatement.totalExpenses + incomeStatement.totalCosts;
      
      const monthInvoices = invoices.filter(inv => {
        if (!inv.date) return false;
        const [y, m] = inv.date.split('-').map(Number);
        return (m - 1) === statsMonth && y === statsYear;
      });

      const monthReceipts = receipts.filter(r => {
        if (!r.date) return false;
        const [y, m] = r.date.split('-').map(Number);
        return (m - 1) === statsMonth && y === statsYear;
      });

      const totalReceipts = receipts
        .filter(r => {
          if (!r.date) return false;
          const [y, m] = r.date.split('-').map(Number);
          return (m - 1) === statsMonth && y === statsYear;
        })
        .reduce((sum, r: any) => {
          // If header amount exists, use it. Otherwise sum items (for multi-receipt)
          if (r.amount && Number(r.amount) > 0) return sum + Number(r.amount);
          if (r.type === 'multi' && r.items && Array.isArray(r.items)) {
            return sum + r.items.reduce((s: number, item: any) => s + (Number(item.amount) || 0), 0);
          }
          return sum;
        }, 0);

      const totalCustomerBalances = balanceSheet.assets
        .filter(a => {
          const acc = accounts.find(account => account.id === a.id);
          return acc?.name.includes('عملاء') || acc?.name.includes('العملاء') || customers.some(c => c.account_id === a.id);
        })
        .reduce((sum, a) => sum + a.balance, 0);

      const totalSupplierBalances = balanceSheet.liabilities
        .filter(l => {
          const acc = accounts.find(account => account.id === l.id);
          return acc?.name.includes('موردين') || acc?.name.includes('الموردين') || suppliers.some(s => s.account_id === l.id);
        })
        .reduce((sum, l) => sum + l.balance, 0);

      const totalCashBalance = balanceSheet.assets
        .filter(a => {
          const acc = accounts.find(account => account.id === a.id);
          return acc?.name.includes('نقدية') || acc?.name.includes('صندوق') || acc?.name.includes('خزينة') || acc?.name.includes('بنك') || paymentMethods.some(p => p.account_id === a.id);
        })
        .reduce((sum, a) => sum + a.balance, 0);

      const monthKeys = ['months.jan', 'months.feb', 'months.mar', 'months.apr', 'months.may', 'months.jun', 'months.jul', 'months.aug', 'months.sep', 'months.oct', 'months.nov', 'months.dec'];
      const salesByMonth = monthKeys.map((key, index) => {
        const monthInvoices = invoices.filter((inv: Invoice) => (new Date(inv.date).getUTCMonth() === index));
        const monthReturns = returns.filter((ret: Return) => (new Date(ret.date).getUTCMonth() === index));
        const total = monthInvoices.reduce((sum: number, inv: Invoice) => sum + (Number(inv.total_amount) || 0), 0) - 
                      monthReturns.reduce((sum: number, ret: Return) => sum + (Number(ret.total_amount) || 0), 0);
        return { month: t(key), total };
      });

      const recentTransactions: DashboardTransaction[] = [
        ...invoices.map((inv: Invoice) => ({ id: inv.id, type: 'invoice' as const, number: inv.invoice_number, customer_name: inv.customer_name || t('dashboard.unknown_customer'), date: inv.date, total_amount: Number(inv.total_amount) || 0 })),
        ...returns.map((ret: Return) => ({ id: ret.id, type: 'return' as const, number: ret.return_number, customer_name: ret.customer_name || t('dashboard.unknown_customer'), date: ret.date, total_amount: Number(ret.total_amount) || 0 })),
        ...receipts.map((r: ReceiptVoucher) => ({ id: r.id, type: 'receipt' as const, number: r.voucher_number || r.id.slice(-6), customer_name: r.customer_name || t('dashboard.unknown_customer'), date: r.date, total_amount: Number(r.amount) || 0 })),
        ...payments.map((p: PaymentVoucher) => ({ id: p.id, type: 'payment' as const, number: p.voucher_number || p.id.slice(-6), customer_name: p.supplier_name || p.description || t('dashboard.unknown_supplier'), date: p.date, total_amount: Number(p.amount) || 0 }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

      const newStats: DashboardStats = { netProfit, netSales, totalInvoices: monthInvoices.length, totalReceipts, totalExpenses: totalExpensesValue, totalCustomerBalances, totalSupplierBalances, totalCashBalance, salesByMonth, recentTransactions };
      setStats(newStats);
      
      const cacheKey = `${user.id}_${companyId}`;
      statsCache[cacheKey] = { stats: newStats, timestamp: Date.now() };
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
      setAiResponse(`${t('dashboard.ai_search_error')}: ${e.message}`);
    } finally {
      setIsAiSearching(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full p-20"><div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-8 font-sans px-2 md:px-0" 
      dir={dir}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-8 bg-brand-primary rounded-full shadow-sm" />
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">{t('dashboard.title')}</h2>
          </div>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-2 text-slate-500 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
              <Calendar size={14} className="text-brand-primary" />
              <p className="text-[10px] font-bold uppercase tracking-wider">
                {currentTime.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              <div className="w-[1px] h-3 bg-slate-200" />
              <span className="text-slate-900 font-mono text-xs font-bold leading-none">{currentTime.toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            {isCompanyAdmin && (
              <div className="flex items-center gap-2 group cursor-pointer" onClick={() => {
                navigator.clipboard.writeText(user.company_id);
                setAiResponse(t('dashboard.copied'));
              }}>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full border border-slate-200 hover:bg-slate-200 transition-all">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{t('dashboard.company_code')}</span>
                  <code className="text-[10px] font-mono font-bold text-slate-900">{user.company_id}</code>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <form onSubmit={handleAiSearch} className="relative w-full lg:w-[420px] group">
          <input
            type="text"
            placeholder={t('dashboard.ask_ai')}
            className={`relative w-full ${dir === 'rtl' ? 'pl-10 pr-12' : 'pr-10 pl-12'} py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all shadow-sm text-sm font-medium text-slate-900 placeholder:text-slate-400`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-primary transition-colors`} size={18} />
          <button 
            type="submit"
            disabled={isAiSearching}
            className={`absolute ${dir === 'rtl' ? 'left-2' : 'right-2'} top-2 bottom-2 w-10 bg-slate-900 text-white rounded-xl hover:bg-brand-primary transition-all active:scale-95 flex items-center justify-center disabled:opacity-50`}
          >
            {isAiSearching ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Sparkles size={18} />}
          </button>
        </form>
      </div>

      {aiResponse && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white border border-slate-200 p-6 rounded-2xl flex gap-4 shadow-xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 blur-3xl rounded-full -mr-16 -mt-16" />
          <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center shrink-0 border border-slate-100">
            <Sparkles className="text-brand-primary" size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-2 flex items-center gap-2">
              <Zap size={12} className="text-brand-primary" />
              {t('dashboard.ai_assistant')}
            </p>
            <p className="text-slate-700 leading-relaxed font-medium text-sm">{aiResponse}</p>
            <button onClick={() => setAiResponse(null)} className="text-[10px] text-brand-primary font-bold uppercase tracking-wider mt-4 hover:text-brand-primary-dark transition-colors">
              {t('dashboard.close')} [ESC]
            </button>
          </div>
        </motion.div>
      )}

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title={t('dashboard.net_profit')} 
          value={formatMoney(stats?.netProfit || 0)} 
          subtitle={t('dashboard.after_returns')}
          icon={TrendingUp} 
          trend={12.4}
          colorClass="from-emerald-500 to-emerald-600 text-emerald-500"
        />
        <StatCard 
          title={t('dashboard.total_invoices')} 
          value={stats?.totalInvoices || 0} 
          subtitle="عدد المستندات المصدرة"
          icon={FileText} 
          colorClass="from-blue-500 to-blue-600 text-blue-500"
        />
        <StatCard 
          title={t('dashboard.receipt_vouchers')} 
          value={formatMoney(stats?.totalReceipts || 0)} 
          subtitle="إجمالي سندات القبض"
          icon={ReceiptIcon} 
          colorClass="from-amber-500 to-amber-600 text-amber-500"
        />
        <StatCard 
          title={t('dashboard.total_expenses')} 
          value={formatMoney(stats?.totalExpenses || 0)} 
          subtitle="التكاليف والمصروفات"
          icon={Zap} 
          trend={-2.1}
          colorClass="from-rose-500 to-rose-600 text-rose-500"
        />
      </div>

      {/* Major Analytics Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div 
              whileHover={{ scale: 1.01 }}
              className="bg-brand-primary p-6 rounded-3xl text-white relative overflow-hidden group shadow-lg h-[220px] flex flex-col justify-between"
            >
              <div className="absolute top-0 right-0 p-8 opacity-5 scale-150 group-hover:scale-[1.7] transition-transform duration-1000 rotate-12">
                <Wallet size={120} />
              </div>
              <div className="relative z-10">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-4">
                  <Wallet className="text-white" size={20} />
                </div>
                <p className="text-white/60 text-[10px] font-bold uppercase tracking-wider mb-2">رصيد النقدية</p>
                <h3 className="text-2xl md:text-3xl font-bold tracking-tight">
                  {formatMoney(stats?.totalCashBalance || 0)} 
                </h3>
              </div>
              <div className="flex items-center gap-2 text-white text-[9px] font-bold uppercase tracking-wider relative z-10 bg-white/10 self-start px-3 py-1.5 rounded-full border border-white/20">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                سيولة نقدية
              </div>
            </motion.div>

            <motion.div 
              whileHover={{ scale: 1.01 }}
              className="bg-slate-900 p-6 rounded-3xl text-white relative overflow-hidden group shadow-xl h-[220px] flex flex-col justify-between"
            >
              <div className="absolute top-0 right-0 p-8 opacity-5 scale-150 group-hover:scale-[1.7] transition-transform duration-1000 rotate-12">
                <UsersIcon size={120} />
              </div>
              <div className="relative z-10">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center mb-4">
                  <TrendingUp className="text-emerald-400" size={20} />
                </div>
                <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-2">{t('dashboard.customer_balances')}</p>
                <h3 className="text-2xl md:text-3xl font-bold tracking-tight">
                  {formatMoney(stats?.totalCustomerBalances || 0)} 
                </h3>
              </div>
              <div className="flex items-center gap-2 text-emerald-400 text-[9px] font-bold uppercase tracking-wider relative z-10 bg-emerald-400/10 self-start px-3 py-1.5 rounded-full border border-emerald-400/20">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {t('dashboard.active_receivables')}
              </div>
            </motion.div>

            <motion.div 
              whileHover={{ scale: 1.01 }}
              className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group h-[220px] flex flex-col justify-between"
            >
              <div className="absolute top-0 right-0 p-8 opacity-[0.02] scale-150 group-hover:scale-[1.7] transition-transform duration-1000 -rotate-12">
                <ReceiptIcon size={120} />
              </div>
              <div className="relative z-10">
                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center mb-4 border border-slate-100">
                  <ReceiptIcon className="text-slate-400" size={20} />
                </div>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">{t('dashboard.supplier_balances')}</p>
                <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
                  {formatMoney(stats?.totalSupplierBalances || 0)} 
                </h3>
              </div>
              <div className="flex items-center gap-2 text-rose-500 text-[9px] font-bold uppercase tracking-wider relative z-10 bg-rose-50 self-start px-3 py-1.5 rounded-full border border-rose-100">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                {t('dashboard.outstanding_debts')}
              </div>
            </motion.div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h4 className="text-lg font-bold text-slate-900 tracking-tight">{t('dashboard.sales_performance')}</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Monthly Analytics Breakdown</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-brand-primary" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Net Revenue</span>
              </div>
            </div>
            <div className="w-full h-[300px]">
              {activeTabId === 'dashboard' && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats?.salesByMonth} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="premiumGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 600}} 
                      dy={10} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 600}} 
                    />
                    <Tooltip 
                      contentStyle={{
                        borderRadius: '12px', 
                        border: '1px solid #e2e8f0', 
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                        backgroundColor: '#fff',
                        fontSize: '12px'
                      }}
                      itemStyle={{ color: '#10b981', fontWeight: 600 }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="total" 
                      stroke="#10b981" 
                      strokeWidth={3} 
                      fillOpacity={1} 
                      fill="url(#premiumGradient)" 
                      animationDuration={1500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h4 className="text-lg font-bold text-slate-900 tracking-tight">{t('dashboard.recent_transactions')}</h4>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Live Feed</p>
            </div>
            <button className="p-2 hover:bg-slate-50 rounded-lg transition-all text-slate-400">
              <ArrowUpRight size={18} />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-1 h-[550px]">
            {stats?.recentTransactions.map((tx, idx) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                key={`${tx.type}-${tx.id}`} 
                className={`group flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all cursor-pointer ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm ${
                    tx.type === 'invoice' || tx.type === 'receipt' ? 'bg-emerald-50 text-emerald-600' : 
                    tx.type === 'return' || tx.type === 'payment' ? 'bg-rose-50 text-rose-600' : 
                    'bg-slate-50 text-slate-600'
                  }`}>
                    {tx.type === 'invoice' || tx.type === 'receipt' ? <TrendingUp size={20} /> : 
                     tx.type === 'return' || tx.type === 'payment' ? <TrendingUp size={20} className="rotate-180" /> :
                     <FileText size={20} />}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm tracking-tight">{tx.customer_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        tx.type === 'invoice' ? 'bg-emerald-100 text-emerald-700' : 
                        tx.type === 'return' ? 'bg-rose-100 text-rose-700' : 
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {tx.type === 'invoice' ? t('dashboard.invoice') : 
                         tx.type === 'return' ? t('dashboard.return') : 
                         tx.type === 'receipt' ? t('dashboard.receipt') : 
                         tx.type === 'payment' ? t('dashboard.payment') : 
                         t('dashboard.manual_journal')}
                      </span>
                      <span className="text-[9px] text-slate-400 font-bold font-mono">#{tx.number}</span>
                    </div>
                  </div>
                </div>
                <div className={`text-right ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>
                  <p className={`font-bold text-sm tracking-tight ${tx.type === 'invoice' || tx.type === 'receipt' ? 'text-slate-900' : 'text-rose-600'}`}>
                    {tx.type === 'invoice' || tx.type === 'receipt' ? '' : '-'}{formatMoney(tx.total_amount || 0)}
                  </p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">{formatDate(tx.date)}</p>
                </div>
              </motion.div>
            ))}
            {!stats?.recentTransactions.length && (
              <div className="flex flex-col items-center justify-center py-20 opacity-20">
                <FileText size={40} className="mb-4 text-slate-400" />
                <p className="font-bold uppercase tracking-wider text-[10px] text-slate-400">{t('dashboard.no_recent')}</p>
              </div>
            )}
          </div>

          <button className="w-full mt-4 py-3 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-xl font-bold uppercase tracking-wider text-[10px] transition-all">
            {t('dashboard.view_all')}
          </button>
        </div>
      </div>
    </motion.div>
  );
};
