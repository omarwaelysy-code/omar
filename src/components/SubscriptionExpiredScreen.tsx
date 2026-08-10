import React from 'react';
import { LogOut, ArrowRight, Building2, Calendar, Lock, ShieldAlert } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const SubscriptionExpiredScreen: React.FC = () => {
  const { logout, user, isSuperAdmin, isSuperAdminAccount, subscriptionExpiredDetails, setWorkspaceMode } = useAuth();

  const companyName = subscriptionExpiredDetails?.companyName || user?.company_name || user?.company_id || 'الشركة';
  const expiryDate = subscriptionExpiredDetails?.expiryDate || '';

  return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-stone-800 border border-stone-700/80 rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6 text-center text-white relative overflow-hidden">
        
        {/* Top Glow Background Effect */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Icon Header */}
        <div className="w-20 h-20 bg-amber-500/10 border border-amber-500/30 rounded-3xl flex items-center justify-center mx-auto text-amber-500 shadow-inner">
          <Lock className="w-10 h-10 text-amber-400" />
        </div>

        {/* Title & Warning */}
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-stone-100">عفواً، لا يمكن فتح الشركة</h2>
          <p className="text-stone-300 text-sm leading-relaxed">
            لقد انتهت فترة اشتراك شركة <strong className="text-amber-400 font-bold">"{companyName}"</strong>. تم إغلاق الوصول إلى النظام ولا يمكن تصفح أو إدخال البيانات لهذه الشركة حتى يتم تجديد الاشتراك.
          </p>
        </div>

        {/* Details Card */}
        <div className="bg-stone-900/80 border border-stone-700/50 rounded-2xl p-4 space-y-3 text-sm text-stone-300">
          <div className="flex items-center justify-between">
            <span className="text-stone-400 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-stone-500" /> اسم الشركة:
            </span>
            <span className="font-bold text-white">{companyName}</span>
          </div>
          <div className="flex items-center justify-between border-t border-stone-800 pt-2">
            <span className="text-stone-400 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-stone-500" /> تاريخ انتهاء الاشتراك:
            </span>
            <span className="font-mono font-bold text-amber-400">{expiryDate || 'منتهي'}</span>
          </div>
          <div className="flex items-center justify-between border-t border-stone-800 pt-2">
            <span className="text-stone-400 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-stone-500" /> حالة الوصول:
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-400 text-xs font-bold border border-red-500/20">
              مغلق / اشتراك منتهي
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          {(isSuperAdmin || isSuperAdminAccount) && (
            <button
              onClick={() => {
                if (setWorkspaceMode) setWorkspaceMode('super_admin');
                window.location.href = '/super-admin@m@r2020';
              }}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowRight className="w-5 h-5" />
              <span>العودة لإدارة النظام وتجديد الاشتراك</span>
            </button>
          )}

          <button
            onClick={logout}
            className="w-full py-3.5 bg-stone-700/70 hover:bg-stone-700 text-stone-200 font-bold rounded-2xl transition-all border border-stone-600/50 flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-5 h-5 text-red-400" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </div>
    </div>
  );
};
