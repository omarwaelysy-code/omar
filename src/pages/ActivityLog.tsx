import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ActivityLog } from '../types';
import { Search, Clock, User, Activity, Filter, RefreshCw, Layers, ShieldCheck, ExternalLink, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { dbService } from '../services/dbService';
import { formatDateTime } from '../utils/formatUtils';

export const ActivityLogPage: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [page, setPage] = useState(1);
  const itemsPerPage = 50;

  const fetchLogs = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Try to fetch from audit_logs first (the new system)
      let data = await dbService.listAll<ActivityLog>('audit_logs');
      
      // If none found (maybe system just started), try activity_logs
      if (data.length === 0) {
        const fallback = await dbService.listAll<ActivityLog>('activity_logs');
        data = fallback.map(l => ({
          ...l,
          module: l.action?.split(':')[0] || 'SYSTEM',
          action: l.action?.split(':')[1] || l.action
        }));
      }

      setLogs(data);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [user]);

  // Extract unique modules and actions for filters
  const modules = Array.from(new Set(logs.map(l => l.module).filter(Boolean)));
  const actions = Array.from(new Set(logs.map(l => l.action).filter(Boolean)));

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      (log.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.action || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.details || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesModule = moduleFilter === 'all' || log.module === moduleFilter;
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;

    return matchesSearch && matchesModule && matchesAction;
  });

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginatedLogs = filteredLogs.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const getActionColor = (action: string) => {
    if (action.includes('CREATE') || action.includes('RESTORE')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (action.includes('DELETE') || action.includes('FAILED')) return 'bg-rose-100 text-rose-700 border-rose-200';
    if (action.includes('UPDATE')) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-blue-100 text-blue-700 border-blue-200';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="text-emerald-600" size={24} />
            <h2 className="text-3xl font-black tracking-tight text-zinc-900 serif italic">سجل التدقيق المركزي</h2>
          </div>
          <p className="text-zinc-500">مراقبة كافة حركات المستخدمين والعمليات على مستوى النظام بالكامل.</p>
        </div>
        <button 
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all font-bold shadow-lg shadow-emerald-200 disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          تحديث السجلات
        </button>
      </div>

      {/* Filters Section */}
      <div className="bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-xl shadow-zinc-100/50 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
            <input 
              type="text" 
              placeholder="البحث بالمستخدم، الإجراء، أو التفاصيل..."
              className="w-full pl-10 pr-4 py-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-2xl min-w-[150px]">
              <Layers size={18} className="text-zinc-400" />
              <select 
                value={moduleFilter}
                onChange={(e) => { setModuleFilter(e.target.value); setPage(1); }}
                className="bg-transparent text-sm font-bold flex-1 outline-none appearance-none"
              >
                <option value="all">كل الوجهات</option>
                {modules.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-2xl min-w-[150px]">
              <Filter size={18} className="text-zinc-400" />
              <select 
                value={actionFilter}
                onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
                className="bg-transparent text-sm font-bold flex-1 outline-none appearance-none"
              >
                <option value="all">كل الإجراءات</option>
                {actions.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-zinc-100 shadow-xl shadow-zinc-100/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-zinc-50/50 border-b border-zinc-100">
                <th className="px-6 py-5 text-sm font-black text-zinc-600 uppercase tracking-widest text-center w-20">#</th>
                <th className="px-6 py-5 text-sm font-black text-zinc-600 uppercase tracking-widest">المستخدم</th>
                <th className="px-6 py-5 text-sm font-black text-zinc-600 uppercase tracking-widest">القسم/الوجهة</th>
                <th className="px-6 py-5 text-sm font-black text-zinc-600 uppercase tracking-widest">الإجراء</th>
                <th className="px-6 py-5 text-sm font-black text-zinc-600 uppercase tracking-widest">التفاصيل</th>
                <th className="px-6 py-5 text-sm font-black text-zinc-600 uppercase tracking-widest text-center">عنوان IP</th>
                <th className="px-6 py-5 text-sm font-black text-zinc-600 uppercase tracking-widest">التوقيت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {loading ? (
                [1,2,3,4,5,6,7,8,9,10].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={7} className="px-6 py-4 h-16 bg-zinc-50/10" />
                  </tr>
                ))
              ) : paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-zinc-400 italic">
                      <Search size={48} className="opacity-20" />
                      <span>لا توجد سجلات مطابقة للبحث أو الفلترة</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedLogs.map((log, idx) => (
                <tr key={log.id} className="hover:bg-zinc-50/80 transition-all group">
                  <td className="px-6 py-4 text-xs font-mono text-zinc-300 text-center">
                    {(page - 1) * itemsPerPage + idx + 1}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-zinc-100 text-zinc-600 flex items-center justify-center border border-zinc-200 group-hover:bg-emerald-100 group-hover:text-emerald-600 group-hover:border-emerald-200 transition-colors">
                        <User size={18} />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-zinc-900">{log.username || '-'}</span>
                        <span className="text-[10px] text-zinc-400 font-mono italic">ID: {log.user_id?.substring(0, 8)}...</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-zinc-50 rounded-lg border border-zinc-100">
                        <Layers size={14} className="text-zinc-500" />
                      </div>
                      <span className="text-sm font-black text-zinc-700 tracking-tighter">{log.module || 'SYSTEM'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black border tracking-wider ${getActionColor(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-start gap-2 max-w-sm">
                      <p className="text-sm text-zinc-600 leading-relaxed font-medium">
                        {log.details || '-'}
                      </p>
                      {log.entity_id && (
                        <div className="p-1 bg-white border border-zinc-100 rounded-md shadow-sm h-fit">
                          <ExternalLink size={10} className="text-zinc-400" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-[10px] font-mono text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-md">
                      {log.ip_address || '0.0.0.0'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col text-xs text-zinc-500">
                      <div className="flex items-center gap-1.5 font-bold">
                        <Calendar size={12} className="text-emerald-500" />
                        <span>{formatDateTime(log.created_at).split(',')[0]}</span>
                      </div>
                      <div className="flex items-center gap-1.5 opacity-60 font-mono">
                        <Clock size={12} />
                        <span>{formatDateTime(log.created_at).split(',')[1]}</span>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-6 bg-zinc-50/50 border-t border-zinc-100 flex items-center justify-between">
            <div className="text-sm text-zinc-500 font-medium">
              عرض <span className="font-black text-zinc-900">{paginatedLogs.length}</span> من أصل <span className="font-black text-zinc-900">{filteredLogs.length}</span> سجل
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 disabled:opacity-30 disabled:pointer-events-none transition-all"
              >
                <ChevronRight size={20} />
              </button>
              <div className="flex items-center gap-1">
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => setPage(i + 1)}
                    className={`w-10 h-10 rounded-xl font-bold text-sm transition-all ${
                      page === i + 1 
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' 
                        : 'bg-white border border-zinc-200 text-zinc-500 hover:border-emerald-300 hover:text-emerald-600'
                    }`}
                  >
                    {i + 1}
                  </button>
                )).slice(Math.max(0, page - 3), Math.min(totalPages, page + 2))}
              </div>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 disabled:opacity-30 disabled:pointer-events-none transition-all"
              >
                <ChevronLeft size={20} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
