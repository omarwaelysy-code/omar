import React, { useState, useEffect, useMemo } from 'react';
import { Company } from '../../types';
import { subscriptionApiService, SubscriptionData } from '../../services/SubscriptionApiService';
import { 
  CreditCard, Search, Filter, AlertTriangle, CheckCircle2, XCircle, 
  Clock, PlayCircle, PauseCircle, StopCircle, RefreshCw, AlertCircle,
  MoreVertical, Edit, ChevronLeft, ChevronRight, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SubscriptionsTabProps {
  companies: Company[];
}

interface EnrichedSubscription extends SubscriptionData {
  company_name: string;
  company_code: string;
  company_email: string;
  isExceeded: boolean;
  isExpiringSoon: boolean;
  remainingDays: number;
}

export const SubscriptionsTab: React.FC<SubscriptionsTabProps> = ({ companies }) => {
  const [subscriptions, setSubscriptions] = useState<SubscriptionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters and Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [planFilter, setPlanFilter] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Sorting
  const [sortField, setSortField] = useState<keyof EnrichedSubscription>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Dialog State
  const [selectedSub, setSelectedSub] = useState<EnrichedSubscription | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Partial<SubscriptionData>>({});
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      const data = await subscriptionApiService.getAllSubscriptions();
      setSubscriptions(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  };

  const enrichedData = useMemo(() => {
    return subscriptions.map(sub => {
      const company = companies.find(c => c.id === sub.company_id);
      
      const isExceeded = 
        sub.current_users > sub.max_users ||
        sub.current_branches > sub.max_branches ||
        sub.current_warehouses > sub.max_warehouses ||
        sub.current_devices > sub.max_devices ||
        sub.current_monthly_transactions > sub.max_monthly_transactions;

      let remainingDays = 0;
      let isExpiringSoon = false;

      if (sub.subscription_status === 'Active' && sub.end_date) {
        const diffTime = new Date(sub.end_date).getTime() - new Date().getTime();
        remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        isExpiringSoon = remainingDays > 0 && remainingDays <= 30;
      } else if (sub.subscription_status === 'Trial' && sub.trial_until) {
        const diffTime = new Date(sub.trial_until).getTime() - new Date().getTime();
        remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        isExpiringSoon = remainingDays > 0 && remainingDays <= 7; // Trial expires sooner
      }

      return {
        ...sub,
        company_name: company?.name || 'Unknown Company',
        company_code: company?.code || '---',
        company_email: company?.email || '',
        isExceeded,
        isExpiringSoon,
        remainingDays
      } as EnrichedSubscription;
    });
  }, [subscriptions, companies]);

  // KPIs
  const kpis = useMemo(() => {
    return {
      total: enrichedData.length,
      active: enrichedData.filter(s => s.subscription_status === 'Active').length,
      trial: enrichedData.filter(s => s.subscription_status === 'Trial').length,
      expired: enrichedData.filter(s => s.subscription_status === 'Expired').length,
      suspended: enrichedData.filter(s => s.subscription_status === 'Suspended').length,
      expiringSoon: enrichedData.filter(s => s.isExpiringSoon).length,
      exceededLimits: enrichedData.filter(s => s.isExceeded).length,
    };
  }, [enrichedData]);

  // Filtering & Sorting
  const filteredData = useMemo(() => {
    return enrichedData
      .filter(s => {
        if (statusFilter !== 'All' && s.subscription_status !== statusFilter) return false;
        if (planFilter !== 'All' && s.plan_type !== planFilter) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          return s.company_name.toLowerCase().includes(q) || 
                 s.company_code.toLowerCase().includes(q) ||
                 s.company_email.toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        if (aVal === bVal) return 0;
        const compare = aVal < bVal ? -1 : 1;
        return sortDirection === 'asc' ? compare : -compare;
      });
  }, [enrichedData, searchQuery, statusFilter, planFilter, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSort = (field: keyof EnrichedSubscription) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleAction = async (action: 'activate' | 'suspend' | 'expire' | 'trial', companyId: string) => {
    try {
      setActionLoading(true);
      await subscriptionApiService[action](companyId);
      await fetchSubscriptions();
      setSelectedSub(null);
    } catch (err: any) {
      alert(err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveLimits = async () => {
    if (!selectedSub) return;
    try {
      setActionLoading(true);
      await subscriptionApiService.updateSubscriptionLimits(selectedSub.company_id, editForm);
      await fetchSubscriptions();
      setEditMode(false);
    } catch (err: any) {
      alert(err.message || 'Save failed');
    } finally {
      setActionLoading(false);
    }
  };

  const openDialog = (sub: EnrichedSubscription) => {
    setSelectedSub(sub);
    setEditForm({
      plan_type: sub.plan_type,
      max_users: sub.max_users,
      max_branches: sub.max_branches,
      max_warehouses: sub.max_warehouses,
      max_devices: sub.max_devices,
      max_monthly_transactions: sub.max_monthly_transactions
    });
    setEditMode(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Trial': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Expired': return 'bg-red-100 text-red-700 border-red-200';
      case 'Suspended': return 'bg-zinc-800 text-zinc-300 border-zinc-700';
      default: return 'bg-stone-100 text-stone-500';
    }
  };

  if (loading && subscriptions.length === 0) {
    return (
      <div className="flex items-center justify-center p-20 text-stone-400">
        <RefreshCw className="animate-spin w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      
      {/* Header & KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-stone-500 font-bold">إجمالي الشركات</p>
            <h4 className="text-2xl font-black text-stone-800">{kpis.total}</h4>
          </div>
          <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center">
            <CreditCard />
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-emerald-600 font-bold">نشطة</p>
            <h4 className="text-2xl font-black text-emerald-700">{kpis.active}</h4>
          </div>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center">
            <CheckCircle2 />
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-amber-600 font-bold">تجريبية</p>
            <h4 className="text-2xl font-black text-amber-700">{kpis.trial}</h4>
          </div>
          <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center">
            <Clock />
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-red-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-red-600 font-bold">منتهية</p>
            <h4 className="text-2xl font-black text-red-700">{kpis.expired}</h4>
          </div>
          <div className="w-12 h-12 bg-red-50 text-red-500 rounded-xl flex items-center justify-center">
            <XCircle />
          </div>
        </div>
        <div className="bg-zinc-900 p-4 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-400 font-bold">موقوفة</p>
            <h4 className="text-2xl font-black text-white">{kpis.suspended}</h4>
          </div>
          <div className="w-12 h-12 bg-zinc-800 text-zinc-400 rounded-xl flex items-center justify-center">
            <PauseCircle />
          </div>
        </div>
      </div>

      {/* Alerts */}
      {(kpis.expiringSoon > 0 || kpis.exceededLimits > 0) && (
        <div className="flex flex-col gap-3">
          {kpis.expiringSoon > 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-center gap-3">
              <AlertTriangle className="text-amber-500" />
              <div className="font-bold">يوجد {kpis.expiringSoon} شركات سينتهي اشتراكها خلال 30 يوماً أو أقل.</div>
            </div>
          )}
          {kpis.exceededLimits > 0 && (
            <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-center gap-3">
              <AlertCircle className="text-red-500" />
              <div className="font-bold">انتباه: يوجد {kpis.exceededLimits} شركات تجاوزت الحدود القصوى للاستخدام (Limits).</div>
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
          <input 
            type="text" 
            placeholder="بحث باسم الشركة، الكود، البريد..." 
            className="w-full bg-stone-50 border border-stone-200 rounded-xl pr-10 pl-4 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm font-bold"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <select 
            className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 outline-none font-bold text-sm"
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
          >
            <option value="All">كل الباقات</option>
            <option value="Basic">Basic</option>
            <option value="Pro">Pro</option>
            <option value="Enterprise">Enterprise</option>
          </select>
          <select 
            className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 outline-none font-bold text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">كل الحالات</option>
            <option value="Active">نشط</option>
            <option value="Trial">تجريبي</option>
            <option value="Expired">منتهي</option>
            <option value="Suspended">موقوف</option>
          </select>
          <button onClick={fetchSubscriptions} className="w-11 h-11 flex items-center justify-center bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl transition-colors">
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Data Grid */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-stone-50 border-b border-stone-100 text-stone-500 font-black">
              <tr>
                <th className="p-4 cursor-pointer hover:bg-stone-100" onClick={() => handleSort('company_name')}>الشركة</th>
                <th className="p-4 cursor-pointer hover:bg-stone-100" onClick={() => handleSort('plan_type')}>الباقة</th>
                <th className="p-4 cursor-pointer hover:bg-stone-100" onClick={() => handleSort('subscription_status')}>الحالة</th>
                <th className="p-4 cursor-pointer hover:bg-stone-100" onClick={() => handleSort('end_date')}>النهاية (متبقي)</th>
                <th className="p-4 text-center">المستخدمون</th>
                <th className="p-4 text-center">الفروع</th>
                <th className="p-4 text-center">أجهزة POS</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {paginatedData.map(sub => (
                <tr key={sub.id} className="hover:bg-blue-50/50 transition-colors cursor-pointer group" onClick={() => openDialog(sub)}>
                  <td className="p-4">
                    <div className="font-bold text-stone-800">{sub.company_name}</div>
                    <div className="text-xs text-stone-400 font-mono">{sub.company_code}</div>
                  </td>
                  <td className="p-4">
                    <span className="font-bold text-stone-700 bg-stone-100 px-2 py-1 rounded text-xs">
                      {sub.plan_type}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-black border ${getStatusColor(sub.subscription_status)}`}>
                      {sub.subscription_status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="font-bold text-stone-700">
                      {sub.subscription_status === 'Trial' ? 
                        (sub.trial_until ? new Date(sub.trial_until).toLocaleDateString('ar-EG') : '-') : 
                        (sub.end_date ? new Date(sub.end_date).toLocaleDateString('ar-EG') : '-')}
                    </div>
                    {sub.remainingDays > 0 && (
                      <div className={`text-xs font-bold ${sub.isExpiringSoon ? 'text-red-500' : 'text-stone-400'}`}>
                        متبقي {sub.remainingDays} يوم
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <div className={`font-mono text-xs font-bold ${sub.current_users > sub.max_users ? 'text-red-500 bg-red-50 px-2 py-1 rounded' : 'text-stone-500'}`}>
                      {sub.current_users} / {sub.max_users}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <div className={`font-mono text-xs font-bold ${sub.current_branches > sub.max_branches ? 'text-red-500 bg-red-50 px-2 py-1 rounded' : 'text-stone-500'}`}>
                      {sub.current_branches} / {sub.max_branches}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <div className={`font-mono text-xs font-bold ${sub.current_devices > sub.max_devices ? 'text-red-500 bg-red-50 px-2 py-1 rounded' : 'text-stone-500'}`}>
                      {sub.current_devices} / {sub.max_devices}
                    </div>
                  </td>
                  <td className="p-4 text-left">
                    <button className="text-stone-400 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreVertical size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {paginatedData.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-stone-400 font-bold">
                    لا توجد اشتراكات مطابقة للبحث
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="bg-stone-50 border-t border-stone-200 p-4 flex items-center justify-between">
            <div className="text-sm font-bold text-stone-500">
              صفحة {currentPage} من {totalPages}
            </div>
            <div className="flex gap-2">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="w-8 h-8 rounded bg-white border border-stone-200 flex items-center justify-center text-stone-600 disabled:opacity-50"
              >
                <ChevronRight size={16} />
              </button>
              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                className="w-8 h-8 rounded bg-white border border-stone-200 flex items-center justify-center text-stone-600 disabled:opacity-50"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dialog */}
      <AnimatePresence>
        {selectedSub && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm" dir="rtl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
                <div>
                  <h3 className="text-xl font-black text-stone-800">{selectedSub.company_name}</h3>
                  <p className="text-sm text-stone-400 font-mono mt-1">{selectedSub.company_code} | {selectedSub.company_email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1.5 rounded-full text-sm font-black border ${getStatusColor(selectedSub.subscription_status)}`}>
                    {selectedSub.subscription_status}
                  </span>
                  <button onClick={() => setSelectedSub(null)} className="w-8 h-8 flex items-center justify-center bg-stone-200 hover:bg-stone-300 text-stone-600 rounded-full transition-colors">
                    <XCircle size={18} />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto flex-1 space-y-8">
                {/* Section 1: Details */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-stone-800 flex items-center gap-2">
                      <CreditCard size={18} className="text-blue-500" />
                      بيانات الاشتراك
                    </h4>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
                      <div className="text-xs text-stone-400 font-bold mb-1">الباقة</div>
                      {editMode ? (
                        <select 
                          className="w-full bg-white border border-stone-200 rounded px-2 py-1 outline-none text-sm font-bold"
                          value={editForm.plan_type}
                          onChange={e => setEditForm({...editForm, plan_type: e.target.value as any})}
                        >
                          <option value="Basic">Basic</option>
                          <option value="Pro">Pro</option>
                          <option value="Enterprise">Enterprise</option>
                        </select>
                      ) : (
                        <div className="font-bold text-stone-800">{selectedSub.plan_type}</div>
                      )}
                    </div>
                    <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
                      <div className="text-xs text-stone-400 font-bold mb-1">البداية</div>
                      <div className="font-mono text-sm text-stone-800">{selectedSub.start_date ? new Date(selectedSub.start_date).toLocaleDateString('ar-EG') : '-'}</div>
                    </div>
                    <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
                      <div className="text-xs text-stone-400 font-bold mb-1">النهاية</div>
                      <div className="font-mono text-sm text-stone-800">{selectedSub.end_date ? new Date(selectedSub.end_date).toLocaleDateString('ar-EG') : '-'}</div>
                    </div>
                    <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
                      <div className="text-xs text-stone-400 font-bold mb-1">Trial Until</div>
                      <div className="font-mono text-sm text-stone-800">{selectedSub.trial_until ? new Date(selectedSub.trial_until).toLocaleDateString('ar-EG') : '-'}</div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Usage vs Limits */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-stone-800 flex items-center gap-2">
                      <AlertCircle size={18} className="text-emerald-500" />
                      الاستهلاك والحدود القصوى (Limits)
                    </h4>
                    {!editMode ? (
                      <button onClick={() => setEditMode(true)} className="text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors">
                        <Edit size={14} /> تعديل Limits
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => setEditMode(false)} className="text-sm font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-lg transition-colors">
                          إلغاء
                        </button>
                        <button onClick={handleSaveLimits} disabled={actionLoading} className="text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50">
                          {actionLoading ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />} حفظ التعديلات
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    {[
                      { key: 'users', label: 'المستخدمون', maxKey: 'max_users', currentKey: 'current_users' },
                      { key: 'branches', label: 'الفروع', maxKey: 'max_branches', currentKey: 'current_branches' },
                      { key: 'warehouses', label: 'المخازن', maxKey: 'max_warehouses', currentKey: 'current_warehouses' },
                      { key: 'devices', label: 'أجهزة POS', maxKey: 'max_devices', currentKey: 'current_devices' },
                      { key: 'transactions', label: 'المعاملات الشهرية', maxKey: 'max_monthly_transactions', currentKey: 'current_monthly_transactions' },
                    ].map(item => {
                      const current = selectedSub[item.currentKey as keyof EnrichedSubscription] as number;
                      const max = editMode ? editForm[item.maxKey as keyof SubscriptionData] as number : selectedSub[item.maxKey as keyof EnrichedSubscription] as number;
                      const percent = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 100;
                      const isOverLimit = current > max;

                      return (
                        <div key={item.key} className={`bg-white border rounded-xl p-4 flex items-center gap-4 ${isOverLimit && !editMode ? 'border-red-300 bg-red-50/30' : 'border-stone-100'}`}>
                          <div className="w-1/4 font-bold text-sm text-stone-700">{item.label}</div>
                          
                          <div className="flex-1 flex items-center gap-3">
                            <div className="h-2 flex-1 bg-stone-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${isOverLimit ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${percent}%` }} />
                            </div>
                            <div className="font-mono text-sm font-black w-24 text-left">
                              <span className={isOverLimit && !editMode ? 'text-red-600' : 'text-stone-800'}>{current}</span> 
                              <span className="text-stone-400 mx-1">/</span> 
                              {editMode ? (
                                <input 
                                  type="number"
                                  className="w-16 bg-stone-50 border border-stone-200 rounded px-1 py-0.5 text-center outline-none focus:border-blue-500"
                                  value={max}
                                  onChange={e => setEditForm({...editForm, [item.maxKey]: parseInt(e.target.value) || 0})}
                                />
                              ) : (
                                <span className="text-stone-500">{max}</span>
                              )}
                            </div>
                          </div>
                          
                          {isOverLimit && !editMode && (
                            <div className="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded">متجاوز</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-4 border-t border-stone-100 bg-stone-50 flex items-center justify-between">
                <div className="flex gap-2">
                  <button 
                    disabled={actionLoading || selectedSub.subscription_status === 'Active'}
                    onClick={() => handleAction('activate', selectedSub.company_id)}
                    className="px-4 py-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 font-bold rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <PlayCircle size={16} /> تنشيط
                  </button>
                  <button 
                    disabled={actionLoading || selectedSub.subscription_status === 'Trial'}
                    onClick={() => handleAction('trial', selectedSub.company_id)}
                    className="px-4 py-2 bg-amber-100 text-amber-700 hover:bg-amber-200 font-bold rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <Clock size={16} /> تجريبي
                  </button>
                  <button 
                    disabled={actionLoading || selectedSub.subscription_status === 'Suspended'}
                    onClick={() => handleAction('suspend', selectedSub.company_id)}
                    className="px-4 py-2 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 font-bold rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <PauseCircle size={16} /> إيقاف
                  </button>
                  <button 
                    disabled={actionLoading || selectedSub.subscription_status === 'Expired'}
                    onClick={() => handleAction('expire', selectedSub.company_id)}
                    className="px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 font-bold rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <StopCircle size={16} /> إنهاء
                  </button>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
