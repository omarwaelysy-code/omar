import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { dbService } from '../services/dbService';
import { JournalEntry, Account } from '../types';
import { Search, Calendar, FileText, Eye, Download, Printer, Filter, ArrowLeftRight, Trash2, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { exportToPDF } from '../utils/pdfUtils';
import { exportToExcel, formatDataForExcel } from '../utils/excelUtils';
import { useNotification } from '../contexts/NotificationContext';

export const JournalEntries: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { showNotification } = useNotification();
  const reportRef = useRef<HTMLDivElement>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const unsubscribeEntries = dbService.subscribe<JournalEntry>('journal_entries', user.company_id, (data) => {
      setEntries(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setLoading(false);
    });

    const unsubscribeAccounts = dbService.subscribe<Account>('accounts', user.company_id, setAccounts);

    return () => {
      unsubscribeEntries();
      unsubscribeAccounts();
    };
  }, [user]);

  const filteredEntries = entries.filter(entry => {
    const matchesSearch = 
      entry.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.reference_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.items?.some(item => item.account_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const entryDate = new Date(entry.date);
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    endDate.setHours(23, 59, 59, 999);
    
    const matchesDate = entryDate >= startDate && entryDate <= endDate;
    
    return matchesSearch && matchesDate;
  });

  const handleExportPDF = async () => {
    if (reportRef.current) {
      await exportToPDF(reportRef.current, { 
        filename: 'Journal_Entries', 
        orientation: 'landscape',
        reportTitle: t('journal.title')
      });
    }
  };

  const handleExportExcel = () => {
    const data = filteredEntries.map(entry => ({
      [t('journal.column_date')]: entry.date,
      [t('journal.column_description')]: entry.description,
      [t('journal.column_reference')]: entry.reference_number || '-',
      [t('journal.type')]: entry.reference_type,
      [t('journal.column_debit')]: entry.total_debit,
      [t('journal.column_credit')]: entry.total_credit
    }));
    exportToExcel(data, { filename: 'Journal_Entries' });
  };

  const handleDelete = async (id: string) => {
    setEntryToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!entryToDelete || !user) return;
    const entry = entries.find(e => e.id === entryToDelete);
    if (entry && entry.reference_type !== 'manual') {
      showNotification(t('journal.delete_error_auto'), 'error');
      setIsDeleteModalOpen(false);
      return;
    }
    try {
      await dbService.delete('journal_entries', entryToDelete);
      await dbService.logActivity(user.id, user.username, user.company_id, t('journal.log_delete'), t('journal.log_delete_msg', { number: entryToDelete }), 'journal_entries', entryToDelete);
      showNotification(t('journal.delete_success'), 'success');
      setIsDeleteModalOpen(false);
      setEntryToDelete(null);
    } catch (e: any) {
      console.error(e);
      showNotification(e.message || t('common.error'), 'error');
    }
  };

  // Cleanup orphaned entries (Deep Check)
  const cleanupOrphanedEntries = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const collectionsToVerify = [
        'invoices', 'purchase_invoices', 'returns', 'purchase_returns', 
        'payment_vouchers', 'receipt_vouchers', 'expenses', 
        'customers', 'suppliers', 'products', 'payment_methods',
        'customer_discounts', 'supplier_discounts'
      ];

      const validRefIds = new Set<string>();
      
      // Fetch each collection individually to avoid Promise.all failure
      for (const colName of collectionsToVerify) {
        try {
          const docs = await dbService.list<any>(colName, user.company_id);
          if (docs && Array.isArray(docs)) {
            docs.forEach(d => {
              if (d.id) validRefIds.add(d.id);
            });
          }
        } catch (e) {
          console.warn(`Could not fetch collection ${colName}, skipping...`, e);
        }
      }

      const orphaned = entries.filter(e => {
        // Keep manual entries
        if (e.reference_type === 'manual') return false;
        
        // If it has no reference_id, it's orphaned (unless it's a special type we want to keep, but usually these should have IDs)
        if (!e.reference_id) return true;

        // Check if the reference exists in our valid IDs
        return !validRefIds.has(e.reference_id);
      });
      
      let deletedCount = 0;
      for (const entry of orphaned) {
        try {
          await dbService.delete('journal_entries', entry.id);
          deletedCount++;
        } catch (err) {
          console.error(`Failed to delete entry ${entry.id}`, err);
        }
      }
      
      showNotification(language === 'ar' ? `تم تنظيف ${deletedCount} قيد يتيم بنجاح.` : `Successfully cleaned up ${deletedCount} orphaned entries.`, 'success');
    } catch (e) {
      console.error(e);
      showNotification(language === 'ar' ? 'حدث خطأ أثناء التنظيف العميق' : 'Error during deep cleanup', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Delete ALL automated entries (Reset system movements)
  const deleteAllAutomatedEntries = async () => {
    const confirmMsg = language === 'ar' 
      ? 'هل أنت متأكد من حذف كافة القيود الآلية؟ هذا الإجراء سيقوم بتصفير كافة الحركات المحاسبية الناتجة عن النظام.' 
      : 'Are you sure you want to delete all automated entries? This action will reset all accounting movements generated by the system.';
    
    if (!user || !window.confirm(confirmMsg)) return;
    setLoading(true);
    try {
      const automated = entries.filter(e => e.reference_type !== 'manual');
      let count = 0;
      for (const entry of automated) {
        try {
          await dbService.delete('journal_entries', entry.id);
          count++;
        } catch (err) {
          console.error(`Failed to delete automated entry ${entry.id}`, err);
        }
      }
      showNotification(language === 'ar' ? `تم حذف ${count} قيد آلي بنجاح.` : `Successfully deleted ${count} automated entries.`, 'success');
    } catch (e) {
      console.error(e);
      showNotification(language === 'ar' ? 'فشل حذف القيود' : 'Failed to delete entries', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-zinc-900">{t('journal.title')}</h2>
          <p className="text-zinc-500 font-medium mt-1">{t('journal.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={cleanupOrphanedEntries}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl font-bold hover:bg-rose-100 transition-all active:scale-95 shadow-sm"
            title={t('journal.cleanup')}
          >
            <Trash2 size={18} />
            <span className="hidden md:inline text-sm">{t('journal.cleanup')}</span>
          </button>
          <button 
            onClick={deleteAllAutomatedEntries}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-xl font-bold hover:bg-amber-100 transition-all active:scale-95 shadow-sm"
            title={t('journal.delete_all_auto')}
          >
            <RotateCcw size={18} />
            <span className="hidden md:inline text-sm">{t('journal.delete_all_auto')}</span>
          </button>
          <button onClick={handleExportPDF} className="p-2.5 bg-white border border-zinc-200 text-zinc-600 rounded-xl hover:bg-zinc-50 transition-all shadow-sm"><Printer size={20} /></button>
          <button onClick={handleExportExcel} className="p-2.5 bg-white border border-zinc-200 text-zinc-600 rounded-xl hover:bg-zinc-50 transition-all shadow-sm"><Download size={20} /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 relative">
          <Search className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={20} />
          <input
            type="text"
            placeholder={t('journal.search_placeholder')}
            className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="relative">
          <Calendar className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={20} />
          <input
            type="date"
            className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium`}
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
          />
        </div>
        <div className="relative">
          <Calendar className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={20} />
          <input
            type="date"
            className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium`}
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
          />
        </div>
      </div>

      <div ref={reportRef} className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'} border-collapse`}>
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                <th className="px-6 py-4 text-sm font-bold text-zinc-700">{t('journal.column_date')}</th>
                <th className="px-6 py-4 text-sm font-bold text-zinc-700">{t('journal.column_description')}</th>
                <th className="px-6 py-4 text-sm font-bold text-zinc-700">{t('journal.column_reference')}</th>
                <th className="px-6 py-4 text-sm font-bold text-zinc-700 text-center">{t('journal.column_debit')}</th>
                <th className="px-6 py-4 text-sm font-bold text-zinc-700 text-center">{t('journal.column_credit')}</th>
                <th className="px-6 py-4 text-sm font-bold text-zinc-700 text-center">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-zinc-50/50 transition-colors group">
                  <td className="px-6 py-4 text-sm font-bold text-zinc-900">{entry.date}</td>
                  <td className="px-6 py-4 text-sm font-medium text-zinc-600 max-w-xs truncate">{entry.description}</td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-zinc-100 text-zinc-600 rounded-lg text-xs font-bold">
                      {entry.reference_number || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-black text-emerald-600 text-center">{entry.total_debit.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm font-black text-rose-600 text-center">{entry.total_credit.toLocaleString()}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => setSelectedEntry(entry)}
                        className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                        title={language === 'ar' ? 'عرض' : 'View'}
                      >
                        <Eye size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(entry.id)}
                        className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                        title={language === 'ar' ? 'حذف' : 'Delete'}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredEntries.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500 font-medium">
                    {t('journal.no_entries')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Entry Details Modal */}
      <AnimatePresence>
        {selectedEntry && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
              dir={dir}
            >
              <div className={`p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                <div className={`flex items-center gap-3 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse text-left'}`}>
                  <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-zinc-900">{t('journal.details')}</h3>
                    <p className="text-xs text-zinc-500 font-bold mt-0.5">{t('journal.column_reference')}: {selectedEntry.reference_number || '-'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedEntry(null)}
                  className="p-2 hover:bg-zinc-200 rounded-xl transition-all text-zinc-400 hover:text-zinc-600"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className={`p-4 bg-zinc-50 rounded-2xl ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">{t('journal.column_date')}</p>
                    <p className="text-sm font-bold text-zinc-900">{selectedEntry.date}</p>
                  </div>
                  <div className={`p-4 bg-zinc-50 rounded-2xl ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">{t('journal.type')}</p>
                    <p className="text-sm font-bold text-zinc-900">{selectedEntry.reference_type}</p>
                  </div>
                  <div className={`p-4 bg-emerald-50 rounded-2xl ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">{t('journal.column_debit')}</p>
                    <p className="text-sm font-black text-emerald-600">{selectedEntry.total_debit.toLocaleString()}</p>
                  </div>
                  <div className={`p-4 bg-rose-50 rounded-2xl ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                    <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">{t('journal.column_credit')}</p>
                    <p className="text-sm font-black text-rose-600">{selectedEntry.total_credit.toLocaleString()}</p>
                  </div>
                </div>

                <div className={`p-4 bg-zinc-50 rounded-2xl ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">{t('journal.column_description')}</p>
                  <p className="text-sm font-bold text-zinc-900">{selectedEntry.description}</p>
                </div>

                <div className="border border-zinc-100 rounded-2xl overflow-hidden">
                  <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'} border-collapse`}>
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-100">
                        <th className="px-4 py-3 text-xs font-black text-zinc-500">{t('accounts.form_name')}</th>
                        <th className="px-4 py-3 text-xs font-black text-zinc-500 text-center">{t('journal.column_debit')}</th>
                        <th className="px-4 py-3 text-xs font-black text-zinc-500 text-center">{t('journal.column_credit')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {selectedEntry.items?.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-3">
                            <p className="text-sm font-bold text-zinc-900">{item.account_name}</p>
                            {(item.customer_name || item.supplier_name) && (
                              <p className="text-[10px] text-emerald-600 font-black mt-0.5">
                                {item.customer_name || item.supplier_name}
                              </p>
                            )}
                            {item.description && <p className="text-[10px] text-zinc-400 font-medium">{item.description}</p>}
                          </td>
                          <td className="px-4 py-3 text-sm font-black text-emerald-600 text-center">
                            {item.debit > 0 ? item.debit.toLocaleString() : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm font-black text-rose-600 text-center">
                            {item.credit > 0 ? item.credit.toLocaleString() : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className={`p-6 bg-zinc-50 border-t border-zinc-100 flex justify-end gap-3 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                <button 
                  onClick={() => setSelectedEntry(null)}
                  className="px-6 py-2.5 bg-zinc-200 text-zinc-600 rounded-xl font-bold hover:bg-zinc-300 transition-all"
                >
                  {language === 'ar' ? 'إغلاق' : 'Close'}
                </button>
                <button className={`px-6 py-2.5 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                  <Printer size={18} />
                  {t('journal.print')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 text-center"
              dir={dir}
            >
              <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={40} />
              </div>
              <h3 className="text-2xl font-black text-zinc-900 mb-2">{t('common.delete_confirm')}</h3>
              <p className="text-zinc-500 font-medium mb-8">{language === 'ar' ? 'هل أنت متأكد من رغبتك في حذف هذا القيد؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to delete this entry? This action cannot be undone.'}</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-black hover:bg-zinc-200 transition-all"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black hover:bg-rose-700 transition-all shadow-lg shadow-rose-200"
                >
                  {language === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const X = ({ size, className }: { size?: number, className?: string }) => (
  <svg 
    width={size || 24} 
    height={size || 24} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);
