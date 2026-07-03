import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ActivityLog } from '../types';
import { 
  Search, Clock, User, Activity, Filter, RefreshCw, Layers, 
  ShieldCheck, ExternalLink, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Calendar, 
  Download, FileSpreadsheet, Printer, CheckCircle2, XCircle, 
  Smartphone, Monitor, Tablet, Globe, RotateCcw 
} from 'lucide-react';
import { dbService } from '../services/dbService';
import { formatDateTime } from '../utils/formatUtils';
import { useLanguage } from '../contexts/LanguageContext';
import { EXPECTED_SCHEMA } from '../lib/schema-registry';

export const ActivityLogPage: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Advanced Filters State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // all, success, failed
  const [deviceFilter, setDeviceFilter] = useState('all');
  const [browserFilter, setBrowserFilter] = useState('all');
  const [ipFilter, setIpFilter] = useState('');

  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const fetchLogs = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [auditData, activityData] = await Promise.all([
        dbService.listAll<any>('audit_logs').catch(() => []),
        dbService.listAll<any>('activity_logs').catch(() => [])
      ]);

      // Normalize activity_logs data (Legacy)
      const normalizedActivity = activityData.map(l => {
        let mod = l.module || 'SYSTEM';
        let act = l.action || '';
        
        if (l.action && l.action.includes(':')) {
          const parts = l.action.split(':');
          mod = parts[0] || 'SYSTEM';
          act = parts[1] || l.action;
        } else if (l.entity) {
          mod = typeof l.entity === 'string' ? l.entity : 'SYSTEM';
        }
        
        return {
          id: String(l.id),
          user_id: l.user_id,
          username: l.username || '',
          user_email: l.user_email || '',
          company_id: l.company_id || '',
          created_at: l.created_at || l.timestamp || new Date().toISOString(),
          module: mod,
          action: act || l.action,
          details: l.details || '',
          ip_address: l.ip_address || '0.0.0.0',
          browser: 'Unknown',
          operating_system: 'Unknown',
          device: 'Desktop',
          branch: 'Main',
          record_name: '',
          record_id: l.document_id || '',
          old_values: l.changes || {},
          new_values: {},
          success: true,
          execution_time: 0
        };
      });

      // Normalize audit_logs data (Upgraded)
      const normalizedAudit = auditData.map(l => ({
        id: String(l.id),
        user_id: l.user_id || '',
        username: l.username || '',
        user_email: l.user_email || '',
        company_id: l.company_id || '',
        created_at: l.created_at || new Date().toISOString(),
        module: l.module || 'SYSTEM',
        action: l.action || '',
        details: l.details || '',
        ip_address: l.ip_address || '0.0.0.0',
        browser: l.browser || 'Unknown',
        operating_system: l.operating_system || 'Unknown',
        device: l.device || 'Desktop',
        branch: l.branch || 'Main',
        record_name: l.record_name || '',
        record_id: l.record_id || l.entity_id || '',
        old_values: l.old_values || (l.changes?.before) || {},
        new_values: l.new_values || (l.changes?.after) || {},
        success: l.success !== false,
        execution_time: Number(l.execution_time || 0)
      }));

      // Combine and sort DESC
      const combined = [...normalizedAudit, ...normalizedActivity];
      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setLogs(combined);
    } catch (error) {
      console.error('Failed to fetch audit/activity logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [user]);

  // Reset all filters
  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setUserFilter('all');
    setCompanyFilter('all');
    setBranchFilter('all');
    setModuleFilter('all');
    setActionFilter('all');
    setStatusFilter('all');
    setDeviceFilter('all');
    setBrowserFilter('all');
    setIpFilter('');
    setSearchTerm('');
    setPage(1);
  };

  // Compile Modules list dynamically: database tables + log modules
  const dynamicModulesList = React.useMemo(() => {
    const schemaKeys = Object.keys(EXPECTED_SCHEMA).map(k => k.replace(/_/g, ' ').toUpperCase());
    const logModules = logs.map(l => String(l.module).toUpperCase()).filter(Boolean);
    const combined = Array.from(new Set([...schemaKeys, ...logModules]));
    return combined.sort();
  }, [logs]);

  // Extract unique filter dropdown values from log data
  const uniqueUsers = Array.from(new Set(logs.map(l => l.username).filter(Boolean))).sort();
  const uniqueCompanies = Array.from(new Set(logs.map(l => l.company_id).filter(Boolean))).sort();
  const uniqueBranches = Array.from(new Set(logs.map(l => (l as any).branch).filter(Boolean))).sort();
  const uniqueActions = Array.from(new Set(logs.map(l => l.action).filter(Boolean))).sort();
  const uniqueBrowsers = Array.from(new Set(logs.map(l => (l as any).browser).filter(Boolean))).sort();
  const uniqueDevices = Array.from(new Set(logs.map(l => (l as any).device).filter(Boolean))).sort();

  // Multi-attribute filtering logic
  const filteredLogs = logs.filter(log => {
    // 1. Search term match (searches all fields)
    const matchesSearch = 
      !searchTerm ||
      [
        log.username,
        log.user_email,
        log.module,
        log.action,
        log.details,
        log.ip_address,
        (log as any).browser,
        (log as any).operating_system,
        (log as any).device,
        (log as any).branch,
        (log as any).record_name,
        (log as any).record_id,
        JSON.stringify((log as any).old_values || {}),
        JSON.stringify((log as any).new_values || {})
      ].some(val => val && String(val).toLowerCase().includes(searchTerm.toLowerCase()));

    // 2. Filter matches
    const matchesStartDate = !startDate || new Date(log.created_at) >= new Date(startDate);
    const matchesEndDate = !endDate || new Date(log.created_at) <= new Date(`${endDate}T23:59:59`);
    const matchesUser = userFilter === 'all' || log.username === userFilter;
    const matchesCompany = companyFilter === 'all' || log.company_id === companyFilter;
    const matchesBranch = branchFilter === 'all' || (log as any).branch === branchFilter;
    const matchesModule = moduleFilter === 'all' || String(log.module).toUpperCase() === moduleFilter;
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    const matchesStatus = 
      statusFilter === 'all' || 
      (statusFilter === 'success' && (log as any).success) ||
      (statusFilter === 'failed' && !(log as any).success);
    const matchesDevice = deviceFilter === 'all' || (log as any).device === deviceFilter;
    const matchesBrowser = browserFilter === 'all' || (log as any).browser === browserFilter;
    const matchesIp = !ipFilter || (log.ip_address || '').includes(ipFilter);

    return (
      matchesSearch && matchesStartDate && matchesEndDate && matchesUser &&
      matchesCompany && matchesBranch && matchesModule && matchesAction &&
      matchesStatus && matchesDevice && matchesBrowser && matchesIp
    );
  });

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginatedLogs = filteredLogs.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  // Client-side export handlers
  const exportToCSV = () => {
    const headers = ['Timestamp', 'User', 'Email', 'Module', 'Action', 'Details', 'IP Address', 'Browser', 'OS', 'Device', 'Branch', 'Record Name', 'Record ID', 'Success', 'Execution Time (ms)'];
    const rows = filteredLogs.map(l => [
      l.created_at,
      l.username || '',
      l.user_email || '',
      l.module || '',
      l.action || '',
      l.details || '',
      l.ip_address || '',
      (l as any).browser || '',
      (l as any).operating_system || '',
      (l as any).device || '',
      (l as any).branch || '',
      (l as any).record_name || '',
      (l as any).record_id || '',
      (l as any).success !== false ? 'Success' : 'Failed',
      (l as any).execution_time || 0
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `activity_log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = () => {
    const headers = ['Timestamp', 'User', 'Email', 'Module', 'Action', 'Details', 'IP Address', 'Browser', 'OS', 'Device', 'Branch', 'Record Name', 'Record ID', 'Success', 'Execution Time (ms)'];
    const rows = filteredLogs.map(l => [
      l.created_at,
      l.username || '',
      l.user_email || '',
      l.module || '',
      l.action || '',
      l.details || '',
      l.ip_address || '',
      (l as any).browser || '',
      (l as any).operating_system || '',
      (l as any).device || '',
      (l as any).branch || '',
      (l as any).record_name || '',
      (l as any).record_id || '',
      (l as any).success !== false ? 'Success' : 'Failed',
      (l as any).execution_time || 0
    ]);

    let xml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8" /><style>table { border-collapse: collapse; } td, th { border: 1px solid #ddd; padding: 8px; }</style></head>
      <body><table>
        <thead><tr style="background-color: #f2f2f2;">${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(r => `<tr>${r.map(val => `<td>${val}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></body></html>
    `;

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `activity_log_${new Date().toISOString().slice(0, 10)}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getActionColor = (action: string = '') => {
    const act = action.toUpperCase();
    if (act.includes('CREATE') || act.includes('RESTORE') || act.includes('APPROVE')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (act.includes('DELETE') || act.includes('FAILED') || act.includes('REJECT')) return 'bg-red-50 text-red-700 border-red-200';
    if (act.includes('UPDATE') || act.includes('PASSWORD_CHANGE')) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (act.includes('LOGIN') || act.includes('LOGOUT')) return 'bg-purple-50 text-purple-700 border-purple-200';
    return 'bg-blue-50 text-blue-700 border-blue-200';
  };

  const getDeviceIcon = (device: string = '') => {
    const dev = device.toLowerCase();
    if (dev.includes('mobile') || dev.includes('iphone') || dev.includes('android')) return <Smartphone size={14} className="text-zinc-500" />;
    if (dev.includes('tablet') || dev.includes('ipad')) return <Tablet size={14} className="text-zinc-500" />;
    return <Monitor size={14} className="text-zinc-500" />;
  };

  const renderPagination = (position: 'top' | 'bottom') => {
    if (totalPages <= 1) return null;
    return (
      <div className={`p-6 bg-zinc-50/50 flex items-center justify-between print:hidden ${
        position === 'top' ? 'border-b border-zinc-100' : 'border-t border-zinc-100'
      }`}>
        <div className="flex items-center gap-2 text-xs text-zinc-500 font-medium">
          <span>{language === 'ar' ? 'عرض' : 'Show'}</span>
          <select
            value={itemsPerPage}
            onChange={(e) => {
              const val = e.target.value === 'all' ? filteredLogs.length : parseInt(e.target.value, 10);
              setItemsPerPage(val);
              setPage(1);
            }}
            className="bg-white border border-zinc-200 rounded-lg px-2 py-1 text-xs font-black text-zinc-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
            <option value="all">{language === 'ar' ? 'الكل' : 'All'}</option>
          </select>
          {language === 'ar' ? (
            <span>من أصل <span className="font-black text-zinc-900">{filteredLogs.length}</span> سجل</span>
          ) : (
            <span>of <span className="font-black text-zinc-900">{filteredLogs.length}</span> logs</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => setPage(language === 'ar' ? totalPages : 1)}
            disabled={language === 'ar' ? page === totalPages : page === 1}
            className="p-2 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 disabled:opacity-30 disabled:pointer-events-none transition-all"
            title={language === 'ar' ? "الصفحة الأخيرة" : "First Page"}
          >
            <ChevronsLeft size={16} />
          </button>
          
          <button 
            onClick={() => setPage(p => language === 'ar' ? Math.min(totalPages, p + 1) : Math.max(1, p - 1))}
            disabled={language === 'ar' ? page === totalPages : page === 1}
            className="p-2 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 disabled:opacity-30 disabled:pointer-events-none transition-all"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="flex items-center gap-1">
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i + 1}
                onClick={() => setPage(i + 1)}
                className={`w-8 h-8 rounded-xl font-bold text-xs transition-all ${
                  page === i + 1 
                    ? 'bg-emerald-600 text-white shadow-md' 
                    : 'bg-white border border-zinc-200 text-zinc-500 hover:border-emerald-300 hover:text-emerald-600'
                }`}
              >
                {i + 1}
              </button>
            )).slice(Math.max(0, page - 3), Math.min(totalPages, page + 2))}
          </div>

          <button 
            onClick={() => setPage(p => language === 'ar' ? Math.max(1, p - 1) : Math.min(totalPages, p + 1))}
            disabled={language === 'ar' ? page === 1 : page === totalPages}
            className="p-2 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 disabled:opacity-30 disabled:pointer-events-none transition-all"
          >
            <ChevronRight size={16} />
          </button>

          <button 
            onClick={() => setPage(language === 'ar' ? 1 : totalPages)}
            disabled={language === 'ar' ? page === 1 : page === totalPages}
            className="p-2 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 disabled:opacity-30 disabled:pointer-events-none transition-all"
            title={language === 'ar' ? "الصفحة الأولى" : "Last Page"}
          >
            <ChevronsRight size={16} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10 print:bg-white print:p-0 print:space-y-4" dir={dir}>
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="text-emerald-600 animate-pulse" size={26} />
            <h2 className="text-3xl font-black tracking-tight text-zinc-900 serif italic">
              {language === 'ar' ? 'سجل التدقيق المركزي المطور' : 'Upgraded Central Audit Log'}
            </h2>
          </div>
          <p className="text-zinc-500">
            {language === 'ar' 
              ? 'مراقبة حركات المستخدمين والأجهزة والعمليات على مستوى النظام بالكامل تلقائياً.' 
              : 'Monitor user operations, client devices, and processes system-wide automatically.'}
          </p>
        </div>
        
        {/* Actions Button Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-zinc-200 text-zinc-700 rounded-2xl hover:bg-zinc-50 transition-all font-bold text-sm shadow-sm"
          >
            <Download size={16} />
            {language === 'ar' ? 'تصدير CSV' : 'Export CSV'}
          </button>
          
          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-zinc-200 text-zinc-700 rounded-2xl hover:bg-zinc-50 transition-all font-bold text-sm shadow-sm"
          >
            <FileSpreadsheet size={16} className="text-emerald-600" />
            {language === 'ar' ? 'تصدير Excel' : 'Export Excel'}
          </button>

          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-zinc-200 text-zinc-700 rounded-2xl hover:bg-zinc-50 transition-all font-bold text-sm shadow-sm"
          >
            <Printer size={16} className="text-blue-600" />
            {language === 'ar' ? 'طباعة / PDF' : 'Print / PDF'}
          </button>

          <button 
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all font-bold shadow-md disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {language === 'ar' ? 'تحديث' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Print-only Header */}
      <div className="hidden print:block text-center border-b pb-4">
        <h1 className="text-2xl font-bold">{language === 'ar' ? 'تقرير سجل الحركات المركزي' : 'Central Audit Log Report'}</h1>
        <p className="text-sm text-zinc-500">{language === 'ar' ? 'تاريخ التصدير:' : 'Generated on:'} {new Date().toLocaleString()}</p>
      </div>

      {/* Advanced Filters Panel */}
      <div className="bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-xl shadow-zinc-100/50 space-y-4 print:hidden">
        
        {/* Universal Search and Date Range */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="relative col-span-1 lg:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input 
              type="text" 
              placeholder={language === 'ar' ? 'بحث بكل الحقول (القيم السابقة/الجديدة، IP...)' : 'Search all fields (old/new values, IP...)'}
              className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium text-sm"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            />
          </div>
          
          <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-2xl px-3 py-1.5 col-span-1 lg:col-span-2">
            <Calendar size={16} className="text-zinc-400" />
            <span className="text-xs font-bold text-zinc-500">{language === 'ar' ? 'من:' : 'From:'}</span>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="bg-transparent text-sm font-semibold outline-none text-zinc-700 flex-1"
            />
            <span className="text-xs font-bold text-zinc-500">{language === 'ar' ? 'إلى:' : 'To:'}</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="bg-transparent text-sm font-semibold outline-none text-zinc-700 flex-1"
            />
          </div>
        </div>

        {/* Dropdown Filters Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          
          {/* User Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{language === 'ar' ? 'المستخدم' : 'User'}</label>
            <select 
              value={userFilter}
              onChange={(e) => { setUserFilter(e.target.value); setPage(1); }}
              className="bg-zinc-50 border border-zinc-200 rounded-xl p-2 text-xs font-bold outline-none"
            >
              <option value="all">{language === 'ar' ? 'الكل' : 'All Users'}</option>
              {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>

          {/* Module Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{language === 'ar' ? 'الوجهة / القسم' : 'Module'}</label>
            <select 
              value={moduleFilter}
              onChange={(e) => { setModuleFilter(e.target.value); setPage(1); }}
              className="bg-zinc-50 border border-zinc-200 rounded-xl p-2 text-xs font-bold outline-none"
            >
              <option value="all">{language === 'ar' ? 'الكل' : 'All Modules'}</option>
              {dynamicModulesList.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Action Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{language === 'ar' ? 'الإجراء' : 'Action'}</label>
            <select 
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              className="bg-zinc-50 border border-zinc-200 rounded-xl p-2 text-xs font-bold outline-none"
            >
              <option value="all">{language === 'ar' ? 'الكل' : 'All Actions'}</option>
              {uniqueActions.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{language === 'ar' ? 'الحالة' : 'Status'}</label>
            <select 
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="bg-zinc-50 border border-zinc-200 rounded-xl p-2 text-xs font-bold outline-none"
            >
              <option value="all">{language === 'ar' ? 'الكل' : 'All Status'}</option>
              <option value="success">{language === 'ar' ? 'ناجح' : 'Success'}</option>
              <option value="failed">{language === 'ar' ? 'فشل' : 'Failed'}</option>
            </select>
          </div>

          {/* Device Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{language === 'ar' ? 'الجهاز' : 'Device'}</label>
            <select 
              value={deviceFilter}
              onChange={(e) => { setDeviceFilter(e.target.value); setPage(1); }}
              className="bg-zinc-50 border border-zinc-200 rounded-xl p-2 text-xs font-bold outline-none"
            >
              <option value="all">{language === 'ar' ? 'الكل' : 'All Devices'}</option>
              {uniqueDevices.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Browser Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{language === 'ar' ? 'المتصفح' : 'Browser'}</label>
            <select 
              value={browserFilter}
              onChange={(e) => { setBrowserFilter(e.target.value); setPage(1); }}
              className="bg-zinc-50 border border-zinc-200 rounded-xl p-2 text-xs font-bold outline-none"
            >
              <option value="all">{language === 'ar' ? 'الكل' : 'All Browsers'}</option>
              {uniqueBrowsers.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          {/* IP Input */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{language === 'ar' ? 'عنوان IP' : 'IP Address'}</label>
            <input 
              type="text"
              placeholder="e.g. 192.168"
              value={ipFilter}
              onChange={(e) => { setIpFilter(e.target.value); setPage(1); }}
              className="bg-zinc-50 border border-zinc-200 rounded-xl p-2 text-xs font-bold outline-none"
            />
          </div>

          {/* Branch Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{language === 'ar' ? 'الفرع' : 'Branch'}</label>
            <select 
              value={branchFilter}
              onChange={(e) => { setBranchFilter(e.target.value); setPage(1); }}
              className="bg-zinc-50 border border-zinc-200 rounded-xl p-2 text-xs font-bold outline-none"
            >
              <option value="all">{language === 'ar' ? 'الكل' : 'All Branches'}</option>
              {uniqueBranches.map(br => <option key={br} value={br}>{br}</option>)}
            </select>
          </div>

        </div>

        {/* Filters Summary & Reset */}
        <div className="flex justify-between items-center pt-2 border-t border-zinc-50">
          <span className="text-xs text-zinc-400">
            {language === 'ar' 
              ? `تم العثور على ${filteredLogs.length} سجل مطابقة` 
              : `Found ${filteredLogs.length} matching entries`}
          </span>
          
          <button 
            onClick={handleResetFilters}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-all"
          >
            <RotateCcw size={12} />
            {language === 'ar' ? 'إعادة ضبط الفلاتر' : 'Reset Filters'}
          </button>
        </div>

      </div>

      {/* Main Table Grid */}
      <div className="bg-white rounded-[2rem] border border-zinc-100 shadow-xl shadow-zinc-100/50 overflow-hidden print:border-none print:shadow-none">
        {renderPagination('top')}
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse min-w-[1100px] print:min-w-full">
            <thead>
              <tr className="bg-zinc-50/50 border-b border-zinc-100">
                <th className="px-6 py-5 text-xs font-black text-zinc-600 uppercase tracking-widest text-center w-14">#</th>
                <th className="px-6 py-5 text-xs font-black text-zinc-600 uppercase tracking-widest">{language === 'ar' ? 'المستخدم' : 'User'}</th>
                <th className="px-6 py-5 text-xs font-black text-zinc-600 uppercase tracking-widest">{language === 'ar' ? 'الفرع/الشركة' : 'Branch / Company'}</th>
                <th className="px-6 py-5 text-xs font-black text-zinc-600 uppercase tracking-widest">{language === 'ar' ? 'القسم' : 'Module'}</th>
                <th className="px-6 py-5 text-xs font-black text-zinc-600 uppercase tracking-widest text-center">{language === 'ar' ? 'الإجراء' : 'Action'}</th>
                <th className="px-6 py-5 text-xs font-black text-zinc-600 uppercase tracking-widest">{language === 'ar' ? 'تفاصيل السجل' : 'Details'}</th>
                <th className="px-6 py-5 text-xs font-black text-zinc-600 uppercase tracking-widest text-center">{language === 'ar' ? 'الجهاز والشبكة' : 'Device / IP'}</th>
                <th className="px-6 py-5 text-xs font-black text-zinc-600 uppercase tracking-widest">{language === 'ar' ? 'التوقيت' : 'Timestamp'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {loading ? (
                [1,2,3,4,5,6,7,8,9,10].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={8} className="px-6 py-5 h-16 bg-zinc-50/10" />
                  </tr>
                ))
              ) : paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-zinc-400 italic">
                      <Search size={48} className="opacity-20" />
                      <span>{language === 'ar' ? 'لا توجد سجلات مطابقة للبحث أو الفلترة' : 'No logs matching your search or filters'}</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedLogs.map((log, idx) => {
                const isExpanded = expandedRowId === log.id;
                return (
                  <React.Fragment key={log.id}>
                    <tr 
                      onClick={() => setExpandedRowId(isExpanded ? null : log.id)}
                      className="hover:bg-zinc-50/80 cursor-pointer transition-all group print:bg-transparent"
                    >
                      <td className="px-6 py-4 text-xs font-mono text-zinc-300 text-center">
                        {(page - 1) * itemsPerPage + idx + 1}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-zinc-100 text-zinc-600 flex items-center justify-center border border-zinc-200 group-hover:bg-emerald-100 group-hover:text-emerald-600 group-hover:border-emerald-200 transition-colors">
                            <User size={16} />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-zinc-900 text-sm">{log.username || '-'}</span>
                            {log.user_email && <span className="text-[10px] text-zinc-400 font-mono tracking-tight">{log.user_email}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col text-xs">
                          <span className="font-bold text-zinc-700">{(log as any).branch || 'Main'}</span>
                          <span className="text-[10px] text-zinc-400">{log.company_id || 'System'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="p-1 bg-zinc-50 rounded-lg border border-zinc-100">
                            <Layers size={12} className="text-zinc-500" />
                          </div>
                          <span className="text-xs font-bold text-zinc-700 tracking-tighter">{log.module || 'SYSTEM'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border tracking-wider ${getActionColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-0.5 max-w-xs">
                          <p className="text-xs text-zinc-600 leading-relaxed font-semibold truncate">
                            {log.details || '-'}
                          </p>
                          {((log as any).record_name || (log as any).record_id) && (
                            <span className="text-[9px] font-mono text-zinc-400 flex items-center gap-1">
                              <ExternalLink size={8} />
                              {(log as any).record_name || (log as any).record_id}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-500">
                            {getDeviceIcon((log as any).device)}
                            <span>{log.ip_address || '0.0.0.0'}</span>
                          </div>
                          <span className="text-[9px] text-zinc-400 font-mono italic">{(log as any).browser} / {(log as any).operating_system}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col text-xs text-zinc-500">
                          <div className="flex items-center gap-1.5 font-bold">
                            <Calendar size={10} className="text-emerald-500" />
                            <span>{formatDateTime(log.created_at).split(',')[0]}</span>
                          </div>
                          <div className="flex items-center gap-1.5 opacity-60 font-mono text-[10px]">
                            <Clock size={10} />
                            <span>{formatDateTime(log.created_at).split(',')[1]}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                    
                    {/* Expandable details view */}
                    {isExpanded && (
                      <tr className="bg-zinc-50/40 print:hidden animate-in slide-in-from-top-1 duration-200">
                        <td colSpan={8} className="px-8 py-5 border-y border-zinc-100 bg-zinc-50/20">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            
                            {/* Browser, OS, Network */}
                            <div className="bg-white p-4 rounded-2xl border border-zinc-100 shadow-sm space-y-2">
                              <h4 className="font-black text-xs text-zinc-800 border-b pb-1.5 flex items-center gap-1.5">
                                <Globe size={14} className="text-blue-500" />
                                {language === 'ar' ? 'بيانات الشبكة والعميل' : 'Client & Network Details'}
                              </h4>
                              <div className="space-y-1.5 text-xs text-zinc-600 font-medium">
                                <div className="flex justify-between"><span>{language === 'ar' ? 'المتصفح:' : 'Browser:'}</span><span className="font-bold text-zinc-800">{(log as any).browser}</span></div>
                                <div className="flex justify-between"><span>{language === 'ar' ? 'نظام التشغيل:' : 'OS:'}</span><span className="font-bold text-zinc-800">{(log as any).operating_system}</span></div>
                                <div className="flex justify-between"><span>{language === 'ar' ? 'نوع الجهاز:' : 'Device:'}</span><span className="font-bold text-zinc-800">{(log as any).device}</span></div>
                                <div className="flex justify-between"><span>{language === 'ar' ? 'الفرع:' : 'Branch:'}</span><span className="font-bold text-zinc-800">{(log as any).branch}</span></div>
                                <div className="flex justify-between"><span>{language === 'ar' ? 'عنوان IP:' : 'IP:'}</span><span className="font-mono text-zinc-800">{log.ip_address}</span></div>
                              </div>
                            </div>

                            {/* Execution / Performance */}
                            <div className="bg-white p-4 rounded-2xl border border-zinc-100 shadow-sm space-y-2">
                              <h4 className="font-black text-xs text-zinc-800 border-b pb-1.5 flex items-center gap-1.5">
                                <Clock size={14} className="text-emerald-500" />
                                {language === 'ar' ? 'أداء وجودة العملية' : 'Execution & Performance'}
                              </h4>
                              <div className="space-y-1.5 text-xs text-zinc-600 font-medium">
                                <div className="flex justify-between"><span>{language === 'ar' ? 'معرف السجل:' : 'Record ID:'}</span><span className="font-mono text-zinc-500">{(log as any).record_id || '-'}</span></div>
                                <div className="flex justify-between"><span>{language === 'ar' ? 'اسم السجل:' : 'Record Name:'}</span><span className="font-bold text-zinc-800">{(log as any).record_name || '-'}</span></div>
                                <div className="flex justify-between"><span>{language === 'ar' ? 'زمن التنفيذ:' : 'Execution Time:'}</span><span className="font-mono font-bold text-zinc-800">{(log as any).execution_time} ms</span></div>
                                <div className="flex justify-between"><span>{language === 'ar' ? 'النتيجة:' : 'Status:'}</span>
                                  <span className={`font-bold flex items-center gap-1 ${ (log as any).success ? 'text-emerald-600' : 'text-red-600' }`}>
                                    {(log as any).success ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                    {(log as any).success ? (language === 'ar' ? 'ناجحة' : 'Success') : (language === 'ar' ? 'فشلت' : 'Failed')}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Data Changes JSON */}
                            <div className="bg-white p-4 rounded-2xl border border-zinc-100 shadow-sm space-y-2">
                              <h4 className="font-black text-xs text-zinc-800 border-b pb-1.5">
                                {language === 'ar' ? 'القيم المسجلة والتبدلات' : 'Values & JSON Payload'}
                              </h4>
                              <div className="space-y-2 max-h-[140px] overflow-y-auto font-mono text-[9px] text-zinc-600">
                                {Object.keys((log as any).old_values || {}).length > 0 && (
                                  <div>
                                    <span className="text-[9px] font-bold text-zinc-400 block">{language === 'ar' ? 'القيم السابقة:' : 'Old Values:'}</span>
                                    <pre className="p-2 bg-zinc-50 rounded-lg overflow-x-auto">{JSON.stringify((log as any).old_values, null, 2)}</pre>
                                  </div>
                                )}
                                {Object.keys((log as any).new_values || {}).length > 0 && (
                                  <div>
                                    <span className="text-[9px] font-bold text-zinc-400 block">{language === 'ar' ? 'القيم الجديدة / المدخلات:' : 'New Values / Inputs:'}</span>
                                    <pre className="p-2 bg-zinc-50 rounded-lg overflow-x-auto">{JSON.stringify((log as any).new_values, null, 2)}</pre>
                                  </div>
                                )}
                                {(!Object.keys((log as any).old_values || {}).length && !Object.keys((log as any).new_values || {}).length) && (
                                  <span className="text-zinc-400 italic block pt-4 text-center">{language === 'ar' ? 'لا توجد قيم تبادلية مخزنة للعملية.' : 'No payload or schema changes stored.'}</span>
                                )}
                              </div>
                            </div>

                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {renderPagination('bottom')}
      </div>

      {/* Styled Printable layout */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:block, .print\\:block * {
            visibility: visible;
          }
          table, table * {
            visibility: visible;
          }
          .print\\:hidden {
            display: none !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 10px !important;
          }
          th, td {
            border: 1px solid #e2e8f0 !important;
            padding: 4px 6px !important;
          }
          th {
            background-color: #f8fafc !important;
            font-weight: bold !important;
          }
        }
      `}</style>

    </div>
  );
};
