import React from 'react';
import { 
  DollarSign, Clock, AlertTriangle, CheckCircle2, RotateCcw, Ban, 
  TrendingUp, Calendar, Plus, Eye, Check, RefreshCw, ArrowDownLeft 
} from 'lucide-react';
import { ReceivedCheque, ReceivedChequeStats } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';

interface ReceivedChequesDashboardTabProps {
  stats: ReceivedChequeStats | null;
  upcomingCheques: ReceivedCheque[];
  loading: boolean;
  onRefresh: () => void;
  onReceiveCustomer: () => void;
  onReceiveOther: () => void;
  onViewCheque: (cheque: ReceivedCheque) => void;
  onCollectCheque: (cheque: ReceivedCheque) => void;
}

export const ReceivedChequesDashboardTab: React.FC<ReceivedChequesDashboardTabProps> = ({
  stats,
  upcomingCheques,
  loading,
  onRefresh,
  onReceiveCustomer,
  onReceiveOther,
  onViewCheque,
  onCollectCheque
}) => {
  const { language, dir } = useLanguage();
  const isAr = language === 'ar';

  const formatMoney = (val?: number) => {
    return Number(val || 0).toLocaleString(isAr ? 'ar-EG' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const currencyLabel = isAr ? 'ج.م' : 'EGP';

  const kpis = [
    {
      title: isAr ? 'إجمالي الشيكات الواردة' : 'Total Received Cheques',
      amount: stats?.totalAmount || 0,
      count: stats?.totalCount || 0,
      icon: DollarSign,
      color: 'from-blue-600 to-indigo-600',
      bgLight: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400',
      badge: isAr ? 'الكل' : 'All'
    },
    {
      title: isAr ? 'مستحقة خلال 7 أيام' : 'Due within 7 Days',
      amount: stats?.dueWithin7DaysAmount || 0,
      count: stats?.dueWithin7DaysCount || 0,
      icon: Clock,
      color: 'from-amber-500 to-orange-600',
      bgLight: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400',
      badge: isAr ? 'عاجل' : 'Urgent'
    },
    {
      title: isAr ? 'مستحقة خلال 30 يوماً' : 'Due within 30 Days',
      amount: stats?.dueWithin30DaysAmount || 0,
      count: stats?.dueWithin30DaysCount || 0,
      icon: Calendar,
      color: 'from-teal-600 to-emerald-600',
      bgLight: 'bg-teal-50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400',
      badge: isAr ? 'الشهر الحالي' : 'This Month'
    },
    {
      title: isAr ? 'شيكات متأخرة التحصيل' : 'Overdue for Collection',
      amount: stats?.overdueAmount || 0,
      count: stats?.overdueCount || 0,
      icon: AlertTriangle,
      color: 'from-rose-600 to-red-700',
      bgLight: 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400',
      badge: isAr ? 'تنبيه' : 'Alert'
    },
    {
      title: isAr ? 'مستحقات مستقبلية برسم التحصيل' : 'Future Collections',
      amount: stats?.futureCollectionsAmount || 0,
      count: stats?.futureCollectionsCount || 0,
      icon: TrendingUp,
      color: 'from-violet-600 to-purple-700',
      bgLight: 'bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400',
      badge: isAr ? 'في الحافظة' : 'In Portfolio'
    },
    {
      title: isAr ? 'شيكات تم تحصيلها' : 'Collected Cheques',
      amount: stats?.collectedAmount || 0,
      count: stats?.collectedCount || 0,
      icon: CheckCircle2,
      color: 'from-emerald-600 to-teal-700',
      bgLight: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400',
      badge: isAr ? 'محصل' : 'Collected'
    },
    {
      title: isAr ? 'شيكات مرتدة' : 'Returned Cheques',
      amount: stats?.returnedAmount || 0,
      count: stats?.returnedCount || 0,
      icon: RotateCcw,
      color: 'from-amber-600 to-rose-600',
      bgLight: 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400',
      badge: isAr ? 'مرتجع' : 'Returned'
    },
    {
      title: isAr ? 'شيكات ملغاة' : 'Cancelled Cheques',
      amount: stats?.cancelledAmount || 0,
      count: stats?.cancelledCount || 0,
      icon: Ban,
      color: 'from-slate-600 to-gray-700',
      bgLight: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
      badge: isAr ? 'ملغى' : 'Cancelled'
    }
  ];

  return (
    <div className="space-y-6" dir={dir}>
      
      {/* Top Banner & Quick Actions */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <span>{isAr ? 'لوحة تحكم الشيكات الواردة (أوراق القبض)' : 'Received Cheques Dashboard'}</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 font-medium">
              {isAr ? 'مباشر ومحدث' : 'Live & Synced'}
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isAr 
              ? 'متابعة أوراق القبض، التدفقات النقدية المتوقعة، وتواريخ تحصيل وإيداع شيكات العملاء بالبنوك'
              : 'Monitor notes receivable, incoming cash flow, and cheque collection due dates'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
            title={isAr ? 'تحديث البيانات' : 'Refresh Data'}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onReceiveOther}
            className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isAr ? 'استلام شيك آخر' : 'Receive Other Cheque'}</span>
          </button>
          <button
            onClick={onReceiveCustomer}
            className="px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>{isAr ? 'استلام شيكات عميل' : 'Receive Customer Cheques'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div 
              key={idx}
              className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{kpi.title}</span>
                <div className={`p-2 rounded-xl ${kpi.bgLight}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-black font-mono text-slate-900 dark:text-white">
                    {formatMoney(kpi.amount)}
                  </span>
                  <span className="text-xs font-bold text-slate-400">{currencyLabel}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
                  <span>{isAr ? 'عدد الشيكات:' : 'Cheques Count:'}</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{kpi.count}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Upcoming / Overdue Cheques Section */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isAr ? 'الشيكات الواردة المستحقة للتحصيل قريباً (خلال 30 يوماً)' : 'Received Cheques Due for Collection (Next 30 Days)'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isAr ? 'الشيكات ذات الأولوية لتحصيلها أو إيداعها في الحساب البنكي' : 'Priority cheques ready for bank collection or deposit'}
              </p>
            </div>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {upcomingCheques.length} {isAr ? 'شيك' : 'cheques'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-50/75 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">{isAr ? 'رقم الشيك' : 'Cheque #'}</th>
                <th className="px-4 py-3">{isAr ? 'العميل / الساحب' : 'Customer / Payer'}</th>
                <th className="px-4 py-3">{isAr ? 'البنك المسحوب عليه' : 'Drawee Bank'}</th>
                <th className="px-4 py-3">{isAr ? 'تاريخ الاستحقاق' : 'Due Date'}</th>
                <th className="px-4 py-3 text-left">{isAr ? 'المبلغ' : 'Amount'}</th>
                <th className="px-4 py-3 text-center">{isAr ? 'الحالة' : 'Status'}</th>
                <th className="px-4 py-3 text-center">{isAr ? 'إجراءات سريعة' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {upcomingCheques.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-xs">
                    {isAr ? 'لا توجد شيكات واردة مستحقة التحصيل خلال الـ 30 يوماً القادمة.' : 'No received cheques due for collection within the next 30 days.'}
                  </td>
                </tr>
              ) : (
                upcomingCheques.map(cheque => {
                  const isOverdue = cheque.due_date && new Date(cheque.due_date) < new Date();
                  return (
                    <tr key={cheque.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {cheque.cheque_number}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                        {cheque.customer_name || cheque.payer_name || '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {cheque.drawee_bank || '-'}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        <span className={isOverdue ? 'text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1' : 'text-slate-600 dark:text-slate-300'}>
                          {isOverdue && <AlertTriangle className="w-3 h-3 text-rose-500 inline" />}
                          {String(cheque.due_date).slice(0, 10)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-left font-mono font-bold text-slate-900 dark:text-white">
                        {formatMoney(cheque.amount)} {cheque.currency || currencyLabel}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                          isOverdue 
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400' 
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                        }`}>
                          {isOverdue ? (isAr ? 'متأخر التحصيل' : 'Overdue') : (isAr ? 'مستحق قريباً' : 'Due Soon')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onViewCheque(cheque)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title={isAr ? 'عرض التفاصيل' : 'View Details'}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onCollectCheque(cheque)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-xs flex items-center gap-1 transition-colors cursor-pointer"
                            title={isAr ? 'تحصيل وإيداع' : 'Collect & Deposit'}
                          >
                            <Check className="w-3 h-3" />
                            <span>{isAr ? 'تحصيل' : 'Collect'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
