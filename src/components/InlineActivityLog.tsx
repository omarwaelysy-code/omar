import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ActivityLog } from '../types';
import { dbService } from '../services/dbService';
import { Clock, User, Activity, Calendar, History } from 'lucide-react';
import { formatDateTime } from '../utils/formatUtils';

interface InlineActivityLogProps {
  category: string;
  documentId?: string;
}

export const InlineActivityLog: React.FC<InlineActivityLogProps> = ({ category, documentId }) => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      const unsub = dbService.subscribe<ActivityLog>('activity_logs', user.company_id, (data) => {
        const filtered = data
          .filter(log => {
            // Filter by entity
            const entityMatch = Array.isArray(log.entity) 
              ? log.entity.includes(category) 
              : log.entity === category;
            
            // Filter by documentId if provided
            const documentMatch = documentId ? log.document_id === documentId : true;

            return entityMatch && documentMatch;
          })
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setLogs(filtered);
        setLoading(false);
      });
      return () => unsub();
    }
  }, [user, category, documentId]);

  return (
    <div className="h-full flex flex-col bg-zinc-50/50 border-l border-zinc-100">
      <div className="p-4 border-b border-zinc-100 flex items-center gap-3 bg-white/50">
        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
          <History size={16} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-zinc-900 tracking-tight">سجل التعديلات</h3>
          <p className="text-[10px] text-zinc-500">آخر التغييرات لهذا السجل</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse space-y-2">
                <div className="h-3 bg-zinc-100 rounded w-1/2" />
                <div className="h-10 bg-zinc-50 rounded-xl" />
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-400 space-y-2 italic text-center">
            <Activity size={32} className="opacity-20" />
            <p className="text-xs">لا توجد سجلات نشاط بعد</p>
          </div>
        ) : (
          <div className="relative space-y-6 before:absolute before:inset-y-0 before:right-3 before:w-0.5 before:bg-zinc-100">
            {logs.map((log) => (
              <div key={log.id} className="relative pr-8">
                {/* Timeline Dot */}
                <div className="absolute right-1.5 top-1 w-3 h-3 rounded-full bg-white border-2 border-emerald-500 z-10 shadow-sm" />
                
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 font-mono">
                    <Clock size={10} />
                    <span>{formatDateTime(log.created_at)}</span>
                  </div>

                  <div className="bg-white rounded-xl p-3 border border-zinc-100 shadow-sm hover:border-emerald-200 transition-colors group">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                        <User size={10} />
                      </div>
                      <span className="text-[11px] font-bold text-zinc-900">{log.username}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-700 font-bold mb-1">
                      <Activity size={12} className="text-emerald-500" />
                      <span>{log.action}</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-relaxed">
                      {log.details}
                    </p>

                    {log.changes && log.changes.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-zinc-50 space-y-1.5">
                        {log.changes.map((change, idx) => {
                          const formatLogValue = (val: any) => {
                            if (val === undefined || val === null || val === '') return 'فارغ';
                            if (typeof val === 'object') return 'كائن';
                            const str = String(val);
                            if (/^-?\d+(\.\d+)?$/.test(str)) {
                              const num = parseFloat(str);
                              if (!isNaN(num)) {
                                if (str.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(str)) {
                                  return str;
                                }
                                return new Intl.NumberFormat('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                }).format(num);
                              }
                            }
                            return str;
                          };
                          return (
                            <div key={idx} className="text-[10px] flex flex-col gap-0.5">
                              <span className="font-bold text-zinc-500">{change.field}:</span>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-red-500 line-through bg-red-50/50 px-1 rounded">
                                  {formatLogValue(change.old_value)}
                                </span>
                                <span className="text-zinc-300">←</span>
                                <span className="text-emerald-600 bg-emerald-50/50 px-1 rounded font-bold">
                                  {formatLogValue(change.new_value)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
