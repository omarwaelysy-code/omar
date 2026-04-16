import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ActivityLog } from '../types';
import { Search, Clock, User, Activity, Calendar } from 'lucide-react';
import { dbService } from '../services/dbService';

export const ActivityLogPage: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (user) {
      const unsub = dbService.subscribe<ActivityLog>('activity_logs', user.company_id, (data) => {
        // Sort logs by timestamp descending
        const sortedLogs = [...data].sort((a, b) => {
          const dateA = new Date(a.timestamp).getTime();
          const dateB = new Date(b.timestamp).getTime();
          return dateB - dateA;
        });
        setLogs(sortedLogs);
      });
      setLoading(false);
      return () => unsub();
    }
  }, [user]);

  const filteredLogs = logs.filter(log => 
    log.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.details.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">سجل النشاط</h2>
          <p className="text-zinc-500">متابعة كافة التغييرات والعمليات التي تمت على النظام.</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-3xl border border-zinc-100 shadow-sm flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
          <input 
            type="text" 
            placeholder="البحث بالمستخدم، الإجراء، أو التفاصيل..."
            className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 border-b border-zinc-100">
                <th className="px-6 py-4 text-sm font-bold text-zinc-500 uppercase tracking-tighter">المستخدم</th>
                <th className="px-6 py-4 text-sm font-bold text-zinc-500 uppercase tracking-tighter">الإجراء</th>
                <th className="px-6 py-4 text-sm font-bold text-zinc-500 uppercase tracking-tighter">التفاصيل</th>
                <th className="px-6 py-4 text-sm font-bold text-zinc-500 uppercase tracking-tighter">التاريخ والوقت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {loading ? (
                [1,2,3,4,5].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={4} className="px-6 py-4 h-16 bg-zinc-50/20" />
                  </tr>
                ))
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-zinc-400 italic">لا توجد سجلات نشاط حالياً</td>
                </tr>
              ) : filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-zinc-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                        <User size={16} />
                      </div>
                      <span className="font-bold text-zinc-900">{log.username}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Activity size={16} className="text-emerald-500" />
                      <span className="text-zinc-700">{log.action}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-zinc-500 max-w-md truncate group-hover:whitespace-normal group-hover:overflow-visible transition-all">
                      {log.details}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col text-xs text-zinc-400">
                      <div className="flex items-center gap-1">
                        <Calendar size={12} />
                        <span>{new Date(log.timestamp).toLocaleDateString('ar-EG')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock size={12} />
                        <span>{new Date(log.timestamp).toLocaleTimeString('ar-EG')}</span>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-zinc-50">
          {loading ? (
            [1,2,3,4,5].map(i => (
              <div key={i} className="p-4 h-24 animate-pulse bg-zinc-50/20" />
            ))
          ) : filteredLogs.length === 0 ? (
            <div className="px-6 py-12 text-center text-zinc-400 italic">لا توجد سجلات نشاط حالياً</div>
          ) : filteredLogs.map(log => (
            <div key={log.id} className="p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <User size={16} />
                  </div>
                  <span className="font-bold text-zinc-900">{log.username}</span>
                </div>
                <div className="text-left text-[10px] text-zinc-400">
                  <div className="flex items-center gap-1 justify-end">
                    <Calendar size={10} />
                    <span>{new Date(log.timestamp).toLocaleDateString('ar-EG')}</span>
                  </div>
                  <div className="flex items-center gap-1 justify-end">
                    <Clock size={10} />
                    <span>{new Date(log.timestamp).toLocaleTimeString('ar-EG')}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-zinc-700">
                <Activity size={14} className="text-emerald-500" />
                <span className="font-medium">{log.action}</span>
              </div>
              <div className="bg-zinc-50 p-3 rounded-xl text-xs text-zinc-500 italic">
                {log.details}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
