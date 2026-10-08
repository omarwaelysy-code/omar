import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { dbService } from '../services/dbService';
import { JournalEntry, Account } from '../types';
import { Search, Calendar, FileText, Eye, Download, Printer, Filter, ArrowLeftRight, Trash2, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { exportToPDF } from '../utils/pdfUtils';
import { exportToExcel, formatDataForExcel } from '../utils/excelUtils';
import { useNotification } from '../contexts/NotificationContext';
import { formatNumber, formatMoney, formatDate, getDocumentTypeName, DOCUMENT_TYPE_OPTIONS, matchesDocumentTypeFilter } from '../utils/formatUtils';
import { PaginationControls } from '../components/PaginationControls';
import { printDocument } from '../utils/printEngine';
import { useNavigation } from '../contexts/NavigationContext';

export const JournalEntries: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { showNotification } = useNotification();
  const { pendingViewDoc, setPendingViewDoc, setCurrentPage } = useNavigation();
  const handleTransactionClick = (type: string | undefined, reference: string | undefined) => {
    if (!reference || reference === '-' || reference === '') return;
    
    let normType = type;
    if (!normType) {
      if (reference.startsWith('INV-')) normType = 'invoice';
      else if (reference.startsWith('PINV-')) normType = 'purchase_invoice';
      else if (reference.startsWith('RCT-')) normType = 'receipt';
      else if (reference.startsWith('PAY-')) normType = 'payment_voucher';
      else if (reference.startsWith('RET-')) normType = 'return';
      else if (reference.startsWith('PRET-')) normType = 'purchase_return';
      else normType = 'manual';
    }
    
    if (normType === 'invoice') {
      setPendingViewDoc({ type: 'invoice', idOrNumber: reference });
      setCurrentPage('invoices');
    } else if (normType === 'purchase_invoice') {
      setPendingViewDoc({ type: 'purchase_invoice', idOrNumber: reference });
      setCurrentPage('purchase_invoices');
    } else if (normType === 'receipt' || normType === 'receipt_voucher') {
      setPendingViewDoc({ type: 'receipt', idOrNumber: reference });
      setCurrentPage('receipts');
    } else if (normType === 'payment_voucher' || normType === 'payment') {
      setPendingViewDoc({ type: 'payment_voucher', idOrNumber: reference });
      setCurrentPage('payment_vouchers');
    } else if (normType === 'return') {
      setPendingViewDoc({ type: 'return', idOrNumber: reference });
      setCurrentPage('returns');
    } else if (normType === 'purchase_return') {
      setPendingViewDoc({ type: 'purchase_return', idOrNumber: reference });
      setCurrentPage('purchase_returns');
    } else {
      setSelectedEntry(null);
      setPendingViewDoc({ type: 'manual', idOrNumber: reference });
    }
  };
  const reportRef = useRef<HTMLDivElement>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(field);
      setSortOrder('DESC');
    }
    setPage(1);
  };
  
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [totalRecords, setTotalRecords] = useState(0);
  const [serverSummary, setServerSummary] = useState<any>({});
  const [maxSeqGenerated, setMaxSeqGenerated] = useState<number>(0);
  const [preset, setPreset] = useState('this_month');
  const [selectedDocType, setSelectedDocType] = useState('all');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);

  const handlePresetChange = (selectedPreset: string) => {
    setPreset(selectedPreset);
    const now = new Date();
    let start = '';
    let end = '';

    switch (selectedPreset) {
      case 'today':
        start = now.toISOString().split('T')[0];
        end = start;
        break;
      case 'yesterday': {
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        start = yesterday.toISOString().split('T')[0];
        end = start;
        break;
      }
      case 'this_week': {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const startOfWeek = new Date(now.setDate(diff));
        start = startOfWeek.toISOString().split('T')[0];
        end = new Date().toISOString().split('T')[0];
        break;
      }
      case 'last_week': {
        const day = now.getDay();
        const diff = now.getDate() - day - 6;
        const startOfLastWeek = new Date(now.setDate(diff));
        const endOfLastWeek = new Date(startOfLastWeek);
        endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
        start = startOfLastWeek.toISOString().split('T')[0];
        end = endOfLastWeek.toISOString().split('T')[0];
        break;
      }
      case 'this_month':
        start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        end = new Date().toISOString().split('T')[0];
        break;
      case 'last_month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
        end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
        break;
      case 'this_quarter': {
        const q = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), q * 3, 1).toISOString().split('T')[0];
        end = new Date().toISOString().split('T')[0];
        break;
      }
      case 'last_quarter': {
        const q = Math.floor(now.getMonth() / 3) - 1;
        const year = q < 0 ? now.getFullYear() - 1 : now.getFullYear();
        const quarter = q < 0 ? 3 : q;
        start = new Date(year, quarter * 3, 1).toISOString().split('T')[0];
        end = new Date(year, (quarter + 1) * 3, 0).toISOString().split('T')[0];
        break;
      }
      case 'this_year':
        start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        end = new Date().toISOString().split('T')[0];
        break;
      case 'last_year':
        start = new Date(now.getFullYear() - 1, 0, 1).toISOString().split('T')[0];
        end = new Date(now.getFullYear() - 1, 11, 31).toISOString().split('T')[0];
        break;
      case 'all':
        start = '';
        end = '';
        break;
      default:
        return;
    }
    setDateRange({ start, end });
    setPage(1);
  };

  useEffect(() => {
    if (pendingViewDoc && (pendingViewDoc.type === 'journal' || pendingViewDoc.type === 'journal_entry' || pendingViewDoc.type === 'manual' || pendingViewDoc.type === 'journal_entries') && user) {
      const loadPendingDoc = async () => {
        try {
          const existing = entries.find(e => 
            e.reference_number === pendingViewDoc.idOrNumber || 
            e.entry_number === pendingViewDoc.idOrNumber ||
            e.id === pendingViewDoc.idOrNumber
          );
          if (existing) {
            setSelectedEntry(existing);
            setPendingViewDoc(null);
            return;
          }
          const docs = await dbService.getDocsByFilter<any>('journal_entries', user.company_id, [
            { field: 'reference_number', operator: '==', value: pendingViewDoc.idOrNumber }
          ]);
          const docsByEntryNumber = await dbService.getDocsByFilter<any>('journal_entries', user.company_id, [
            { field: 'entry_number', operator: '==', value: pendingViewDoc.idOrNumber }
          ]);
          if (docs && docs.length > 0) {
            setSelectedEntry(docs[0]);
          } else if (docsByEntryNumber && docsByEntryNumber.length > 0) {
            setSelectedEntry(docsByEntryNumber[0]);
          } else {
            const docById = await dbService.get<any>('journal_entries', pendingViewDoc.idOrNumber);
            if (docById) {
              setSelectedEntry(docById);
            }
          }
          setPendingViewDoc(null);
        } catch (err) {
          console.error("Error loading pending document", err);
          setPendingViewDoc(null);
        }
      };
      loadPendingDoc();
    }
  }, [pendingViewDoc, entries, user, setPendingViewDoc]);

  useEffect(() => {
    if (!user) return;

    const unsubscribeEntries = dbService.subscribePaginated('journal_entries', {
        company_id: user.company_id,
        _page: page,
        _limit: limit,
        _sortBy: sortBy,
        _sortOrder: sortOrder,
        _search: searchTerm,
        date_from: dateRange.start,
        date_to: dateRange.end
    }, (result: any) => {
      setEntries(result.data);
      setTotalRecords(result.total);
      setServerSummary(result.summary);
      setLoading(false);
    });

    const unsubscribeAccounts = dbService.subscribe<Account>('accounts', user.company_id, setAccounts);

    return () => {
      unsubscribeEntries();
      unsubscribeAccounts();
    };
  }, [user, page, limit, sortBy, sortOrder, searchTerm, dateRange.start, dateRange.end]);

  const filteredEntries = React.useMemo(() => {
    let result = entries.filter(entry => {
      const matchesDocType = matchesDocumentTypeFilter(selectedDocType, entry.reference_type, entry.description, entry.reference_number);
      if (!matchesDocType) return false;

      const matchesSearch = 
        entry.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.reference_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (entry.entry_number && entry.entry_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
        entry.items?.some(item => (item.account_name || accounts.find(a => a.id === item.account_id)?.name || '').toLowerCase().includes(searchTerm.toLowerCase()));
      
      if (dateRange.start && dateRange.end) {
        const entryDate = new Date(entry.date);
        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999);
        if (entryDate < startDate || entryDate > endDate) return false;
      }
      
      return matchesSearch;
    });

    if (sortBy === 'reference_type') {
      result = [...result].sort((a, b) => {
        const typeA = getDocumentTypeName(a.reference_type, a.description, a.reference_number, language);
        const typeB = getDocumentTypeName(b.reference_type, b.description, b.reference_number, language);
        return sortOrder === 'ASC' ? typeA.localeCompare(typeB) : typeB.localeCompare(typeA);
      });
    }

    return result;
  }, [entries, selectedDocType, searchTerm, dateRange, accounts, sortBy, sortOrder, language]);

  const totalPages = Math.ceil((totalRecords || 1) / (limit === 1000000 ? (totalRecords || 1) : limit)) || 1;
  const currentDebitTotal = filteredEntries.reduce((sum, item) => sum + (Number(item.total_debit) || 0), 0);
  const currentCreditTotal = filteredEntries.reduce((sum, item) => sum + (Number(item.total_credit) || 0), 0);

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
      [t('journal.column_date')]: formatDate(entry.date),
      [language === 'ar' ? 'نوع الحركة / المستند' : 'Document Type']: getDocumentTypeName(entry.reference_type, entry.description, entry.reference_number, language),
      [t('journal.column_entry_number')]: entry.entry_number || '-',
      [t('journal.column_description')]: entry.description,
      [t('journal.column_reference')]: entry.reference_number || '-',
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
          <button onClick={handleExportPDF} className="p-2.5 bg-white border border-zinc-200 text-zinc-600 rounded-xl hover:bg-zinc-50 transition-all shadow-sm"><Printer size={20} /></button>
          <button onClick={handleExportExcel} className="p-2.5 bg-white border border-zinc-200 text-zinc-600 rounded-xl hover:bg-zinc-50 transition-all shadow-sm"><Download size={20} /></button>
        </div>
      </div>

      {/* Top Filter, Pagination & Info Panel matching Detailed Journal Entries */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm print:hidden">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-end">
          {/* Right Side: Preset, Date Filters, Document Type & Page Switcher */}
          <div className="xl:col-span-7 space-y-4">
            <div className="flex flex-wrap items-end gap-4">
              {/* Period Preset Selector */}
              <div className="space-y-1.5 w-44">
                <label className="block text-xs font-bold text-zinc-500 mr-1">
                  {language === 'ar' ? 'الفترة الزمنية' : 'Period'}
                </label>
                <select
                  value={preset}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 bg-zinc-50 text-zinc-800 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm font-semibold transition-all shadow-sm cursor-pointer"
                >
                  <option value="today">{language === 'ar' ? 'اليوم الحالي' : 'Today'}</option>
                  <option value="yesterday">{language === 'ar' ? 'اليوم السابق' : 'Yesterday'}</option>
                  <option value="this_week">{language === 'ar' ? 'الأسبوع الحالي' : 'This Week'}</option>
                  <option value="last_week">{language === 'ar' ? 'الأسبوع السابق' : 'Last Week'}</option>
                  <option value="this_month">{language === 'ar' ? 'الشهر الحالي' : 'This Month'}</option>
                  <option value="last_month">{language === 'ar' ? 'الشهر السابق' : 'Last Month'}</option>
                  <option value="this_quarter">{language === 'ar' ? 'الربع الحالي' : 'This Quarter'}</option>
                  <option value="last_quarter">{language === 'ar' ? 'الربع السابق' : 'Last Quarter'}</option>
                  <option value="this_year">{language === 'ar' ? 'العام الحالي' : 'This Year'}</option>
                  <option value="last_year">{language === 'ar' ? 'العام السابق' : 'Last Year'}</option>
                  <option value="all">{language === 'ar' ? 'الكل (بدون تاريخ)' : 'All Time'}</option>
                </select>
              </div>

              {/* Date range start */}
              <div className="space-y-1.5 w-40">
                <label className="block text-xs font-bold text-zinc-500 mr-1">
                  {language === 'ar' ? 'من تاريخ' : 'From Date'}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none rtl:left-0 rtl:right-auto rtl:pl-3">
                    <Calendar className="h-4 w-4 text-zinc-400" />
                  </span>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => { setDateRange(prev => ({ ...prev, start: e.target.value })); setPage(1); setPreset(''); }}
                    className="block w-full pr-10 pl-3 py-2 border border-zinc-200 bg-zinc-50 text-zinc-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all rtl:pl-10 rtl:pr-3 text-sm font-semibold shadow-sm"
                  />
                </div>
              </div>

              {/* Date range end */}
              <div className="space-y-1.5 w-40">
                <label className="block text-xs font-bold text-zinc-500 mr-1">
                  {language === 'ar' ? 'إلى تاريخ' : 'To Date'}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none rtl:left-0 rtl:right-auto rtl:pl-3">
                    <Calendar className="h-4 w-4 text-zinc-400" />
                  </span>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => { setDateRange(prev => ({ ...prev, end: e.target.value })); setPage(1); setPreset(''); }}
                    className="block w-full pr-10 pl-3 py-2 border border-zinc-200 bg-zinc-50 text-zinc-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all rtl:pl-10 rtl:pr-3 text-sm font-semibold shadow-sm"
                  />
                </div>
              </div>

              {/* Document Type Filter Dropdown */}
              <div className="space-y-1.5 w-56">
                <label className="block text-xs font-bold text-zinc-500 mr-1">
                  {language === 'ar' ? 'نوع الحركة / المستند' : 'Document Type'}
                </label>
                <select
                  value={selectedDocType}
                  onChange={(e) => { setSelectedDocType(e.target.value); setPage(1); }}
                  className="w-full px-3 py-2 border border-zinc-200 bg-zinc-50 text-zinc-800 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm font-semibold transition-all shadow-sm cursor-pointer"
                >
                  {DOCUMENT_TYPE_OPTIONS.map(opt => (
                    <option key={opt.key} value={opt.key}>
                      {language === 'ar' ? opt.labelAr : opt.labelEn}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Top Pagination Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Page Switcher Box */}
              <div className="flex items-center gap-4 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 shadow-sm font-bold text-zinc-700">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="p-1 hover:bg-zinc-200/50 rounded-lg disabled:opacity-40 transition-colors"
                >
                  {dir === 'rtl' ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
                <span className="text-sm select-none font-mono">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="p-1 hover:bg-zinc-200/50 rounded-lg disabled:opacity-40 transition-colors"
                >
                  {dir === 'rtl' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                </button>
              </div>

              {/* Items Per Page & Total Results Box */}
              <div className="flex items-center gap-3 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 shadow-sm text-sm font-bold text-zinc-700">
                <span className="text-zinc-500">
                  {language === 'ar' ? `إجمالي النتائج: ${totalRecords}` : `Total: ${totalRecords}`}
                </span>
                <div className="w-px h-4 bg-zinc-200" />
                <label className="flex items-center gap-2">
                  <span>{language === 'ar' ? 'عناصر الصفحة:' : 'Items per page:'}</span>
                  <select
                    value={limit}
                    onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                    className="px-2 py-1 bg-white border border-zinc-200 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-transparent outline-none text-xs font-extrabold cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                    <option value={1000000}>{language === 'ar' ? 'الكل' : 'All'}</option>
                  </select>
                </label>
              </div>
            </div>
          </div>

          {/* Left Side: Totals & Search */}
          <div className="xl:col-span-5 space-y-4">
            {/* Totals Cards */}
            <div className="flex items-center gap-4 justify-end">
              <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl px-5 py-3 shadow-sm flex flex-col items-end min-w-[150px]">
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wide">
                  {language === 'ar' ? 'إجمالي المدين (الصفحة)' : 'Total Debit (Page)'}
                </span>
                <span className="text-base font-bold text-emerald-800 mt-0.5">
                  {formatMoney(currentDebitTotal)} {language === 'ar' ? 'ج.م' : 'EGP'}
                </span>
              </div>

              <div className="bg-rose-50/70 border border-rose-100 rounded-2xl px-5 py-3 shadow-sm flex flex-col items-end min-w-[150px]">
                <span className="text-[10px] font-black text-rose-600 uppercase tracking-wide">
                  {language === 'ar' ? 'إجمالي الدائن (الصفحة)' : 'Total Credit (Page)'}
                </span>
                <span className="text-base font-bold text-rose-800 mt-0.5">
                  {formatMoney(currentCreditTotal)} {language === 'ar' ? 'ج.م' : 'EGP'}
                </span>
              </div>
            </div>

            {/* Search Box */}
            <div className="relative">
              <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none rtl:left-0 rtl:right-auto rtl:pl-3">
                <Search className="h-5 w-5 text-zinc-400" />
              </span>
              <input
                type="text"
                placeholder={language === 'ar' ? 'بحث برقم القيد، الحساب، البيان، العميل أو المورد...' : 'Search by entry no, account, narration...'}
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                className="block w-full pr-10 pl-3 py-2.5 border border-zinc-200 bg-zinc-50 text-zinc-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all rtl:pl-10 rtl:pr-3 text-sm font-semibold shadow-sm"
              />
            </div>
          </div>
        </div>
      </div>

      <div ref={reportRef} className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'} border-collapse`}>
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                <th className="px-6 py-4 text-sm font-bold text-zinc-700 cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('date')}>
                  <div className="flex items-center gap-1">
                    {t('journal.column_date')}
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                      {sortBy === 'date' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                    </span>
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-sm font-bold text-zinc-700 cursor-pointer hover:text-emerald-600 transition-colors group" 
                  onClick={() => handleSort('reference_type')}
                >
                  <div className="flex items-center gap-1">
                    {language === 'ar' ? 'نوع الحركة / المستند' : 'Document Type'}
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                      {sortBy === 'reference_type' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                    </span>
                  </div>
                </th>
                <th className="px-6 py-4 text-sm font-bold text-zinc-700 cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('entry_number')}>
                  <div className="flex items-center gap-1">
                    {t('journal.column_entry_number')}
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                      {sortBy === 'entry_number' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                    </span>
                  </div>
                </th>
                <th className="px-6 py-4 text-sm font-bold text-zinc-700">{t('journal.column_description')}</th>
                <th className="px-6 py-4 text-sm font-bold text-zinc-700 cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('reference_number')}>
                  <div className="flex items-center gap-1">
                    {t('journal.column_reference')}
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                      {sortBy === 'reference_number' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                    </span>
                  </div>
                </th>
                <th className="px-6 py-4 text-sm font-bold text-zinc-700 text-center cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('total_debit')}>
                  <div className="flex items-center gap-1 justify-center">
                    {t('journal.column_debit')}
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                      {sortBy === 'total_debit' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                    </span>
                  </div>
                </th>
                <th className="px-6 py-4 text-sm font-bold text-zinc-700 text-center cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('total_credit')}>
                  <div className="flex items-center gap-1 justify-center">
                    {t('journal.column_credit')}
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                      {sortBy === 'total_credit' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                    </span>
                  </div>
                </th>
                <th className="px-6 py-4 text-sm font-bold text-zinc-700 text-center">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-zinc-50/50 transition-colors group">
                  <td className="px-6 py-4 text-sm font-bold text-zinc-900">{formatDate(entry.date)}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-zinc-100 text-zinc-800 border border-zinc-200">
                      {getDocumentTypeName(entry.reference_type, entry.description, entry.reference_number, language)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {entry.entry_number ? (
                      <span 
                        onClick={() => setSelectedEntry(entry)}
                        className="px-3 py-1 bg-zinc-100 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg text-xs font-black cursor-pointer transition-all inline-block hover:scale-105 active:scale-95 font-mono"
                      >
                        {entry.entry_number}
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-zinc-100 text-zinc-400 rounded-lg text-xs font-bold font-mono">
                        -
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-zinc-600 max-w-xs truncate">{entry.description}</td>
                  <td className="px-6 py-4">
                    {entry.reference_number && entry.reference_number !== '-' ? (
                      <span 
                        onClick={() => handleTransactionClick(entry.reference_type, entry.reference_number)}
                        className="px-3 py-1 bg-zinc-100 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg text-xs font-black cursor-pointer transition-all inline-block hover:scale-105 active:scale-95 font-mono"
                      >
                        {entry.reference_number}
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-zinc-100 text-zinc-400 rounded-lg text-xs font-bold font-mono">
                        -
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm font-black text-emerald-600 text-center">{formatMoney(entry.total_debit)}</td>
                  <td className="px-6 py-4 text-sm font-black text-emerald-600 text-center">{formatMoney(entry.total_credit)}</td>
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
                        className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
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
                  <td colSpan={8} className="px-6 py-12 text-center text-zinc-500 font-medium">
                    {t('journal.no_entries')}
                  </td>
                </tr>
              )}
            </tbody>
            {entries.length > 0 && (
              <tfoot className="bg-zinc-900 text-white font-black">
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center border-l border-zinc-700">{t('journal.total')}</td>
                  <td className="px-6 py-4 text-center border-l border-zinc-700">
                    {serverSummary.total_debit ? formatMoney(serverSummary.total_debit) : '0.00'}
                  </td>
                  <td className="px-6 py-4 text-center border-l border-zinc-700">
                    {serverSummary.total_credit ? formatMoney(serverSummary.total_credit) : '0.00'}
                  </td>
                  <td className="px-6 py-4"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <PaginationControls page={page} limit={limit} total={totalRecords} onPageChange={setPage} onLimitChange={setLimit} />
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
                    <p className="text-xs text-zinc-500 font-bold mt-0.5">
                      {t('journal.column_reference')}:{' '}
                      {selectedEntry.reference_number && selectedEntry.reference_number !== '-' ? (
                        <span
                          onClick={() => handleTransactionClick(selectedEntry.reference_type, selectedEntry.reference_number)}
                          className="text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer font-black"
                        >
                          {selectedEntry.reference_number}
                        </span>
                      ) : (
                        '-'
                      )}
                    </p>
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
                    <p className="text-sm font-bold text-zinc-900">{formatDate(selectedEntry.date)}</p>
                  </div>
                  <div className={`p-4 bg-zinc-50 rounded-2xl ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">{language === 'ar' ? 'نوع الحركة / المستند' : t('journal.type')}</p>
                    <p className="text-sm font-bold text-zinc-900">{getDocumentTypeName(selectedEntry.reference_type, selectedEntry.description, selectedEntry.reference_number, language)}</p>
                  </div>
                  <div className={`p-4 bg-emerald-50 rounded-2xl ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">{t('journal.column_debit')}</p>
                    <p className="text-sm font-black text-emerald-600">{formatMoney(selectedEntry.total_debit)}</p>
                  </div>
                  <div className={`p-4 bg-emerald-50 rounded-2xl ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">{t('journal.column_credit')}</p>
                    <p className="text-sm font-black text-emerald-600">{formatMoney(selectedEntry.total_credit)}</p>
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
                            <p className="text-sm font-bold text-zinc-900">{item.account_name || accounts.find(a => a.id === item.account_id)?.name || ''}</p>
                            {(item.customer_name || item.supplier_name) && (
                              <p className="text-[10px] text-emerald-600 font-black mt-0.5">
                                {item.customer_name || item.supplier_name}
                              </p>
                            )}
                            {item.description && <p className="text-[10px] text-zinc-400 font-medium">{item.description}</p>}
                          </td>
                          <td className="px-4 py-3 text-sm font-black text-emerald-600 text-center">
                            {item.debit > 0 ? formatMoney(item.debit) : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm font-black text-emerald-600 text-center">
                            {item.credit > 0 ? formatMoney(item.credit) : '-'}
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
                <button 
                  onClick={() => {
                    if (selectedEntry) {
                      printDocument('journal_entries', selectedEntry.id);
                    }
                  }}
                  className={`px-6 py-2.5 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}
                >
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
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
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
                  className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
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
