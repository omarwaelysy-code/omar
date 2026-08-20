import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Laptop, 
  Radio, 
  RefreshCw, 
  Search, 
  Clock, 
  MapPin, 
  Copy, 
  Check, 
  ExternalLink,
  Plus,
  Building2,
  Wifi,
  WifiOff,
  AlertCircle,
  Coffee
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useNavigation } from '../contexts/NavigationContext';
import { dbService, apiRequest } from '../services/dbService';
import { PosConnectedBranch, Company } from '../types';

export function PosConnectedBranches() {
  const { t, dir, language } = useLanguage();
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const { openTab } = useNavigation();

  const [company, setCompany] = useState<Company | null>(null);
  const isPosEnabled = company?.pos_enabled === true || company?.settings?.pos_enabled === true;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [branches, setBranches] = useState<PosConnectedBranch[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchConnectedBranches = async (isManual = false) => {
    if (!user?.company_id) {
      setLoading(false);
      return;
    }

    try {
      if (isManual) setRefreshing(true);

      const [compData, branchData] = await Promise.all([
        company ? Promise.resolve(company) : dbService.get<Company>('companies', user.company_id),
        apiRequest<PosConnectedBranch[]>('/pos/connected-branches', 'GET')
      ]);

      if (!company && compData) {
        setCompany(compData);
      }
      setBranches(branchData || []);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Error fetching connected POS branches:', err);
      if (isManual) {
        showNotification(err.message || 'فشل في تحديث قائمة الفروع المتصلة', 'error');
      }
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchConnectedBranches();

    // Polling interval every 15 seconds to update real-time connection status
    const interval = setInterval(() => {
      fetchConnectedBranches(false);
    }, 15000);

    return () => clearInterval(interval);
  }, [user?.company_id]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    showNotification(language === 'ar' ? 'تم نسخ رمز الربط إلى الحافظة' : 'Linking code copied to clipboard', 'success');
    setTimeout(() => setCopiedCode(null), 2500);
  };

  // Relative time helper in Arabic
  const formatTimeAgo = (dateStr?: string | null): string => {
    if (!dateStr) return language === 'ar' ? 'لم يتصل بعد' : 'Never connected';
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 15) return language === 'ar' ? 'متصل الآن' : 'Just now';
    if (diffSec < 60) return language === 'ar' ? `منذ ${diffSec} ثانية` : `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return language === 'ar' ? `منذ ${diffMin} دقيقة` : `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return language === 'ar' ? `منذ ${diffHours} ساعة` : `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return language === 'ar' ? `منذ ${diffDays} يوم` : `${diffDays}d ago`;
  };

  const formatFullDate = (dateStr?: string | null): string => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Stats calculation
  const totalBranches = branches.length;
  const onlineBranches = branches.filter(b => b.is_online).length;
  const offlineBranches = totalBranches - onlineBranches;

  // Filtered branches
  const filteredBranches = branches.filter(branch => {
    const matchesSearch = 
      (branch.branch_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (branch.department_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (branch.code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (branch.branch_address || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = 
      statusFilter === 'all' ? true :
      statusFilter === 'online' ? branch.is_online :
      !branch.is_online;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-full bg-slate-50/70 p-6 md:p-8 space-y-6" dir={dir}>
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-600 shadow-sm flex-shrink-0">
              <Laptop className="w-7 h-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {language === 'ar' ? 'نقاط البيع - الفروع المتصلة' : 'POS - Connected Branches'}
                </h1>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  {language === 'ar' ? 'متابعة حية' : 'Live Heartbeat'}
                </span>
              </div>
              <p className="text-slate-500 text-sm mt-1">
                {language === 'ar' 
                  ? 'متابعة حالة اتصال فروع Cafe POS بنظام Obrain ERP لحظيًا.' 
                  : 'Monitor real-time connection status of Cafe POS branches linked with Obrain ERP.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => fetchConnectedBranches(true)}
              disabled={refreshing}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium transition-all shadow-sm active:scale-95 disabled:opacity-50 text-sm"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 text-slate-600 ${refreshing ? 'animate-spin text-emerald-600' : ''}`} />
              <span>{language === 'ar' ? 'تحديث الآن' : 'Refresh'}</span>
            </button>

            <button
              onClick={() => openTab('pos_branch_linking', language === 'ar' ? 'ربط الفرع' : 'Branch Linking')}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-all active:scale-95 text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>{language === 'ar' ? 'ربط فرع جديد' : 'Link New Branch'}</span>
            </button>
          </div>
        </div>

        {/* POS Inactive Warning (if not enabled) */}
        {!isPosEnabled && !loading && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div>
                <p className="text-amber-900 font-semibold text-sm">
                  {language === 'ar' ? 'نظام نقاط البيع (POS) غير مفعل' : 'POS System is currently disabled'}
                </p>
                <p className="text-amber-700 text-xs mt-0.5">
                  {language === 'ar' 
                    ? 'يمكنك تفعيل ميزة نقاط البيع من صفحة إعدادات الشركة لبدء استقبال اتصال الفروع.' 
                    : 'Enable POS feature from Company Settings to start receiving branch connections.'}
                </p>
              </div>
            </div>
            <button
              onClick={() => openTab('company_settings', language === 'ar' ? 'إعدادات الشركة' : 'Company Settings')}
              className="px-3.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl text-xs font-semibold border border-amber-300 transition-all flex items-center gap-1.5"
            >
              <span>{language === 'ar' ? 'إعدادات الشركة' : 'Settings'}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Total Branches */}
          <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm hover:border-slate-300 transition-all">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  {language === 'ar' ? 'إجمالي الفروع المربوطة' : 'Total Linked Branches'}
                </p>
                <h3 className="text-3xl font-bold text-slate-900 mt-2 font-mono">{totalBranches}</h3>
                <p className="text-xs text-slate-400 mt-1">
                  {language === 'ar' ? 'فروع مسجلة بالنظام' : 'Registered branches'}
                </p>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-2xl text-blue-600">
                <Building2 className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Online Branches */}
          <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm hover:border-emerald-200 transition-all">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-emerald-700 text-xs font-semibold uppercase tracking-wider">
                  {language === 'ar' ? 'متصل الآن' : 'Online Branches'}
                </p>
                <div className="flex items-baseline gap-2 mt-2">
                  <h3 className="text-3xl font-bold text-emerald-600 font-mono">{onlineBranches}</h3>
                  <span className="text-xs text-emerald-700 font-medium">
                    ({totalBranches > 0 ? Math.round((onlineBranches / totalBranches) * 100) : 0}%)
                  </span>
                </div>
                <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  {language === 'ar' ? 'Heartbeat نشط خلال 3 دقائق' : 'Active heartbeat < 3m'}
                </p>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-600">
                <Wifi className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Offline Branches */}
          <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm hover:border-rose-200 transition-all">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-rose-700 text-xs font-semibold uppercase tracking-wider">
                  {language === 'ar' ? 'غير متصل' : 'Offline Branches'}
                </p>
                <h3 className="text-3xl font-bold text-rose-600 mt-2 font-mono">{offlineBranches}</h3>
                <p className="text-xs text-slate-400 mt-1">
                  {language === 'ar' ? 'في انتظار وصول Heartbeat' : 'No recent heartbeat'}
                </p>
              </div>
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600">
                <WifiOff className="w-6 h-6" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Table Section */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          {/* Filters & Search Header */}
          <div className="p-4 md:p-5 border-b border-slate-100 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-white">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y/1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={language === 'ar' ? 'ابحث باسم الفرع أو كود الربط أو العنوان...' : 'Search by branch name, code, or address...'}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  statusFilter === 'all' 
                    ? 'bg-slate-900 text-white shadow-sm' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {language === 'ar' ? 'الكل' : 'All'} ({totalBranches})
              </button>
              <button
                onClick={() => setStatusFilter('online')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  statusFilter === 'online' 
                    ? 'bg-emerald-600 text-white shadow-sm' 
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                {language === 'ar' ? 'متصل الآن' : 'Online'} ({onlineBranches})
              </button>
              <button
                onClick={() => setStatusFilter('offline')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  statusFilter === 'offline' 
                    ? 'bg-rose-600 text-white shadow-sm' 
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                {language === 'ar' ? 'غير متصل' : 'Offline'} ({offlineBranches})
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50/80 text-slate-600 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">{language === 'ar' ? 'اسم الفرع' : 'Branch Name'}</th>
                  <th className="px-6 py-3.5">{language === 'ar' ? 'كود ربط الفرع' : 'Branch Linking Code'}</th>
                  <th className="px-6 py-3.5">{language === 'ar' ? 'حالة الاتصال' : 'Connection Status'}</th>
                  <th className="px-6 py-3.5">{language === 'ar' ? 'آخر اتصال' : 'Last Connection'}</th>
                  <th className="px-6 py-3.5">{language === 'ar' ? 'عنوان الفرع' : 'Branch Address'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-16">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="w-7 h-7 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-slate-400 text-xs">{language === 'ar' ? 'جاري تحميل الفروع المتصلة...' : 'Loading connected branches...'}</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredBranches.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-16">
                      <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                        <div className="p-4 bg-slate-50 rounded-2xl text-slate-400 border border-slate-200">
                          <Laptop className="w-8 h-8 stroke-[1.5]" />
                        </div>
                        <p className="font-semibold text-slate-700 text-base">
                          {searchQuery 
                            ? (language === 'ar' ? 'لا توجد نتائج تطابق معايير البحث' : 'No branches match your search')
                            : (language === 'ar' ? 'لا توجد فروع متصلة بعد' : 'No connected branches yet')}
                        </p>
                        <p className="text-xs text-slate-400 max-w-md">
                          {language === 'ar' 
                            ? 'قم بتوليد رمز ربط من شاشة "ربط الفرع" وإدخاله في إعدادات Cafe POS للبدء في ربط ومتابعة الفروع.' 
                            : 'Generate a linking code from "Branch Linking" and enter it in Cafe POS settings.'}
                        </p>
                        <button
                          onClick={() => openTab('pos_branch_linking', language === 'ar' ? 'ربط الفرع' : 'Branch Linking')}
                          className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{language === 'ar' ? 'ربط فرع جديد' : 'Link New Branch'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredBranches.map((branch) => (
                    <tr 
                      key={branch.id} 
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* 1. Branch Name */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-slate-100 text-slate-700 border border-slate-200/60 rounded-xl flex-shrink-0">
                            <Coffee className="w-4 h-4 text-emerald-600" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors">
                              {branch.branch_name || branch.department_name || 'كافيه مودرنو'}
                            </div>
                            <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                              {branch.department_name && (
                                <span>{branch.department_name}</span>
                              )}
                              {branch.pos_version && (
                                <span className="px-1.5 py-0.2 bg-slate-100 text-slate-500 rounded text-[10px] font-mono border border-slate-200">
                                  v{branch.pos_version}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Branch Linking Code */}
                      <td className="px-6 py-4">
                        <div className="inline-flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 font-mono text-xs text-emerald-700 font-medium">
                          <span>{branch.code}</span>
                          <button
                            onClick={() => handleCopyCode(branch.code)}
                            className="text-slate-400 hover:text-slate-600 transition-colors"
                            title="نسخ الرمز"
                          >
                            {copiedCode === branch.code ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* 3. Connection Status */}
                      <td className="px-6 py-4">
                        {branch.is_online ? (
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>{language === 'ar' ? '🟢 متصل الآن' : '🟢 Online'}</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                            <span>{language === 'ar' ? '🔴 غير متصل' : '🔴 Offline'}</span>
                          </div>
                        )}
                      </td>

                      {/* 4. Last Connection */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className={`text-xs font-medium ${branch.is_online ? 'text-emerald-700' : 'text-slate-700'}`}>
                            {formatTimeAgo(branch.last_seen_at)}
                          </span>
                          <span className="text-[11px] text-slate-400 mt-0.5 font-mono">
                            {formatFullDate(branch.last_seen_at)}
                          </span>
                        </div>
                      </td>

                      {/* 5. Branch Address */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="truncate max-w-xs" title={branch.branch_address || '—'}>
                            {branch.branch_address || '—'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Bar */}
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-slate-500">
            <div>
              {language === 'ar' 
                ? `عرض ${filteredBranches.length} من إجمالي ${totalBranches} فرع مربوط` 
                : `Showing ${filteredBranches.length} of ${totalBranches} linked branches`}
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              <span>
                {language === 'ar' 
                  ? `آخر تحديث للقائمة: ${lastUpdated.toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US')}` 
                  : `Last list update: ${lastUpdated.toLocaleTimeString()}`}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default PosConnectedBranches;
