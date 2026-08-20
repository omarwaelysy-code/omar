import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Laptop, 
  Radio, 
  RefreshCw, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  MapPin, 
  Copy, 
  Check, 
  ExternalLink,
  Plus,
  Building2,
  Activity,
  Wifi,
  WifiOff,
  AlertCircle
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
    <div className="p-6 max-w-7xl mx-auto space-y-6" dir={dir}>
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-emerald-950/40 via-gray-900 to-gray-900 p-6 rounded-2xl border border-emerald-900/30 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <Laptop className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {language === 'ar' ? 'نقاط البيع - الفروع المتصلة' : 'POS - Connected Branches'}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                {language === 'ar' ? 'متابعة حية' : 'Live Heartbeat'}
              </span>
            </div>
            <p className="text-gray-400 text-sm mt-1">
              {language === 'ar' 
                ? 'مراقبة ومتابعة حالة اتصال فروع Cafe POS المربوطة بنظام Obrain ERP لحظياً.' 
                : 'Monitor real-time connection status of Cafe POS branches linked with Obrain ERP.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => fetchConnectedBranches(true)}
            disabled={refreshing}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700/60 font-medium transition-all shadow-sm active:scale-95 disabled:opacity-50"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
            <span>{language === 'ar' ? 'تحديث الآن' : 'Refresh'}</span>
          </button>

          <button
            onClick={() => openTab('pos_branch_linking', language === 'ar' ? 'ربط الفرع' : 'Branch Linking')}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium shadow-lg shadow-emerald-900/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'ar' ? 'ربط فرع جديد' : 'Link New Branch'}</span>
          </button>
        </div>
      </div>

      {/* POS Inactive Warning (if not enabled) */}
      {!isPosEnabled && !loading && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-amber-400 flex-shrink-0" />
            <div>
              <p className="text-amber-300 font-semibold text-sm">
                {language === 'ar' ? 'نظام نقاط البيع (POS) غير مفعل' : 'POS System is currently disabled'}
              </p>
              <p className="text-amber-200/70 text-xs mt-0.5">
                {language === 'ar' 
                  ? 'يمكنك تفعيل ميزة نقاط البيع من صفحة إعدادات الشركة لبدء استقبال اتصال الفروع.' 
                  : 'Enable POS feature from Company Settings to start receiving branch connections.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => openTab('company_settings', language === 'ar' ? 'إعدادات الشركة' : 'Company Settings')}
            className="px-3.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-xs font-semibold border border-amber-500/30 transition-all flex items-center gap-1.5"
          >
            <span>{language === 'ar' ? 'إعدادات الشركة' : 'Settings'}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Total Branches */}
        <div className="bg-gray-900/60 border border-gray-800 p-5 rounded-2xl relative overflow-hidden backdrop-blur-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
                {language === 'ar' ? 'إجمالي الفروع المربوطة' : 'Total Linked Branches'}
              </p>
              <h3 className="text-3xl font-bold text-white mt-2 font-mono">{totalBranches}</h3>
              <p className="text-xs text-gray-500 mt-1">
                {language === 'ar' ? 'فروع مسجلة بنجاح' : 'Registered branches'}
              </p>
            </div>
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
              <Building2 className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Online Branches */}
        <div className="bg-gradient-to-br from-emerald-950/30 to-gray-900/60 border border-emerald-900/30 p-5 rounded-2xl relative overflow-hidden backdrop-blur-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wider">
                {language === 'ar' ? 'الفروع المتصلة الآن' : 'Online Branches'}
              </p>
              <div className="flex items-baseline gap-2 mt-2">
                <h3 className="text-3xl font-bold text-emerald-400 font-mono">{onlineBranches}</h3>
                <span className="text-xs text-emerald-500/80 font-medium">
                  ({totalBranches > 0 ? Math.round((onlineBranches / totalBranches) * 100) : 0}%)
                </span>
              </div>
              <p className="text-xs text-emerald-400/60 mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                {language === 'ar' ? 'Heartbeat نشط خلال 3 دقائق' : 'Active heartbeat < 3m'}
              </p>
            </div>
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <Wifi className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Offline Branches */}
        <div className="bg-gray-900/60 border border-gray-800 p-5 rounded-2xl relative overflow-hidden backdrop-blur-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-rose-400 text-xs font-semibold uppercase tracking-wider">
                {language === 'ar' ? 'الفروع غير المتصلة' : 'Offline Branches'}
              </p>
              <h3 className="text-3xl font-bold text-rose-400 mt-2 font-mono">{offlineBranches}</h3>
              <p className="text-xs text-rose-400/60 mt-1">
                {language === 'ar' ? 'في انتظار وصول Heartbeat' : 'No recent heartbeat'}
              </p>
            </div>
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400">
              <WifiOff className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-gray-900/60 p-4 rounded-xl border border-gray-800">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y/1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={language === 'ar' ? 'البحث باسم الفرع أو كود الربط أو العنوان...' : 'Search by branch name, code, or address...'}
            className="w-full bg-gray-950/80 border border-gray-800 rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              statusFilter === 'all' 
                ? 'bg-emerald-500 text-gray-950 shadow-md shadow-emerald-500/20' 
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {language === 'ar' ? 'الكل' : 'All'} ({totalBranches})
          </button>
          <button
            onClick={() => setStatusFilter('online')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              statusFilter === 'online' 
                ? 'bg-emerald-500 text-gray-950 shadow-md shadow-emerald-500/20' 
                : 'bg-gray-800 text-gray-400 hover:text-emerald-400'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            {language === 'ar' ? 'متصل الآن' : 'Online'} ({onlineBranches})
          </button>
          <button
            onClick={() => setStatusFilter('offline')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              statusFilter === 'offline' 
                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20' 
                : 'bg-gray-800 text-gray-400 hover:text-rose-400'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
            {language === 'ar' ? 'غير متصل' : 'Offline'} ({offlineBranches})
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-gray-900/60 rounded-2xl border border-gray-800 overflow-hidden shadow-xl backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-gray-950/80 text-gray-400 text-xs font-semibold uppercase border-b border-gray-800">
              <tr>
                <th className="px-6 py-4">{language === 'ar' ? 'اسم الفرع' : 'Branch Name'}</th>
                <th className="px-6 py-4">{language === 'ar' ? 'كود ربط الفرع' : 'Branch Linking Code'}</th>
                <th className="px-6 py-4">{language === 'ar' ? 'حالة الاتصال' : 'Connection Status'}</th>
                <th className="px-6 py-4">{language === 'ar' ? 'آخر اتصال' : 'Last Connection'}</th>
                <th className="px-6 py-4">{language === 'ar' ? 'عنوان الفرع' : 'Branch Address'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-16">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-gray-400 text-xs">{language === 'ar' ? 'جاري تحميل الفروع المتصلة...' : 'Loading connected branches...'}</p>
                    </div>
                  </td>
                </tr>
              ) : filteredBranches.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-16">
                    <div className="flex flex-col items-center justify-center gap-3 text-gray-400">
                      <Radio className="w-12 h-12 text-gray-600 stroke-[1.5]" />
                      <p className="font-medium text-gray-300">
                        {searchQuery 
                          ? (language === 'ar' ? 'لا توجد نتائج تطابق معايير البحث' : 'No branches match your search')
                          : (language === 'ar' ? 'لا توجد فروع Cafe POS متصلة بعد' : 'No connected Cafe POS branches yet')}
                      </p>
                      <p className="text-xs text-gray-500 max-w-md">
                        {language === 'ar' 
                          ? 'قم بتوليد رمز ربط من شاشة "ربط الفرع" وإدخاله في إعدادات Cafe POS للبدء في ربط ومتابعة الفروع.' 
                          : 'Generate a linking code from "Branch Linking" and enter it in Cafe POS settings.'}
                      </p>
                      <button
                        onClick={() => openTab('pos_branch_linking', language === 'ar' ? 'ربط الفرع' : 'Branch Linking')}
                        className="mt-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded-xl text-xs font-semibold border border-emerald-500/30 transition-all flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{language === 'ar' ? 'توليد رمز ربط جديد' : 'Generate Linking Code'}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredBranches.map((branch) => (
                  <tr 
                    key={branch.id} 
                    className="hover:bg-gray-800/30 transition-colors group"
                  >
                    {/* 1. Branch Name */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl border flex-shrink-0 ${
                          branch.is_online 
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                            : 'bg-gray-800 border-gray-700 text-gray-400'
                        }`}>
                          <Laptop className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-white group-hover:text-emerald-300 transition-colors">
                            {branch.branch_name || branch.department_name || 'الفرع الرئيسي'}
                          </div>
                          <div className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                            {branch.department_name && (
                              <span>{branch.department_name}</span>
                            )}
                            {branch.pos_version && (
                              <span className="px-1.5 py-0.2 bg-gray-800 text-gray-400 rounded text-[10px] font-mono border border-gray-700">
                                v{branch.pos_version}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 2. Branch Linking Code */}
                    <td className="px-6 py-4">
                      <div className="inline-flex items-center gap-2 bg-gray-950/80 px-3 py-1.5 rounded-lg border border-gray-800 font-mono text-xs text-emerald-400">
                        <span>{branch.code}</span>
                        <button
                          onClick={() => handleCopyCode(branch.code)}
                          className="text-gray-400 hover:text-white transition-colors"
                          title="نسخ الرمز"
                        >
                          {copiedCode === branch.code ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* 3. Connection Status */}
                    <td className="px-6 py-4">
                      {branch.is_online ? (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                          <span>{language === 'ar' ? '🟢 متصل الآن' : '🟢 Online'}</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                          <span>{language === 'ar' ? '🔴 غير متصل' : '🔴 Offline'}</span>
                        </div>
                      )}
                    </td>

                    {/* 4. Last Connection */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className={`text-xs font-medium ${branch.is_online ? 'text-emerald-400' : 'text-gray-300'}`}>
                          {formatTimeAgo(branch.last_seen_at)}
                        </span>
                        <span className="text-[11px] text-gray-500 mt-0.5 font-mono">
                          {formatFullDate(branch.last_seen_at)}
                        </span>
                      </div>
                    </td>

                    {/* 5. Branch Address */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-xs text-gray-300">
                        <MapPin className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
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

        {/* Footer info bar */}
        <div className="px-6 py-3.5 bg-gray-950/60 border-t border-gray-800/80 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-gray-400">
          <div>
            {language === 'ar' 
              ? `عرض ${filteredBranches.length} من إجمالي ${totalBranches} فرع مربوط` 
              : `Showing ${filteredBranches.length} of ${totalBranches} linked branches`}
          </div>
          <div className="flex items-center gap-2 text-gray-400">
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
  );
}

export default PosConnectedBranches;
