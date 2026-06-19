import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ActivityLog, JournalEntry } from '../types';
import { dbService } from '../services/dbService';
import { Clock, Activity, History, FileText, ChevronDown, ChevronUp, ArrowRightLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatNumber } from '../utils/formatUtils';
import { useLanguage } from '../contexts/LanguageContext';

interface TransactionSidePanelProps {
  documentId?: string;
  category: string;
  previewJournalEntry?: JournalEntry | null;
  previewActivityLog?: Partial<ActivityLog> | null;
  layout?: 'side' | 'bottom';
  currencyCode?: string;
  exchangeRate?: number;
}

export const TransactionSidePanel: React.FC<TransactionSidePanelProps> = ({ 
  documentId, 
  category,
  previewJournalEntry,
  previewActivityLog,
  layout = 'side',
  currencyCode,
  exchangeRate
}) => {
  const { user } = useAuth();
  const { language, dir } = useLanguage();
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
            const entityMatch = Array.isArray(log.entity) 
              ? log.entity.includes(category) 
              : log.entity === category;
            return entityMatch && log.document_id === documentId;
          })
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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

  // BOTTOM LAYOUT
  if (layout === 'bottom') {
    const isPreview = displayJournal?.id === 'preview';
    const rate = Number(exchangeRate) || 1;

    let displayTotalDebit = 0;
    let displayTotalCredit = 0;

    if (displayJournal) {
      displayJournal.items.forEach(item => {
        const localDebit = isPreview ? (item.debit * rate) : item.debit;
        const localCredit = isPreview ? (item.credit * rate) : item.credit;
        displayTotalDebit += localDebit;
        displayTotalCredit += localCredit;
      });
    }

    return (
      <div className="w-full flex flex-col bg-white h-full overflow-y-auto custom-scrollbar" dir={dir}>
        {/* Journal Entry Section */}
        {displayJournal ? (
          <div className="px-4 py-3 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-emerald-50 flex items-center justify-center">
                  <ArrowRightLeft size={14} className="text-emerald-600" />
                </div>
                <h4 className="text-xs font-black text-slate-800">
                  {language === 'ar' ? 'تفاصيل القيد المحاسبي' : 'Journal Entry Details'} 
                  {displayJournal.entry_number && ` (${displayJournal.entry_number})`}
                  {isPreview && (
                    <span className="mr-2 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[9px] animate-pulse">
                      {language === 'ar' ? 'معاينة القيد' : 'Preview'}
                    </span>
                  )}
                </h4>
              </div>
              <div className="text-[10px] text-zinc-400 font-bold font-mono">
                {displayJournal.date && `${language === 'ar' ? 'التاريخ:' : 'Date:'} ${new Date(displayJournal.date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}`}
              </div>
            </div>

            <div className="overflow-x-auto border border-zinc-150 rounded-xl shadow-sm bg-zinc-50/20">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-100/80 text-zinc-650 font-bold border-b border-zinc-200">
                    <th className="p-2.5 text-left font-black text-zinc-700 w-32 border-l border-zinc-200">{language === 'ar' ? 'المدين' : 'Debit'}</th>
                    <th className="p-2.5 text-left font-black text-zinc-700 w-32 border-l border-zinc-200">{language === 'ar' ? 'الدائن' : 'Credit'}</th>
                    <th className="p-2.5 text-center font-black text-zinc-700 w-32 border-l border-zinc-200">{language === 'ar' ? 'كود الحساب' : 'Account Code'}</th>
                    <th className="p-2.5 text-right font-black text-zinc-700 border-l border-zinc-200">{language === 'ar' ? 'الحساب الرئيسي' : 'Main Account'}</th>
                    <th className="p-2.5 text-right font-black text-zinc-700 border-l border-zinc-200">{language === 'ar' ? 'الصنف' : 'Item/Product'}</th>
                    <th className="p-2.5 text-center font-black text-zinc-700 w-24 border-l border-zinc-200">{language === 'ar' ? 'العملة' : 'Currency'}</th>
                    <th className="p-2.5 text-left font-black text-zinc-700 w-40">{language === 'ar' ? 'قيمة العملة الأجنبية' : 'Foreign Currency Value'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-150">
                  {displayJournal.items.map((item, idx) => {
                    const localDebit = isPreview ? (item.debit * rate) : item.debit;
                    const localCredit = isPreview ? (item.credit * rate) : item.credit;
                    
                    const hasDebit = localDebit > 0;
                    const hasCredit = localCredit > 0;
                    
                    const foreignValue = isPreview 
                      ? (item.debit || item.credit) 
                      : (rate > 1 ? (item.debit || item.credit) / rate : (item.debit || item.credit));

                    return (
                      <tr key={idx} className="hover:bg-zinc-50/50 transition-colors">
                        {/* Debit */}
                        <td className={`p-2.5 text-left font-bold border-l border-zinc-200 ${hasDebit ? 'text-emerald-600 bg-emerald-50/5' : 'text-zinc-350'}`}>
                          {hasDebit ? formatNumber(localDebit) : '-'}
                        </td>
                        {/* Credit */}
                        <td className={`p-2.5 text-left font-bold border-l border-zinc-200 ${hasCredit ? 'text-red-500 bg-red-50/5' : 'text-zinc-350'}`}>
                          {hasCredit ? formatNumber(localCredit) : '-'}
                        </td>
                        {/* Account Code */}
                        <td className="p-2.5 text-center font-mono font-bold text-zinc-550 border-l border-zinc-200 bg-amber-50/5">
                          {item.account_code || '-'}
                        </td>
                        {/* Main Account */}
                        <td className="p-2.5 text-right font-black text-zinc-800 border-l border-zinc-200">
                          {item.account_name}
                        </td>
                        {/* Item/Product */}
                        <td className="p-2.5 text-right font-medium text-zinc-650 border-l border-zinc-200">
                          {item.product_name || '-'}
                        </td>
                        {/* Currency */}
                        <td className="p-2.5 text-center font-bold text-zinc-550 border-l border-zinc-200 bg-amber-50/5">
                          {currencyCode || 'EGP'}
                        </td>
                        {/* Foreign Currency Value */}
                        <td className="p-2.5 text-left font-bold text-slate-700">
                          {formatNumber(foreignValue)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-zinc-100 font-black border-t border-zinc-200">
                    <td className="p-2.5 text-left text-emerald-700 text-xs border-l border-zinc-200">
                      {formatNumber(displayTotalDebit)}
                    </td>
                    <td className="p-2.5 text-left text-red-650 text-xs border-l border-zinc-200">
                      {formatNumber(displayTotalCredit)}
                    </td>
                    <td colSpan={5} className="p-2.5 text-right text-[11px] uppercase tracking-wider text-zinc-550">
                      {language === 'ar' ? 'الإجمالي العام' : 'Total'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-zinc-400 italic text-xs">
            {language === 'ar' ? 'لا يوجد قيد محاسبي مرتبط بعد.' : 'No journal entry linked yet.'}
          </div>
        )}

        {/* Activity Logs Section */}
        <div className="flex-1 border-t border-zinc-200 bg-zinc-50/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Activity size={12} className="text-emerald-500" />
            </div>
            <h4 className="text-[11px] font-bold text-zinc-650 uppercase tracking-wider">
              {language === 'ar' ? 'سجل التعديلات والنشاط' : 'Activity Log & Changes'}
            </h4>
          </div>

          {/* Preview Activity Log */}
          {!documentId && previewActivityLog && (
            <div className="relative pr-6 mb-4 group last:mb-0">
              <div className="absolute right-0.5 top-1.5 w-2.5 h-2.5 rounded-full bg-white border-2 border-amber-500 z-10 shadow-sm animate-pulse" />
              <div className="absolute right-[5px] top-4 bottom-0 w-0.5 bg-zinc-150" />
              
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400">
                  <Clock size={10} />
                  <span>{language === 'ar' ? 'الآن' : 'Now'}</span>
                  <span className="mx-1">•</span>
                  <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[9px]">{language === 'ar' ? 'معاينة' : 'Preview'}</span>
                </div>
                <div className="bg-amber-50/30 rounded-xl p-3 border border-amber-100/50 shadow-sm">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-zinc-800 mb-1">
                    <span>{previewActivityLog.action}</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    {previewActivityLog.details}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Logs List */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="animate-pulse flex gap-3 pr-6">
                  <div className="w-2 h-2 rounded-full bg-zinc-200 mt-1.5" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-1.5 bg-zinc-200 rounded w-1/4" />
                    <div className="h-12 bg-zinc-100 rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          ) : displayLogs.length === 0 && !previewActivityLog ? (
            <div className="flex flex-col items-center justify-center py-6 text-zinc-400 space-y-2 bg-white rounded-xl border border-dashed border-zinc-200">
              <Activity size={18} className="opacity-20 text-zinc-500" />
              <p className="text-[10px] font-medium italic">{language === 'ar' ? 'لا توجد تعديلات مسجلة بعد' : 'No changes recorded yet'}</p>
            </div>
          ) : (
            <div className="relative space-y-4 before:absolute before:inset-y-0 before:right-2 before:w-0.5 before:bg-zinc-150">
              {displayLogs.map((log) => (
                <div key={log.id} className="relative pr-6 group">
                  <div className="absolute right-0.5 top-1.5 w-2.5 h-2.5 rounded-full bg-white border-2 border-emerald-500 z-10 shadow-sm group-hover:scale-110 transition-transform" />
                  
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400">
                      <Clock size={10} />
                      <span>{new Date(log.created_at).toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="mx-1">•</span>
                      <span className="text-zinc-550">{log.username}</span>
                    </div>

                    <div className="bg-white rounded-xl p-3 border border-zinc-150 shadow-sm group-hover:shadow-md group-hover:border-emerald-100 transition-all">
                      <div className="flex items-center gap-2 text-[11px] font-bold text-zinc-800 mb-1">
                        <span>{log.action}</span>
                      </div>
                      <p className="text-[10px] text-zinc-550 leading-relaxed">
                        {log.details}
                      </p>

                      {log.changes && log.changes.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-zinc-100 space-y-1.5">
                          {log.changes.map((change, idx) => (
                            <div key={idx} className="text-[10px] flex flex-col gap-0.5">
                              <span className="font-bold text-zinc-400">{change.field}:</span>
                              <div className="flex items-center gap-2 flex-wrap bg-zinc-50 p-1.5 rounded-lg">
                                <span className="text-red-400 line-through opacity-60">{String(change.old_value || (language === 'ar' ? 'فارغ' : 'Empty'))}</span>
                                <span className="text-zinc-300">←</span>
                                <span className="text-emerald-600 font-bold">{String(change.new_value || (language === 'ar' ? 'فارغ' : 'Empty'))}</span>
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
    );
  }

  // DEFAULT SIDE LAYOUT
  return (
    <div className="w-full lg:w-80 border-l border-zinc-100 flex flex-col bg-zinc-50/50 h-full overflow-hidden" dir={dir}>
      <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
            <History size={18} className="text-emerald-500" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-900 text-sm">{language === 'ar' ? 'سجل النشاط والقيد' : 'Activity Log & Journal'}</h3>
            <p className="text-[10px] text-zinc-400 font-medium">{language === 'ar' ? 'تتبع التغييرات والقيود المحاسبية' : 'Track changes and entries'}</p>
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
                    {language === 'ar' ? 'قيد اليومية' : 'Journal Entry'} {displayJournal.entry_number && `(${displayJournal.entry_number})`}
                    {!documentId && <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[10px] animate-pulse">{language === 'ar' ? 'معاينة' : 'Preview'}</span>}
                  </div>
                  <p className="text-[10px] text-zinc-400">
                    {displayJournal.entry_number ? `${language === 'ar' ? 'رقم القيد:' : 'Entry No:'} ${displayJournal.entry_number}` : (language === 'ar' ? 'القيد المحاسبي المولد' : 'Generated Journal Entry')}
                  </p>
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
                      <span>{language === 'ar' ? 'الحساب' : 'Account'}</span>
                      <div className="flex gap-6">
                        <span className="w-14 text-left">{language === 'ar' ? 'مدين' : 'Debit'}</span>
                        <span className="w-14 text-left">{language === 'ar' ? 'دائن' : 'Credit'}</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {displayJournal.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-start text-[11px] gap-2 group">
                          <span className="flex-1 font-medium text-zinc-700 group-hover:text-emerald-600 transition-colors">{item.account_name}</span>
                          <div className="flex gap-6">
                            <span className={`w-14 text-left font-bold ${item.debit > 0 ? 'text-emerald-600' : 'text-zinc-300'}`}>
                              {item.debit > 0 ? formatNumber(item.debit) : '-'}
                            </span>
                            <span className={`w-14 text-left font-bold ${item.credit > 0 ? 'text-red-500' : 'text-zinc-300'}`}>
                              {item.credit > 0 ? formatNumber(item.credit) : '-'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="pt-3 border-t border-zinc-200 flex justify-between items-center">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{language === 'ar' ? 'الإجمالي' : 'Total'}</span>
                      <div className="flex gap-6">
                        <span className="w-14 text-left font-black text-emerald-600 text-xs">{formatNumber(displayJournal.total_debit)}</span>
                        <span className="w-14 text-left font-black text-red-600 text-xs">{formatNumber(displayJournal.total_credit)}</span>
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
            <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{language === 'ar' ? 'سجل الأحداث' : 'Activity Log'}</h4>
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
                  <span>{language === 'ar' ? 'الآن' : 'Now'}</span>
                  <span className="mx-1 text-zinc-200">•</span>
                  <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[9px]">{language === 'ar' ? 'معاينة' : 'Preview'}</span>
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
              <p className="text-[11px] font-medium italic">{language === 'ar' ? 'لا توجد حركات مسجلة' : 'No logs recorded'}</p>
            </div>
          ) : (
            <div className="relative space-y-6 before:absolute before:inset-y-0 before:right-2 before:w-0.5 before:bg-zinc-100">
              {logs.map((log) => (
                <div key={log.id} className="relative pr-6 group">
                  <div className="absolute right-0.5 top-1.5 w-2.5 h-2.5 rounded-full bg-white border-2 border-emerald-500 z-10 shadow-sm group-hover:scale-125 transition-transform" />
                  
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400">
                      <Clock size={10} />
                      <span>{new Date(log.created_at).toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span>
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
                                <span className="text-red-400 line-through opacity-60">{String(change.old_value || (language === 'ar' ? 'فارغ' : 'Empty'))}</span>
                                <span className="text-zinc-300">←</span>
                                <span className="text-emerald-600 font-bold">{String(change.new_value || (language === 'ar' ? 'فارغ' : 'Empty'))}</span>
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
