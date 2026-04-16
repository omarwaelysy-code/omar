import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ActivityLog, JournalEntry } from '../types';
import { dbService } from '../services/dbService';
import { Clock, User, Activity, Calendar, History, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TransactionSidePanelProps {
  documentId?: string;
  category: string;
  previewJournalEntry?: JournalEntry | null;
  previewActivityLog?: Partial<ActivityLog> | null;
}

export const TransactionSidePanel: React.FC<TransactionSidePanelProps> = ({ 
  documentId, 
  category,
  previewJournalEntry,
  previewActivityLog
}) => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [journalEntry, setJournalEntry] = useState<JournalEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [isJournalOpen, setIsJournalOpen] = useState(false);

  useEffect(() => {
    if (user && documentId) {
      setLoading(true);
      // Fetch Activity Logs
      const unsubLogs = dbService.subscribe<ActivityLog>('activity_logs', user.company_id, (data) => {
        const filtered = data
          .filter(log => {
            const categoryMatch = Array.isArray(log.category) 
              ? log.category.includes(category) 
              : log.category === category;
            return categoryMatch && log.document_id === documentId;
          })
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setLogs(filtered);
      });

      // Fetch Journal Entry
      const fetchJournal = async () => {
        const entry = await dbService.getJournalEntryByReference(documentId, user.company_id);
        setJournalEntry(entry);
        setLoading(false);
      };

      fetchJournal();

      return () => unsubLogs();
    } else {
      setLogs([]);
      setJournalEntry(null);
      setLoading(false);
    }
  }, [user, documentId, category]);

  if (!documentId && !previewJournalEntry && !previewActivityLog) return null;

  const displayJournal = previewJournalEntry || journalEntry;
  const displayLogs = logs;

  return (
    <div className="w-full lg:w-80 border-l border-zinc-100 flex flex-col bg-zinc-50/50 h-full overflow-hidden">
      <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
            <History size={18} className="text-emerald-500" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-900 text-sm">سجل النشاط والقيد</h3>
            <p className="text-[10px] text-zinc-400 font-medium">تتبع التغييرات والقيود المحاسبية</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {/* Journal Entry Section */}
        {displayJournal && (
          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <button 
              onClick={() => setIsJournalOpen(!isJournalOpen)}
              className="w-full p-4 flex items-center justify-between hover:bg-zinc-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <FileText size={16} className="text-emerald-600" />
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs">
                    قيد اليومية
                    {!documentId && <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[10px] animate-pulse">معاينة</span>}
                  </div>
                  <p className="text-[10px] text-zinc-400">القيد المحاسبي المولد</p>
                </div>
              </div>
              {isJournalOpen ? <ChevronUp size={16} className="text-zinc-400" /> : <ChevronDown size={16} className="text-zinc-400" />}
            </button>
            
            <AnimatePresence>
              {isJournalOpen && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-t border-zinc-100"
                >
                  <div className="p-4 space-y-4 bg-zinc-50/30">
                    <div className="flex justify-between text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                      <span>الحساب</span>
                      <div className="flex gap-6">
                        <span className="w-14 text-left">مدين</span>
                        <span className="w-14 text-left">دائن</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {displayJournal.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-start text-[11px] gap-2 group">
                          <span className="flex-1 font-medium text-zinc-700 group-hover:text-emerald-600 transition-colors">{item.account_name}</span>
                          <div className="flex gap-6">
                            <span className={`w-14 text-left font-bold ${item.debit > 0 ? 'text-emerald-600' : 'text-zinc-300'}`}>
                              {item.debit > 0 ? item.debit.toLocaleString() : '-'}
                            </span>
                            <span className={`w-14 text-left font-bold ${item.credit > 0 ? 'text-red-500' : 'text-zinc-300'}`}>
                              {item.credit > 0 ? item.credit.toLocaleString() : '-'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="pt-3 border-t border-zinc-200 flex justify-between items-center">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">الإجمالي</span>
                      <div className="flex gap-6">
                        <span className="w-14 text-left font-black text-emerald-600 text-xs">{displayJournal.total_debit.toLocaleString()}</span>
                        <span className="w-14 text-left font-black text-red-600 text-xs">{displayJournal.total_credit.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Activity Logs Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">سجل الأحداث</h4>
            <Activity size={12} className="text-zinc-300" />
          </div>

          {/* Preview Activity Log */}
          {!documentId && previewActivityLog && (
            <div className="relative pr-6 group">
              <div className="absolute right-0.5 top-1.5 w-2.5 h-2.5 rounded-full bg-white border-2 border-amber-500 z-10 shadow-sm animate-pulse" />
              <div className="absolute right-[5px] top-4 bottom-0 w-0.5 bg-zinc-100 group-last:hidden" />
              
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400">
                  <Clock size={10} />
                  <span>الآن</span>
                  <span className="mx-1 text-zinc-200">•</span>
                  <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[9px]">معاينة</span>
                </div>
                <div className="bg-amber-50/50 rounded-2xl p-4 border border-amber-100/50 shadow-sm group-hover:shadow-md transition-all">
                  <div className="flex items-center gap-2 text-xs font-bold text-zinc-800 mb-1.5">
                    <div className="w-5 h-5 rounded-lg bg-amber-100 flex items-center justify-center">
                      <Activity size={10} className="text-amber-600" />
                    </div>
                    <span>{previewActivityLog.action}</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    {previewActivityLog.details}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Activity Logs List */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse flex gap-4 pr-6">
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-100 mt-1.5" />
                  <div className="flex-1 space-y-2">
                    <div className="h-2 bg-zinc-100 rounded w-1/4" />
                    <div className="h-16 bg-zinc-50 rounded-2xl" />
                  </div>
                </div>
              ))}
            </div>
          ) : logs.length === 0 && !previewActivityLog ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-400 space-y-3 bg-white rounded-2xl border border-dashed border-zinc-200">
              <div className="w-12 h-12 rounded-full bg-zinc-50 flex items-center justify-center">
                <Activity size={24} className="opacity-20" />
              </div>
              <p className="text-[11px] font-medium italic">لا توجد حركات مسجلة</p>
            </div>
          ) : (
            <div className="relative space-y-6 before:absolute before:inset-y-0 before:right-2 before:w-0.5 before:bg-zinc-100">
              {logs.map((log) => (
                <div key={log.id} className="relative pr-6 group">
                  <div className="absolute right-0.5 top-1.5 w-2.5 h-2.5 rounded-full bg-white border-2 border-emerald-500 z-10 shadow-sm group-hover:scale-125 transition-transform" />
                  
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400">
                      <Clock size={10} />
                      <span>{new Date(log.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="mx-1 text-zinc-200">•</span>
                      <span className="text-zinc-500">{log.username}</span>
                    </div>

                    <div className="bg-white rounded-2xl p-4 border border-zinc-100 shadow-sm group-hover:shadow-md group-hover:border-emerald-100 transition-all">
                      <div className="flex items-center gap-2 text-xs font-bold text-zinc-800 mb-1.5">
                        <div className="w-5 h-5 rounded-lg bg-emerald-50 flex items-center justify-center">
                          <Activity size={10} className="text-emerald-500" />
                        </div>
                        <span>{log.action}</span>
                      </div>
                      <p className="text-[11px] text-zinc-500 leading-relaxed">
                        {log.details}
                      </p>

                      {log.changes && log.changes.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-zinc-50 space-y-2">
                          {log.changes.map((change, idx) => (
                            <div key={idx} className="text-[10px] flex flex-col gap-1">
                              <span className="font-bold text-zinc-400">{change.field}:</span>
                              <div className="flex items-center gap-2 flex-wrap bg-zinc-50 p-1.5 rounded-lg">
                                <span className="text-red-400 line-through opacity-60">{String(change.old_value || 'فارغ')}</span>
                                <span className="text-zinc-300">←</span>
                                <span className="text-emerald-600 font-bold">{String(change.new_value || 'فارغ')}</span>
                              </div>
                            </div>
                          ))}
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
    </div>
  );
};
