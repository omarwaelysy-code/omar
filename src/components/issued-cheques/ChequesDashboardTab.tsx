import React from 'react';
import { 
  DollarSign, Clock, AlertTriangle, CheckCircle2, RotateCcw, Ban, 
  TrendingUp, Calendar, ArrowUpRight, Plus, Eye, Check, RefreshCw 
} from 'lucide-react';
import { IssuedCheque, IssuedChequeStats } from '../../types';

interface ChequesDashboardTabProps {
  stats: IssuedChequeStats | null;
  upcomingCheques: IssuedCheque[];
  loading: boolean;
  onRefresh: () => void;
  onCreateNew: () => void;
  onViewCheque: (cheque: IssuedCheque) => void;
  onPayCheque: (cheque: IssuedCheque) => void;
}

export const ChequesDashboardTab: React.FC<ChequesDashboardTabProps> = ({
  stats,
  upcomingCheques,
  loading,
  onRefresh,
  onCreateNew,
  onViewCheque,
  onPayCheque
}) => {
  const formatMoney = (val?: number) => {
    return Number(val || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const kpis = [
    {
      title: 'إجمالي الشيكات',
      amount: stats?.totalAmount || 0,
      count: stats?.totalCount || 0,
      icon: DollarSign,
      color: 'from-blue-600 to-indigo-600',
      bgLight: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400',
      badge: 'الكل'
    },
    {
      title: 'مستحقة خلال 7 أيام',
      amount: stats?.dueWithin7DaysAmount || 0,
      count: stats?.dueWithin7DaysCount || 0,
      icon: Clock,
      color: 'from-amber-500 to-orange-600',
      bgLight: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400',
      badge: 'عاجل'
    },
    {
      title: 'مستحقة خلال 30 يوماً',
      amount: stats?.dueWithin30DaysAmount || 0,
      count: stats?.dueWithin30DaysCount || 0,
      icon: Calendar,
      color: 'from-teal-600 to-emerald-600',
      bgLight: 'bg-teal-50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400',
      badge: 'الشهر الحالي'
    },
    {
      title: 'شيكات متأخرة الصرف',
      amount: stats?.overdueAmount || 0,
      count: stats?.overdueCount || 0,
      icon: AlertTriangle,
      color: 'from-rose-600 to-red-700',
      bgLight: 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400',
      badge: 'تنبيه'
    },
    {
      title: 'الالتزامات المستقبلية',
      amount: stats?.futureObligationsAmount || 0,
      count: stats?.futureObligationsCount || 0,
      icon: TrendingUp,
      color: 'from-violet-600 to-purple-700',
      bgLight: 'bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400',
      badge: 'قائم برسم الدفع'
    },
    {
      title: 'شيكات تم صرفها',
      amount: stats?.paidAmount || 0,
      count: stats?.paidCount || 0,
      icon: CheckCircle2,
      color: 'from-emerald-600 to-teal-700',
      bgLight: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400',
      badge: 'مسدد'
    },
    {
      title: 'شيكات مرتدة',
      amount: stats?.returnedAmount || 0,
      count: stats?.returnedCount || 0,
      icon: RotateCcw,
      color: 'from-amber-600 to-rose-600',
      bgLight: 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400',
      badge: 'مرتجع'
    },
    {
      title: 'شيكات ملغاة',
      amount: stats?.cancelledAmount || 0,
      count: stats?.cancelledCount || 0,
      icon: Ban,
      color: 'from-slate-600 to-gray-700',
      bgLight: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
      badge: 'ملغى'
    }
  ];

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Quick Actions */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <span>لوحة تحكم الشيكات الصادرة</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 font-medium">
              مباشر ومحدث
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            متابعة السيولة النقدية، الالتزامات البنكية، وتواريخ استحقاق الشيكات المحررة للموردين
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onCreateNew}
            className="flex-1 md:flex-none px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>تحرير شيك صادر جديد</span>
          </button>
        </div>
      </div>

      {/* 8 KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{kpi.title}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${kpi.bgLight}`}>
                  {kpi.badge}
                </span>
              </div>

              <div className="mt-3 flex items-baseline justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                    {formatMoney(kpi.amount)}
                  </h3>
                  <span className="text-[11px] text-slate-400 font-medium">ج.م ({kpi.count} شيك)</span>
                </div>
                <div className={`w-10 h-10 rounded-2xl ${kpi.bgLight} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Upcoming & Urgent Cheques Table */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                أقرب الشيكات استحقاقاً (واجبة المتابعة والصرف)
              </h3>
              <p className="text-xs text-slate-400">
                الشيكات القائمة المستحقة خلال الفترة الحالية والمتأخرة
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-slate-500 font-mono">
            {upcomingCheques.length} شيك
          </span>
        </div>

        {upcomingCheques.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500/40 mb-2" />
            <p className="text-sm font-medium">لا توجد شيكات مستحقة الصرف حالياً</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">رقم الشيك</th>
                  <th className="px-6 py-3.5">المورد المستفيد</th>
                  <th className="px-6 py-3.5">الحساب البنكي</th>
                  <th className="px-6 py-3.5">المبلغ</th>
                  <th className="px-6 py-3.5">تاريخ الاستحقاق</th>
                  <th className="px-6 py-3.5">الحالة</th>
                  <th className="px-6 py-3.5 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {upcomingCheques.map(cheque => {
                  const isOverdue = cheque.due_date && new Date(cheque.due_date) < new Date();
                  return (
                    <tr key={cheque.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-3.5 font-mono font-bold text-slate-900 dark:text-white">
                        {cheque.cheque_number}
                      </td>
                      <td className="px-6 py-3.5 font-medium text-slate-800 dark:text-slate-200">
                        {cheque.supplier_name || cheque.payee_name || '-'}
                      </td>
                      <td className="px-6 py-3.5 text-slate-600 dark:text-slate-400">
                        {cheque.bank_name || '-'}
                      </td>
                      <td className="px-6 py-3.5 font-mono font-black text-emerald-600 dark:text-emerald-400">
                        {formatMoney(cheque.amount)} ج.م
                      </td>
                      <td className="px-6 py-3.5 font-mono">
                        <span className={isOverdue ? 'text-rose-600 font-bold' : 'text-slate-600 dark:text-slate-400'}>
                          {String(cheque.due_date).slice(0, 10)}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        {isOverdue ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                            متأخر الصرف
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                            قائم برسم الدفع
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onPayCheque(cheque)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] flex items-center gap-1 transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                            صرف
                          </button>
                          <button
                            onClick={() => onViewCheque(cheque)}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="عرض التفاصيل"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
