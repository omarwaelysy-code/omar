import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ActivityLog } from '../types';
import { dbService } from '../services/dbService';
import { Clock, User, Activity, Calendar, History, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PageActivityLogProps {
  category: string;
  documentId?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const PageActivityLog: React.FC<PageActivityLogProps> = ({ category, documentId, isOpen, onClose }) => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && isOpen) {
      const unsub = dbService.subscribe<ActivityLog>('activity_logs', user.company_id, (data) => {
        const filtered = data
          .filter(log => {
            // Filter by category
            const categoryMatch = Array.isArray(log.category) 
              ? log.category.includes(category) 
              : log.category === category;
            
            // Filter by documentId if provided
            const documentMatch = documentId ? log.document_id === documentId : true;

            return categoryMatch && documentMatch;
          })
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setLogs(filtered);
        setLoading(false);
      });
      return () => unsub();
    }
  }, [user, category, documentId, isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[55] md:hidden"
          />

          {/* Sidebar */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full md:w-96 bg-white shadow-2xl z-[60] flex flex-col border-l border-zinc-100"
          >
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <History size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 tracking-tight">سجل النشاط</h3>
                  <p className="text-xs text-zinc-500">آخر التغييرات في هذه الشاشة</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-zinc-200 rounded-xl transition-colors text-zinc-400 hover:text-zinc-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="animate-pulse space-y-2">
                      <div className="h-4 bg-zinc-100 rounded w-1/2" />
                      <div className="h-12 bg-zinc-50 rounded-2xl" />
                    </div>
                  ))}
                </div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-400 space-y-4 italic">
                  <Activity size={48} className="opacity-20" />
                  <p>لا توجد سجلات نشاط لهذه الشاشة بعد</p>
                </div>
              ) : (
                <div className="relative space-y-8 before:absolute before:inset-y-0 before:right-4 before:w-0.5 before:bg-zinc-100">
                  {logs.map((log) => (
                    <div key={log.id} className="relative pr-10">
                      {/* Timeline Dot */}
                      <div className="absolute right-2.5 top-1 w-3.5 h-3.5 rounded-full bg-white border-2 border-emerald-500 z-10 shadow-sm" />
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-bold text-zinc-400">
                            <Calendar size={12} />
                            <span>{new Date(log.timestamp).toLocaleDateString('ar-EG')}</span>
                            <Clock size={12} className="mr-1" />
                            <span>{new Date(log.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>

                        <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-100 hover:border-emerald-200 transition-colors group">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                              <User size={12} />
                            </div>
                            <span className="text-sm font-bold text-zinc-900">{log.username}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-zinc-700 font-medium mb-1">
                            <Activity size={14} className="text-emerald-500" />
                            <span>{log.action}</span>
                          </div>
                          <p className="text-xs text-zinc-500 leading-relaxed mb-3">
                            {log.details}
                          </p>

                          {log.changes && log.changes.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-zinc-100 space-y-2">
                              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">التغييرات بالتفصيل:</p>
                              <div className="grid gap-2">
                                {log.changes.map((change, idx) => (
                                  <div key={idx} className="bg-white rounded-lg p-2 border border-zinc-100 text-[11px] flex flex-col gap-1">
                                    <span className="font-bold text-zinc-600">{change.field}:</span>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-red-500 line-through bg-red-50 px-1.5 rounded">
                                        {typeof change.old_value === 'object' ? JSON.stringify(change.old_value) : String(change.old_value || 'فارغ')}
                                      </span>
                                      <span className="text-zinc-400">←</span>
                                      <span className="text-emerald-600 bg-emerald-50 px-1.5 rounded font-bold">
                                        {typeof change.new_value === 'object' ? JSON.stringify(change.new_value) : String(change.new_value || 'فارغ')}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
