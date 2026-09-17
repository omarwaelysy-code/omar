import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation, pageLabels } from '../contexts/NavigationContext';
import { ActivityLog } from '../types';
import { 
  Search, Clock, User, Activity, Filter, RefreshCw, Layers, 
  ShieldCheck, ExternalLink, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Calendar, 
  Download, FileSpreadsheet, Printer, CheckCircle2, XCircle, 
  Smartphone, Monitor, Tablet, Globe, RotateCcw,
  Trash2, Edit3, Eye, FileText, BookOpen, X, AlertTriangle, ChevronDown, Check
} from 'lucide-react';
import { dbService } from '../services/dbService';
import { formatDateTime } from '../utils/formatUtils';
import { useLanguage } from '../contexts/LanguageContext';
import { EXPECTED_SCHEMA } from '../lib/schema-registry';

export type ActivityLogMode = 'all' | 'cancellations' | 'modifications' | 'views' | 'prints';

interface ActivityLogPageProps {
  initialMode?: ActivityLogMode;
}

// Helper to extract Document Number and Journal Entry Number from any log item
export function extractDocAndEntryNumbers(
  log: any, 
  lookupMap?: Map<string, { docNumber?: string; entryNumber?: string }>
): { documentNumber: string; entryNumber: string } {
  let docNum = '';
  let entryNum = '';

  const nv = log.new_values && typeof log.new_values === 'object' ? log.new_values : {};
  const ov = log.old_values && typeof log.old_values === 'object' ? log.old_values : {};
  const meta = log.metadata && typeof log.metadata === 'object' ? log.metadata : {};

  // 1. Check lookup map by record_id or entity_id
  const recId = log.record_id || log.entity_id || log.document_id;
  if (recId && lookupMap && lookupMap.has(recId)) {
    const cached = lookupMap.get(recId);
    if (cached?.docNumber) docNum = cached.docNumber;
    if (cached?.entryNumber) entryNum = cached.entryNumber;
  }

  // 2. Direct document number fields in payload
  if (!docNum) {
    docNum = 
      nv.invoice_number || ov.invoice_number ||
      nv.invoiceNumber || ov.invoiceNumber ||
      nv.document_number || ov.document_number ||
      nv.doc_number || ov.doc_number ||
      nv.voucher_number || ov.voucher_number ||
      nv.receipt_number || ov.receipt_number ||
      nv.order_number || ov.order_number ||
      nv.return_number || ov.return_number ||
      nv.cheque_number || ov.cheque_number ||
      nv.transfer_number || ov.transfer_number ||
      nv.number || ov.number ||
      nv.code || ov.code ||
      meta.document_number || meta.invoice_number || '';
  }

  // 3. Direct entry number fields in payload
  if (!entryNum) {
    entryNum = 
      nv.entry_number || ov.entry_number ||
      nv.entryNumber || ov.entryNumber ||
      nv.journal_entry_number || ov.journal_entry_number ||
      nv.journal_number || ov.journal_number ||
      nv.entry_no || ov.entry_no ||
      meta.entry_number || '';
  }

  // 4. Module specific rules
  const mod = String(log.module || '').toUpperCase();
  if (mod.includes('JOURNAL') || mod.includes('ENTRY')) {
    if (!entryNum) {
      entryNum = nv.number || ov.number || (log.record_name && /^[A-Za-z0-9\-_]+$/.test(log.record_name) ? log.record_name : '');
    }
  }

  // 5. Fallback on record_name if it looks like a clean document number
  if (!docNum && log.record_name) {
    const rn = String(log.record_name).trim();
    if (/^[A-Za-z0-9\-_/]+$/.test(rn) && rn.length >= 2 && rn.length <= 40 && !['MAIN', 'DEFAULT', 'SYSTEM', 'NULL', 'UNDEFINED'].includes(rn.toUpperCase())) {
      if (mod.includes('JOURNAL')) {
        if (!entryNum) entryNum = rn;
      } else {
        docNum = rn;
      }
    }
  }

  // 6. Regex fallback on details string
  const textToScan = `${log.details || ''} ${log.record_name || ''}`;
  if (!docNum) {
    const docMatch = textToScan.match(/(?:فاتورة|مستند|إذن|سند|رقم|invoice|doc|receipt|voucher|order)[\s:_\-#]*([A-Za-z0-9\-_/]{3,30})/i);
    if (docMatch && docMatch[1]) {
      docNum = docMatch[1];
    }
  }

  if (!entryNum) {
    const entryMatch = textToScan.match(/(?:قيد|اليومية|entry|journal)[\s:_\-#]*([A-Za-z0-9\-_/]{1,25})/i);
    if (entryMatch && entryMatch[1]) {
      entryNum = entryMatch[1];
    }
  }

  return {
    documentNumber: docNum ? String(docNum).trim() : '',
    entryNumber: entryNum ? String(entryNum).trim() : ''
  };
}

// Function to classify actions into the 4 specialized modes
export function matchesActionCategory(action: string, details: string, mode: ActivityLogMode): boolean {
  if (mode === 'all') return true;

  const act = (action || '').toUpperCase();
  const det = (details || '').toUpperCase();
  const combined = `${act} ${det}`;

  if (mode === 'cancellations') {
    return (
      act.includes('DELETE') ||
      act.includes('CANCEL') ||
      act.includes('VOID') ||
      act.includes('REMOVE') ||
      act.includes('REJECT') ||
      act.includes('SUSPEND') ||
      act.includes('DISMISS') ||
      act.includes('DEACTIVATE') ||
      combined.includes('حذف') ||
      combined.includes('إلغاء') ||
      combined.includes('شطب') ||
      combined.includes('رفض') ||
      combined.includes('إيقاف')
    );
  }

  if (mode === 'prints') {
    return (
      act.includes('PRINT') ||
      act.includes('EXPORT') ||
      act.includes('REPORT') ||
      act.includes('DOWNLOAD') ||
      act.includes('PDF') ||
      act.includes('EXCEL') ||
      act.includes('CSV') ||
      combined.includes('طباعة') ||
      combined.includes('تصدير') ||
      combined.includes('تقرير') ||
      combined.includes('تحميل')
    );
  }

  if (mode === 'views') {
    // Exclude print actions
    if (matchesActionCategory(action, details, 'prints')) return false;

    return (
      act.includes('SCREEN_VISIT') ||
      act.includes('VIEW') ||
      act.includes('LOGIN') ||
      act.includes('LOGOUT') ||
      act.includes('ACCESS') ||
      act.includes('OPEN') ||
      act.includes('BROWSE') ||
      act.includes('SESSION') ||
      act.includes('FILTER') ||
      act.includes('SEARCH') ||
      act.includes('REFRESH') ||
      combined.includes('زيارة شاشة') ||
      combined.includes('دخول') ||
      combined.includes('خروج') ||
      combined.includes('مشاهدة') ||
      combined.includes('عرض') ||
      combined.includes('استعراض') ||
      combined.includes('زيارة') ||
      combined.includes('فتح')
    );
  }

  if (mode === 'modifications') {
    // Exclude cancellations, views, and prints
    if (matchesActionCategory(action, details, 'cancellations')) return false;
    if (matchesActionCategory(action, details, 'prints')) return false;
    if (matchesActionCategory(action, details, 'views')) return false;

    return (
      act.includes('CREATE') ||
      act.includes('UPDATE') ||
      act.includes('EDIT') ||
      act.includes('INSERT') ||
      act.includes('ADD') ||
      act.includes('POST') ||
      act.includes('SAVE') ||
      act.includes('RESTORE') ||
      act.includes('APPROVE') ||
      act.includes('PATCH') ||
      act.includes('PUT') ||
      act.includes('SYNC') ||
      combined.includes('إنشاء') ||
      combined.includes('إضافة') ||
      combined.includes('تعديل') ||
      combined.includes('تحديث') ||
      combined.includes('حفظ') ||
      combined.includes('اعتماد') ||
      combined.includes('ترحيل') ||
      combined.includes('استعادة')
    );
  }

  return true;
}

// Format stay duration nicely in human readable format
export function formatStayDuration(log: any, language: string): string {
  const meta = log.metadata || {};
  let sec = meta.duration_seconds || (log.execution_time ? Math.round(log.execution_time / 1000) : 0);
  if (!sec && meta.duration_text) return meta.duration_text;
  if (!sec || sec < 1) return '-';
  const min = Math.floor(sec / 60);
  const remainingSec = sec % 60;
  if (language === 'ar') {
    if (min > 0) {
      return remainingSec > 0 ? `${min} د و ${remainingSec} ث` : `${min} دقيقة`;
    }
    return `${remainingSec} ثانية`;
  }
  if (min > 0) {
    return remainingSec > 0 ? `${min}m ${remainingSec}s` : `${min}m`;
  }
  return `${remainingSec}s`;
}

// Convert module/screen code to clean Arabic display name
export function getDisplayScreenName(moduleName: string, meta: any, language: string): string {
  if (meta?.screen_title) return meta.screen_title;
  const modKey = String(moduleName || '').toLowerCase().replace(/[\s-]/g, '_');
  if (pageLabels[modKey]) return pageLabels[modKey];
  // If already Arabic text
  if (/[\u0600-\u06FF]/.test(moduleName)) return moduleName;
  return moduleName || (language === 'ar' ? 'شاشة النظام' : 'System Screen');
}

export const ActivityLogPage: React.FC<ActivityLogPageProps> = ({ initialMode = 'all' }) => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { closeTab } = useNavigation();
  
  const [activeMode, setActiveMode] = useState<ActivityLogMode>(initialMode);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoadedData, setHasLoadedData] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Users Multi-Select State
  const [availableUsers, setAvailableUsers] = useState<{ id: string; name?: string; username: string; email?: string }[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>(['all']);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [userSearchText, setUserSearchText] = useState('');
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // Advanced Filters State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // all, success, failed
  const [deviceFilter, setDeviceFilter] = useState('all');
  const [browserFilter, setBrowserFilter] = useState('all');
  const [ipFilter, setIpFilter] = useState('');
  
  // Document & Entry filters
  const [documentNumberFilter, setDocumentNumberFilter] = useState('');
  const [entryNumberFilter, setEntryNumberFilter] = useState('');

  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Synchronize mode if prop changes
  useEffect(() => {
    setActiveMode(initialMode);
    setPage(1);
  }, [initialMode]);

  // Click outside listener for user dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Pre-load company users list on mount (lightweight metadata only)
  useEffect(() => {
    if (!user) return;
    const loadCompanyUsers = async () => {
      try {
        const params = user.company_id ? { company_id: user.company_id } : undefined;
        const usersData = await dbService.list<any>('users', params).catch(() => []);
        if (Array.isArray(usersData) && usersData.length > 0) {
          const list = usersData.map(u => ({
            id: u.id,
            name: u.name || u.username,
            username: u.username || u.name || u.email || 'مستخدم',
            email: u.email || ''
          }));
          setAvailableUsers(list);
        }
      } catch (err) {
        console.warn('Failed to load users for filter:', err);
      }
    };
    loadCompanyUsers();
  }, [user]);

  // Dedicated fetchLogs: only runs on explicit user click / request
  const fetchLogs = async () => {
    if (!user) return;
    setLoading(true);
    setHasLoadedData(true);
    try {
      const params: any = user.company_id ? { company_id: user.company_id } : {};
      if (selectedUsers.length > 0 && !selectedUsers.includes('all')) {
        params.user_ids = selectedUsers.join(',');
      }
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const [auditData, activityData] = await Promise.all([
        dbService.list<any>('audit_logs', params).catch(() => []),
        dbService.list<any>('activity_logs', params).catch(() => [])
      ]);

      // Normalize activity_logs data (Legacy)
      const normalizedActivity = (Array.isArray(activityData) ? activityData : []).map(l => {
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
          id: String(l.id || Math.random().toString(36).substr(2, 9)),
          user_id: l.user_id || '',
          username: l.username || l.user_email || 'مستخدم',
          user_email: l.user_email || l.username || '',
          company_id: l.company_id || '',
          created_at: l.created_at || l.timestamp || new Date().toISOString(),
          module: mod,
          action: act || l.action || 'VIEW',
          details: l.details || '',
          ip_address: l.ip_address || '127.0.0.1',
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
      const normalizedAudit = (Array.isArray(auditData) ? auditData : []).map(l => ({
        id: String(l.id || Math.random().toString(36).substr(2, 9)),
        user_id: l.user_id || '',
        username: l.username || l.user_email || 'مستخدم',
        user_email: l.user_email || l.username || '',
        company_id: l.company_id || '',
        created_at: l.created_at || new Date().toISOString(),
        module: l.module || 'SYSTEM',
        action: l.action || 'VIEW',
        details: l.details || '',
        ip_address: l.ip_address || '127.0.0.1',
        browser: l.browser || 'Unknown',
        operating_system: l.operating_system || 'Unknown',
        device: l.device || 'Desktop',
        branch: l.branch || 'Main',
        record_name: l.record_name || '',
        record_id: l.record_id || l.entity_id || '',
        old_values: l.old_values || (l.changes?.before) || {},
        new_values: l.new_values || (l.changes?.after) || {},
        metadata: l.metadata || {},
        success: l.success !== false,
        execution_time: Number(l.execution_time || 0)
      }));

      // Combine and sort DESC
      const combinedMap = new Map<string, ActivityLog>();
      [...normalizedAudit, ...normalizedActivity].forEach(item => {
        const key = item.id && item.id.length > 20 ? item.id : `${item.user_id}_${item.created_at}_${item.action}`;
        if (!combinedMap.has(key)) {
          combinedMap.set(key, item as any);
        }
      });
      const combined = Array.from(combinedMap.values());
      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setLogs(combined);
      setPage(1);
    } catch (error) {
      console.error('Failed to fetch audit/activity logs:', error);
    } finally {
      setLoading(false);
    }
  };

  // Reset all filters
  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedUsers(['all']);
    setCompanyFilter('all');
    setBranchFilter('all');
    setModuleFilter('all');
    setActionFilter('all');
    setStatusFilter('all');
    setDeviceFilter('all');
    setBrowserFilter('all');
    setIpFilter('');
    setDocumentNumberFilter('');
    setEntryNumberFilter('');
    setSearchTerm('');
    setPage(1);
  };

  // Compile full user options (from users table and existing logs)
  const userOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; username: string; email?: string }>();
    availableUsers.forEach(u => {
      map.set(u.username || u.name, u);
    });
    logs.forEach(l => {
      if (l.username && !map.has(l.username)) {
        map.set(l.username, { id: l.user_id || l.username, name: l.username, username: l.username, email: l.user_email });
      }
    });
    return Array.from(map.values()).sort((a, b) => (a.name || a.username).localeCompare(b.name || b.username));
  }, [availableUsers, logs]);

  const filteredUserOptions = useMemo(() => {
    if (!userSearchText.trim()) return userOptions;
    const term = userSearchText.trim().toLowerCase();
    return userOptions.filter(u => 
      (u.name && u.name.toLowerCase().includes(term)) ||
      (u.username && u.username.toLowerCase().includes(term)) ||
      (u.email && u.email.toLowerCase().includes(term))
    );
  }, [userOptions, userSearchText]);

  // Handle multi-user selection toggle
  const toggleUser = (uname: string) => {
    setPage(1);
    if (uname === 'all') {
      if (selectedUsers.includes('all')) {
        setSelectedUsers([]);
      } else {
        setSelectedUsers(['all']);
      }
      return;
    }

    let next = selectedUsers.filter(u => u !== 'all');
    if (next.includes(uname)) {
      next = next.filter(u => u !== uname);
    } else {
      next.push(uname);
    }

    if (next.length === userOptions.length || next.length === 0) {
      setSelectedUsers(next.length === 0 ? [] : ['all']);
    } else {
      setSelectedUsers(next);
    }
  };

  const getUserButtonLabel = () => {
    if (selectedUsers.length === 0) return language === 'ar' ? 'اختر المستخدمين...' : 'Select Users...';
    if (selectedUsers.includes('all') || (userOptions.length > 0 && selectedUsers.length === userOptions.length)) {
      return language === 'ar' ? 'الكل (جميع المستخدمين)' : 'All Users';
    }
    if (selectedUsers.length === 1) {
      const found = userOptions.find(u => u.username === selectedUsers[0] || u.id === selectedUsers[0]);
      return found?.name || found?.username || selectedUsers[0];
    }
    return language === 'ar' ? `${selectedUsers.length} مستخدمين محددين` : `${selectedUsers.length} users selected`;
  };

  // Compile Modules list dynamically
  const dynamicModulesList = useMemo(() => {
    const schemaKeys = Object.keys(EXPECTED_SCHEMA).map(k => k.replace(/_/g, ' ').toUpperCase());
    const logModules = logs.map(l => String(l.module).toUpperCase()).filter(Boolean);
    const combined = Array.from(new Set([...schemaKeys, ...logModules]));
    return combined.sort();
  }, [logs]);

  // Extract unique filter dropdown values
  const uniqueBranches = useMemo(() => Array.from(new Set(logs.map(l => (l as any).branch).filter(Boolean))).sort(), [logs]);
  const uniqueBrowsers = useMemo(() => Array.from(new Set(logs.map(l => (l as any).browser).filter(Boolean))).sort(), [logs]);
  const uniqueDevices = useMemo(() => Array.from(new Set(logs.map(l => (l as any).device).filter(Boolean))).sort(), [logs]);

  // Filter logs by activeMode first, then by the user filters
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // 0. Screen Mode Category Match
      if (!matchesActionCategory(log.action, log.details, activeMode)) {
        return false;
      }

      // Extract document number & entry number
      const { documentNumber, entryNumber } = extractDocAndEntryNumbers(log);

      // 1. Search term match (searches all fields + doc number + entry number)
      const matchesSearch = 
        !searchTerm ||
        [
          log.username,
          log.user_email,
          log.module,
          log.action,
          log.details,
          log.ip_address,
          documentNumber,
          entryNumber,
          (log as any).browser,
          (log as any).operating_system,
          (log as any).device,
          (log as any).branch,
          (log as any).record_name,
          (log as any).record_id,
          JSON.stringify((log as any).old_values || {}),
          JSON.stringify((log as any).new_values || {})
        ].some(val => val && String(val).toLowerCase().includes(searchTerm.trim().toLowerCase()));

      // 2. Specific Document Number & Entry Number Filters
      const matchesDocNumber = !documentNumberFilter || documentNumber.toLowerCase().includes(documentNumberFilter.trim().toLowerCase());
      const matchesEntryNumber = !entryNumberFilter || entryNumber.toLowerCase().includes(entryNumberFilter.trim().toLowerCase());

      // 3. Date & Category Filters
      const matchesStartDate = !startDate || new Date(log.created_at) >= new Date(startDate);
      const matchesEndDate = !endDate || new Date(log.created_at) <= new Date(`${endDate}T23:59:59`);
      
      // Multi-User Match
      const matchesUser = 
        selectedUsers.includes('all') ||
        selectedUsers.includes(log.username) ||
        selectedUsers.includes(log.user_email) ||
        selectedUsers.includes(log.user_id);

      const matchesCompany = companyFilter === 'all' || log.company_id === companyFilter;
      const matchesBranch = branchFilter === 'all' || (log as any).branch === branchFilter;
      const matchesModule = moduleFilter === 'all' || String(log.module || '').toUpperCase() === moduleFilter.toUpperCase();
      const matchesAction = actionFilter === 'all' || String(log.action || '').toUpperCase() === actionFilter.toUpperCase();
      const matchesStatus = 
        statusFilter === 'all' || 
        (statusFilter === 'success' && (log as any).success) ||
        (statusFilter === 'failed' && !(log as any).success);
      const matchesDevice = deviceFilter === 'all' || (log as any).device === deviceFilter;
      const matchesBrowser = browserFilter === 'all' || (log as any).browser === browserFilter;
      const matchesIp = !ipFilter || (log.ip_address || '').includes(ipFilter.trim());

      return (
        matchesSearch && matchesDocNumber && matchesEntryNumber &&
        matchesStartDate && matchesEndDate && matchesUser &&
        matchesCompany && matchesBranch && matchesModule && matchesAction &&
        matchesStatus && matchesDevice && matchesBrowser && matchesIp
      );
    });
  }, [
    logs, activeMode, searchTerm, documentNumberFilter, entryNumberFilter,
    startDate, endDate, selectedUsers, companyFilter, branchFilter,
    moduleFilter, actionFilter, statusFilter, deviceFilter, browserFilter, ipFilter
  ]);

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginatedLogs = filteredLogs.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  // Client-side export handlers with Document Number & Journal Entry Number
  const exportToCSV = () => {
    const headers = [
      'Timestamp', 'User', 'Email', 'Module', 'Action', 
      'Document Number', 'Journal Entry Number', 
      'Details', 'IP Address', 'Browser', 'OS', 'Device', 'Branch', 
      'Record Name', 'Record ID', 'Success', 'Execution Time (ms)'
    ];
    const rows = filteredLogs.map(l => {
      const { documentNumber, entryNumber } = extractDocAndEntryNumbers(l);
      return [
        l.created_at,
        l.username || '',
        l.user_email || '',
        l.module || '',
        l.action || '',
        documentNumber || '',
        entryNumber || '',
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
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${activeMode}_activity_log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = () => {
    const headers = [
      'Timestamp', 'User', 'Email', 'Module', 'Action', 
      'Document Number', 'Journal Entry Number', 
      'Details', 'IP Address', 'Browser', 'OS', 'Device', 'Branch', 
      'Record Name', 'Record ID', 'Success', 'Execution Time (ms)'
    ];
    const rows = filteredLogs.map(l => {
      const { documentNumber, entryNumber } = extractDocAndEntryNumbers(l);
      return [
        l.created_at,
        l.username || '',
        l.user_email || '',
        l.module || '',
        l.action || '',
        documentNumber || '',
        entryNumber || '',
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
      ];
    });

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
    link.setAttribute("download", `${activeMode}_activity_log_${new Date().toISOString().slice(0, 10)}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getActionColor = (action: string = '') => {
    const act = action.toUpperCase();
    if (act.includes('CREATE') || act.includes('RESTORE') || act.includes('APPROVE') || act.includes('POST')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (act.includes('DELETE') || act.includes('FAILED') || act.includes('REJECT') || act.includes('CANCEL') || act.includes('VOID')) return 'bg-red-50 text-red-700 border-red-200';
    if (act.includes('UPDATE') || act.includes('EDIT') || act.includes('PASSWORD_CHANGE')) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (act.includes('LOGIN') || act.includes('LOGOUT')) return 'bg-purple-50 text-purple-700 border-purple-200';
    if (act.includes('PRINT') || act.includes('EXPORT') || act.includes('REPORT')) return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    return 'bg-blue-50 text-blue-700 border-blue-200';
  };

  const getDeviceIcon = (device: string = '') => {
    const dev = device.toLowerCase();
    if (dev.includes('mobile') || dev.includes('iphone') || dev.includes('android')) return <Smartphone size={14} className="text-zinc-500" />;
    if (dev.includes('tablet') || dev.includes('ipad')) return <Tablet size={14} className="text-zinc-500" />;
    return <Monitor size={14} className="text-zinc-500" />;
  };

  // Screen header configuration based on activeMode
  const modeConfig = {
    all: {
      title: language === 'ar' ? 'سجل التدقيق المركزي الشامل' : 'Central Audit Log',
      subtitle: language === 'ar' ? 'مراقبة حركات المستخدمين والأجهزة والعمليات على مستوى النظام بالكامل تلقائياً.' : 'Monitor user operations, client devices, and processes system-wide automatically.',
      icon: ShieldCheck,
      iconColor: 'text-emerald-600',
    },
    cancellations: {
      title: language === 'ar' ? 'سجل الإلغاءات والمحذوفات' : 'Cancellations & Deletions Log',
      subtitle: language === 'ar' ? 'مراقبة وتدقيق كافة المستندات والعمليات التي تم إلغاؤها أو حذفها مع تفاصيل المنفذ.' : 'Audit all deleted, voided, or cancelled documents and operations.',
      icon: Trash2,
      iconColor: 'text-red-600',
    },
    modifications: {
      title: language === 'ar' ? 'سجل الإنشاء والتعديلات' : 'Creations & Modifications Log',
      subtitle: language === 'ar' ? 'تتبع حركات إنشاء المستندات الجديدة وكافة التعديلات المسجلة مع القيم القديمة والجديدة.' : 'Track new records creation and modifications with before/after changes.',
      icon: Edit3,
      iconColor: 'text-emerald-600',
    },
    views: {
      title: language === 'ar' ? 'سجل الدخول والمشاهدات' : 'Logins & Views Log',
      subtitle: language === 'ar' ? 'متابعة جلسات تسجيل الدخول والخروج ومشاهدة واستعراض الشاشات والحركات.' : 'Track user login/logout sessions and screen browsing history.',
      icon: Eye,
      iconColor: 'text-blue-600',
    },
    prints: {
      title: language === 'ar' ? 'سجل الطباعة والتقارير' : 'Prints & Reports Log',
      subtitle: language === 'ar' ? 'تدقيق عمليات طباعة الفواتير والسندات والقيود واستخراج التقارير وتصدير الملفات.' : 'Audit printing of invoices, vouchers, and generated system reports.',
      icon: Printer,
      iconColor: 'text-indigo-600',
    }
  }[activeMode];

  const CurrentIcon = modeConfig.icon;

  const renderPagination = (position: 'top' | 'bottom') => {
    if (totalPages <= 1) return null;
    return (
      <div className={`p-4 xl:p-6 bg-zinc-50/50 flex items-center justify-between print:hidden ${
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

  const handleClose = () => {
    const currentTabId = 
      activeMode === 'cancellations' ? 'activity_log_cancellations' :
      activeMode === 'modifications' ? 'activity_log_modifications' :
      activeMode === 'views' ? 'activity_log_views' :
      activeMode === 'prints' ? 'activity_log_prints' : 'activity_log';
    closeTab(currentTabId);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300 pb-10 print:bg-white print:p-0 print:space-y-4" dir={dir}>
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden bg-white p-5 rounded-2xl border border-zinc-100 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CurrentIcon className={modeConfig.iconColor} size={24} />
            <h2 className="text-2xl font-black tracking-tight text-zinc-900">
              {modeConfig.title}
            </h2>
          </div>
          <p className="text-xs text-zinc-500">
            {modeConfig.subtitle}
          </p>
        </div>
        
        {/* Actions Button Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <button 
            type="button"
            onClick={exportToCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-zinc-200 text-zinc-700 rounded-xl hover:bg-zinc-50 transition-all font-bold text-xs shadow-2xs"
          >
            <Download size={14} />
            <span>{language === 'ar' ? 'تصدير CSV' : 'Export CSV'}</span>
          </button>
          
          <button 
            type="button"
            onClick={exportToExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-zinc-200 text-zinc-700 rounded-xl hover:bg-zinc-50 transition-all font-bold text-xs shadow-2xs"
          >
            <FileSpreadsheet size={14} className="text-emerald-600" />
            <span>{language === 'ar' ? 'تصدير Excel' : 'Export Excel'}</span>
          </button>

          <button 
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-zinc-200 text-zinc-700 rounded-xl hover:bg-zinc-50 transition-all font-bold text-xs shadow-2xs"
          >
            <Printer size={14} className="text-blue-600" />
            <span>{language === 'ar' ? 'طباعة / PDF' : 'Print / PDF'}</span>
          </button>

          <button 
            type="button"
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all font-bold text-xs shadow-xs disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>{language === 'ar' ? 'تحديث' : 'Refresh'}</span>
          </button>

          {/* Close Screen Button ( X ) */}
          <button
            type="button"
            onClick={handleClose}
            className="w-9 h-9 flex items-center justify-center bg-white text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-zinc-200 transition-all shadow-2xs active:scale-95 shrink-0"
            title={language === 'ar' ? 'إغلاق الشاشة' : 'Close Page'}
          >
            <X size={18} />
          </button>
        </div>
      </div>



      {/* Advanced Filter Section */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-100 shadow-xs space-y-4 print:hidden">
        
        {/* Row 1: Search + Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* General Search Input */}
          <div className="md:col-span-6 relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
            <input 
              type="text"
              placeholder={language === 'ar' ? 'بحث بكل الحقول (رقم المستند، رقم القيد، المستخدم، التفاصيل، IP...)' : 'Search all fields...'}
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pr-10 pl-4 py-2 text-xs font-bold outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Start Date */}
          <div className="md:col-span-3 flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-1.5">
            <span className="text-[10px] font-black text-zinc-400">{language === 'ar' ? 'من:' : 'From:'}</span>
            <input 
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="bg-transparent text-xs font-bold outline-none w-full"
            />
          </div>

          {/* End Date */}
          <div className="md:col-span-3 flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-1.5">
            <span className="text-[10px] font-black text-zinc-400">{language === 'ar' ? 'إلى:' : 'To:'}</span>
            <input 
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="bg-transparent text-xs font-bold outline-none w-full"
            />
          </div>
        </div>

        {/* Row 2: Document Number, Journal Entry Number, User, Module, Action, Status */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          
          {/* NEW: Document Number Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider flex items-center gap-1">
              <FileText size={11} className="text-emerald-600" />
              <span>{language === 'ar' ? 'رقم المستند' : 'Doc Number'}</span>
            </label>
            <input 
              type="text"
              placeholder={language === 'ar' ? 'e.g. INV-1001' : 'e.g. INV-1001'}
              value={documentNumberFilter}
              onChange={(e) => { setDocumentNumberFilter(e.target.value); setPage(1); }}
              className="bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-1.5 text-xs font-bold outline-none focus:border-emerald-500"
            />
          </div>

          {/* NEW: Journal Entry Number Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider flex items-center gap-1">
              <BookOpen size={11} className="text-blue-600" />
              <span>{language === 'ar' ? 'رقم القيد' : 'Entry No.'}</span>
            </label>
            <input 
              type="text"
              placeholder={language === 'ar' ? 'e.g. 105 أو JE-105' : 'e.g. 105'}
              value={entryNumberFilter}
              onChange={(e) => { setEntryNumberFilter(e.target.value); setPage(1); }}
              className="bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-1.5 text-xs font-bold outline-none focus:border-emerald-500"
            />
          </div>

          {/* Multi-Select User Filter */}
          <div className="flex flex-col gap-1 relative" ref={userDropdownRef}>
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider flex items-center justify-between">
              <span>{language === 'ar' ? 'المستخدم' : 'User'}</span>
              {!selectedUsers.includes('all') && selectedUsers.length > 0 && (
                <span className="text-[9px] px-1.5 py-0.2 bg-emerald-100 text-emerald-700 rounded-full font-bold">
                  {selectedUsers.length}
                </span>
              )}
            </label>
            
            <button
              type="button"
              onClick={() => setUserDropdownOpen(prev => !prev)}
              className="bg-zinc-50 hover:bg-zinc-100/80 border border-zinc-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-zinc-800 flex items-center justify-between transition-all cursor-pointer text-right w-full"
            >
              <span className="truncate pr-1">
                {getUserButtonLabel()}
              </span>
              <ChevronDown size={14} className={`text-zinc-400 shrink-0 transition-transform ${userDropdownOpen ? 'rotate-180 text-emerald-600' : ''}`} />
            </button>

            {/* Dropdown Menu with Checkboxes */}
            {userDropdownOpen && (
              <div className="absolute top-full mt-1.5 right-0 z-50 w-72 bg-white rounded-2xl shadow-xl border border-zinc-200 p-2.5 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
                {/* Search Input */}
                <div className="relative">
                  <Search size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    placeholder={language === 'ar' ? 'بحث عن مستخدم...' : 'Search user...'}
                    value={userSearchText}
                    onChange={(e) => setUserSearchText(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg pr-7 pl-2 py-1 text-xs outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-bold"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                {/* Option: Select All [✓] الكل */}
                <label 
                  onClick={() => toggleUser('all')}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-zinc-50/80 hover:bg-zinc-100/80 cursor-pointer text-xs font-black text-zinc-900 border border-zinc-100 select-none transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes('all')}
                    onChange={() => {}}
                    className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  />
                  <span>{language === 'ar' ? 'الكل (جميع المستخدمين)' : 'All Users'}</span>
                </label>

                {/* Individual Users List */}
                <div className="max-h-48 overflow-y-auto space-y-0.5 pr-0.5 divide-y divide-zinc-50">
                  {filteredUserOptions.length === 0 ? (
                    <div className="p-3 text-center text-xs text-zinc-400">
                      {language === 'ar' ? 'لا يوجد مستخدمين مطابقين' : 'No users found'}
                    </div>
                  ) : (
                    filteredUserOptions.map(u => {
                      const isChecked = selectedUsers.includes('all') || selectedUsers.includes(u.username) || selectedUsers.includes(u.id);
                      return (
                        <label
                          key={u.id || u.username}
                          onClick={() => toggleUser(u.username || u.id)}
                          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer text-xs transition-colors select-none ${
                            isChecked ? 'bg-emerald-50/60 text-emerald-950 font-bold' : 'hover:bg-zinc-50 text-zinc-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="truncate">{u.name || u.username}</span>
                            {u.email && u.email !== (u.name || u.username) && (
                              <span className="text-[10px] text-zinc-400 font-mono truncate">{u.email}</span>
                            )}
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>

                {/* Footer status */}
                <div className="pt-1.5 border-t border-zinc-100 flex items-center justify-between text-[11px]">
                  <span className="text-zinc-400 font-medium">
                    {selectedUsers.includes('all') 
                      ? (language === 'ar' ? 'تم اختيار الكل' : 'All selected')
                      : `${selectedUsers.length} ${language === 'ar' ? 'محدد' : 'selected'}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setUserDropdownOpen(false)}
                    className="px-3 py-1 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 text-xs shadow-2xs cursor-pointer"
                  >
                    {language === 'ar' ? 'تم' : 'Done'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Module / Department Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">{language === 'ar' ? 'القسم / الوجهة' : 'Module'}</label>
            <select 
              value={moduleFilter}
              onChange={(e) => { setModuleFilter(e.target.value); setPage(1); }}
              className="bg-zinc-50 border border-zinc-200 rounded-xl px-2 py-1.5 text-xs font-bold outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">{language === 'ar' ? 'الكل' : 'All Modules'}</option>
              {dynamicModulesList.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Device Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">{language === 'ar' ? 'الجهاز' : 'Device'}</label>
            <select 
              value={deviceFilter}
              onChange={(e) => { setDeviceFilter(e.target.value); setPage(1); }}
              className="bg-zinc-50 border border-zinc-200 rounded-xl px-2 py-1.5 text-xs font-bold outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">{language === 'ar' ? 'الكل' : 'All Devices'}</option>
              {uniqueDevices.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* IP Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">{language === 'ar' ? 'عنوان IP' : 'IP'}</label>
            <input 
              type="text" 
              placeholder="e.g. 192.168"
              value={ipFilter}
              onChange={(e) => { setIpFilter(e.target.value); setPage(1); }}
              className="bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-1.5 text-xs font-bold outline-none focus:border-emerald-500"
            />
          </div>

        </div>

        {/* Filters Summary & Reset */}
        <div className="flex justify-between items-center pt-2 border-t border-zinc-100">
          <span className="text-xs text-zinc-500 font-bold">
            {language === 'ar' 
              ? `تم العثور على ${filteredLogs.length} سجل مطابقة` 
              : `Found ${filteredLogs.length} matching entries`}
          </span>
          
          <button 
            type="button"
            onClick={handleResetFilters}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-all cursor-pointer"
          >
            <RotateCcw size={12} />
            <span>{language === 'ar' ? 'إعادة ضبط الفلاتر' : 'Reset Filters'}</span>
          </button>
        </div>

      </div>

      {/* Main Table Grid */}
      <div className="bg-white rounded-2xl border border-zinc-100 shadow-xs overflow-hidden print:border-none print:shadow-none">
        {renderPagination('top')}
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse min-w-[1250px] print:min-w-full">
            <thead>
              {activeMode === 'views' ? (
                /* Specialized Header for Logins, Views & User Behavior */
                <tr className="bg-zinc-50/70 border-b border-zinc-100">
                  <th className="px-4 py-3.5 text-xs font-black text-zinc-600 uppercase tracking-wider text-center w-12">#</th>
                  <th className="px-4 py-3.5 text-xs font-black text-zinc-600 uppercase tracking-wider">{language === 'ar' ? 'المستخدم' : 'User'}</th>
                  <th className="px-4 py-3.5 text-xs font-black text-zinc-600 uppercase tracking-wider">{language === 'ar' ? 'الشاشة / الوجهة' : 'Screen / Destination'}</th>
                  <th className="px-4 py-3.5 text-xs font-black text-zinc-600 uppercase tracking-wider text-center">{language === 'ar' ? 'نوع الحركة' : 'Activity Type'}</th>
                  <th className="px-4 py-3.5 text-xs font-black text-zinc-600 uppercase tracking-wider text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Clock size={12} className="text-amber-600" />
                      <span>{language === 'ar' ? 'مدة البقاء في الشاشة' : 'Stay Duration'}</span>
                    </div>
                  </th>
                  <th className="px-4 py-3.5 text-xs font-black text-zinc-600 uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      <FileText size={12} className="text-emerald-600" />
                      <span>{language === 'ar' ? 'الحركات المنفذة وأرقامها' : 'Actions & Doc Numbers'}</span>
                    </div>
                  </th>
                  <th className="px-4 py-3.5 text-xs font-black text-zinc-600 uppercase tracking-wider text-center">{language === 'ar' ? 'الجهاز والشبكة' : 'Device / IP'}</th>
                  <th className="px-4 py-3.5 text-xs font-black text-zinc-600 uppercase tracking-wider">{language === 'ar' ? 'التوقيت' : 'Timestamp'}</th>
                </tr>
              ) : (
                /* Standard Audit Logs Header */
                <tr className="bg-zinc-50/70 border-b border-zinc-100">
                  <th className="px-4 py-3.5 text-xs font-black text-zinc-600 uppercase tracking-wider text-center w-12">#</th>
                  <th className="px-4 py-3.5 text-xs font-black text-zinc-600 uppercase tracking-wider">{language === 'ar' ? 'المستخدم' : 'User'}</th>
                  <th className="px-4 py-3.5 text-xs font-black text-zinc-600 uppercase tracking-wider">{language === 'ar' ? 'الفرع/الشركة' : 'Branch / Company'}</th>
                  <th className="px-4 py-3.5 text-xs font-black text-zinc-600 uppercase tracking-wider">{language === 'ar' ? 'القسم' : 'Module'}</th>
                  <th className="px-4 py-3.5 text-xs font-black text-zinc-600 uppercase tracking-wider text-center">{language === 'ar' ? 'الإجراء' : 'Action'}</th>
                  <th className="px-4 py-3.5 text-xs font-black text-zinc-600 uppercase tracking-wider text-center">
                    <div className="flex items-center justify-center gap-1">
                      <FileText size={12} className="text-emerald-600" />
                      <span>{language === 'ar' ? 'رقم المستند' : 'Document No.'}</span>
                    </div>
                  </th>
                  <th className="px-4 py-3.5 text-xs font-black text-zinc-600 uppercase tracking-wider text-center">
                    <div className="flex items-center justify-center gap-1">
                      <BookOpen size={12} className="text-blue-600" />
                      <span>{language === 'ar' ? 'رقم القيد' : 'Entry No.'}</span>
                    </div>
                  </th>
                  <th className="px-4 py-3.5 text-xs font-black text-zinc-600 uppercase tracking-wider">{language === 'ar' ? 'تفاصيل السجل' : 'Details'}</th>
                  <th className="px-4 py-3.5 text-xs font-black text-zinc-600 uppercase tracking-wider text-center">{language === 'ar' ? 'الجهاز والشبكة' : 'Device / IP'}</th>
                  <th className="px-4 py-3.5 text-xs font-black text-zinc-600 uppercase tracking-wider">{language === 'ar' ? 'التوقيت' : 'Timestamp'}</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {loading ? (
                [1,2,3,4,5,6,7,8,9,10].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={activeMode === 'views' ? 8 : 10} className="px-4 py-4 h-14 bg-zinc-50/10" />
                  </tr>
                ))
              ) : !hasLoadedData ? (
                /* Initial Friendly Prompt: Don't load massive data without user request */
                <tr>
                  <td colSpan={activeMode === 'views' ? 8 : 10} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center max-w-md mx-auto text-center space-y-3">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-xs">
                        <RefreshCw size={24} />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-zinc-900 mb-1">
                          {language === 'ar' ? 'جاهز لتحميل السجلات بطلبك' : 'Ready to Load Activity Logs'}
                        </h3>
                        <p className="text-xs text-zinc-500 leading-relaxed">
                          {language === 'ar' 
                            ? 'تم إيقاف التحميل التلقائي لحماية سرعة وأداء النظام وتفادي تحميل آلاف السجلات غير المطلوبة. يرجى اختيار المستخدمين ثم الضغط على زر "تحديث".'
                            : 'Automatic bulk loading is stopped to keep the system fast. Select users and click "Refresh" to view records.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={fetchLogs}
                        disabled={loading}
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer mt-1"
                      >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        <span>{language === 'ar' ? 'تحديث وتحميل السجلات الآن' : 'Refresh and Load Logs Now'}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={activeMode === 'views' ? 8 : 10} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-zinc-400">
                      <Search size={36} className="opacity-25" />
                      <span className="font-bold text-sm">{language === 'ar' ? 'لا توجد سجلات مطابقة للبحث أو الفلترة في هذا السجل' : 'No logs matching your search or filters in this log view'}</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedLogs.map((log, idx) => {
                const isExpanded = expandedRowId === log.id;
                const { documentNumber, entryNumber } = extractDocAndEntryNumbers(log);

                if (activeMode === 'views') {
                  /* Dedicated User Behavior & Screen Visit Row */
                  const screenName = getDisplayScreenName(log.module, (log as any).metadata, language);
                  const stayDuration = formatStayDuration(log, language);
                  const isScreenVisit = log.action === 'SCREEN_VISIT';
                  const isLogin = log.action === 'LOGIN';
                  const isLogout = log.action === 'LOGOUT';

                  return (
                    <React.Fragment key={log.id}>
                      <tr 
                        onClick={() => setExpandedRowId(isExpanded ? null : log.id)}
                        className="hover:bg-zinc-50/80 cursor-pointer transition-all group print:bg-transparent"
                      >
                        <td className="px-4 py-3 text-xs font-mono text-zinc-400 text-center">
                          {(page - 1) * itemsPerPage + idx + 1}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-zinc-100 text-zinc-600 flex items-center justify-center border border-zinc-200 group-hover:bg-emerald-100 group-hover:text-emerald-600 group-hover:border-emerald-200 transition-colors shrink-0">
                              <User size={15} />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-zinc-900 text-xs truncate">{log.username || '-'}</span>
                              {log.user_email && <span className="text-[10px] text-zinc-400 font-mono tracking-tight truncate">{log.user_email}</span>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shrink-0">
                              <Monitor size={14} />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-zinc-900 text-xs">{screenName}</span>
                              <span className="text-[10px] text-zinc-400 font-mono">{log.module}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border tracking-wider ${
                            isScreenVisit ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            isLogin ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            isLogout ? 'bg-zinc-100 text-zinc-700 border-zinc-200' :
                            'bg-purple-50 text-purple-700 border-purple-200'
                          }`}>
                            {isScreenVisit ? (language === 'ar' ? 'دخول واستعراض شاشة' : 'Screen Visit') :
                             isLogin ? (language === 'ar' ? 'تسجيل دخول' : 'Login') :
                             isLogout ? (language === 'ar' ? 'تسجيل خروج' : 'Logout') :
                             (language === 'ar' ? 'حركة مستند' : log.action)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {stayDuration !== '-' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-black shadow-2xs">
                              <Clock size={12} className="text-amber-600" />
                              <span>{stayDuration}</span>
                            </span>
                          ) : (
                            <span className="text-zinc-300 font-mono text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1 max-w-sm">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {documentNumber && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-mono font-bold">
                                  <FileText size={10} className="text-emerald-600" />
                                  <span>{language === 'ar' ? `مستند: ${documentNumber}` : `Doc: ${documentNumber}`}</span>
                                </span>
                              )}
                              {entryNumber && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 text-xs font-mono font-bold">
                                  <BookOpen size={10} className="text-blue-600" />
                                  <span>{language === 'ar' ? `قيد: ${entryNumber}` : `Entry: ${entryNumber}`}</span>
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-600 font-medium leading-relaxed truncate">
                              {isScreenVisit 
                                ? (language === 'ar' ? `تم استعراض شاشة (${screenName})` : `Browsed screen (${screenName})`)
                                : (log.details || '-')}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-600 font-bold">
                              {getDeviceIcon((log as any).device)}
                              <span>{log.ip_address || '0.0.0.0'}</span>
                            </div>
                            <span className="text-[9px] text-zinc-400 font-mono italic">{(log as any).browser} / {(log as any).operating_system}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col text-xs text-zinc-500">
                            <div className="flex items-center gap-1.5 font-bold text-zinc-700">
                              <Calendar size={10} className="text-emerald-500" />
                              <span>{formatDateTime(log.created_at).split(',')[0]}</span>
                            </div>
                            <div className="flex items-center gap-1.5 opacity-70 font-mono text-[10px]">
                              <Clock size={10} />
                              <span>{formatDateTime(log.created_at).split(',')[1]}</span>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable details view */}
                      {isExpanded && (
                        <tr className="bg-zinc-50/40 print:hidden animate-in slide-in-from-top-1 duration-200">
                          <td colSpan={8} className="px-6 py-4 border-y border-zinc-100 bg-zinc-50/20">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="bg-white p-4 rounded-xl border border-zinc-100 shadow-2xs space-y-2">
                                <h4 className="font-black text-xs text-zinc-800 border-b pb-1.5 flex items-center gap-1.5">
                                  <Globe size={13} className="text-blue-500" />
                                  <span>{language === 'ar' ? 'بيانات الشبكة والعميل' : 'Client & Network Details'}</span>
                                </h4>
                                <div className="space-y-1 text-xs text-zinc-600 font-medium">
                                  <div className="flex justify-between"><span>{language === 'ar' ? 'المتصفح:' : 'Browser:'}</span><span className="font-bold text-zinc-800">{(log as any).browser}</span></div>
                                  <div className="flex justify-between"><span>{language === 'ar' ? 'نظام التشغيل:' : 'OS:'}</span><span className="font-bold text-zinc-800">{(log as any).operating_system}</span></div>
                                  <div className="flex justify-between"><span>{language === 'ar' ? 'نوع الجهاز:' : 'Device:'}</span><span className="font-bold text-zinc-800">{(log as any).device}</span></div>
                                  <div className="flex justify-between"><span>{language === 'ar' ? 'عنوان IP:' : 'IP:'}</span><span className="font-mono font-bold text-zinc-800">{log.ip_address}</span></div>
                                </div>
                              </div>

                              <div className="bg-white p-4 rounded-xl border border-zinc-100 shadow-2xs space-y-2">
                                <h4 className="font-black text-xs text-zinc-800 border-b pb-1.5 flex items-center gap-1.5">
                                  <Clock size={13} className="text-amber-500" />
                                  <span>{language === 'ar' ? 'تفاصيل البقاء والسلوك' : 'Behavior & Stay Details'}</span>
                                </h4>
                                <div className="space-y-1 text-xs text-zinc-600 font-medium">
                                  <div className="flex justify-between"><span>{language === 'ar' ? 'الشاشة:' : 'Screen:'}</span><span className="font-bold text-zinc-800">{screenName}</span></div>
                                  <div className="flex justify-between"><span>{language === 'ar' ? 'مدة البقاء:' : 'Stay Duration:'}</span><span className="font-bold text-amber-700">{stayDuration}</span></div>
                                  <div className="flex justify-between"><span>{language === 'ar' ? 'رقم المستند:' : 'Doc No:'}</span><span className="font-mono font-bold text-emerald-700">{documentNumber || '-'}</span></div>
                                  <div className="flex justify-between"><span>{language === 'ar' ? 'رقم القيد:' : 'Entry No:'}</span><span className="font-mono font-bold text-blue-700">{entryNumber || '-'}</span></div>
                                </div>
                              </div>

                              <div className="bg-white p-4 rounded-xl border border-zinc-100 shadow-2xs space-y-2">
                                <h4 className="font-black text-xs text-zinc-800 border-b pb-1.5">
                                  {language === 'ar' ? 'بيانات الجلسة (Metadata)' : 'Session Metadata'}
                                </h4>
                                <pre className="p-2 bg-zinc-50 rounded-lg overflow-x-auto text-[9px] font-mono text-zinc-600 max-h-[120px]">
                                  {JSON.stringify((log as any).metadata || {}, null, 2)}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                }

                /* Standard Audit Logs Row */

                return (
                  <React.Fragment key={log.id}>
                    <tr 
                      onClick={() => setExpandedRowId(isExpanded ? null : log.id)}
                      className="hover:bg-zinc-50/80 cursor-pointer transition-all group print:bg-transparent"
                    >
                      <td className="px-4 py-3 text-xs font-mono text-zinc-400 text-center">
                        {(page - 1) * itemsPerPage + idx + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-zinc-100 text-zinc-600 flex items-center justify-center border border-zinc-200 group-hover:bg-emerald-100 group-hover:text-emerald-600 group-hover:border-emerald-200 transition-colors shrink-0">
                            <User size={15} />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-zinc-900 text-xs truncate">{log.username || '-'}</span>
                            {log.user_email && <span className="text-[10px] text-zinc-400 font-mono tracking-tight truncate">{log.user_email}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col text-xs">
                          <span className="font-bold text-zinc-700">{(log as any).branch || 'Main'}</span>
                          <span className="text-[10px] text-zinc-400 truncate max-w-[120px]">{log.company_id || 'System'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="p-1 bg-zinc-50 rounded-lg border border-zinc-100 shrink-0">
                            <Layers size={11} className="text-zinc-500" />
                          </div>
                          <span className="text-xs font-bold text-zinc-700 tracking-tight">{log.module || 'SYSTEM'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border tracking-wider ${getActionColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>

                      {/* NEW: Document Number Cell */}
                      <td className="px-4 py-3 text-center">
                        {documentNumber ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono font-bold text-xs shadow-2xs">
                            <FileText size={10} className="text-emerald-600" />
                            <span>{documentNumber}</span>
                          </span>
                        ) : (
                          <span className="text-zinc-300 font-mono text-xs">-</span>
                        )}
                      </td>

                      {/* NEW: Journal Entry Number Cell */}
                      <td className="px-4 py-3 text-center">
                        {entryNumber ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 font-mono font-bold text-xs shadow-2xs">
                            <BookOpen size={10} className="text-blue-600" />
                            <span>{entryNumber}</span>
                          </span>
                        ) : (
                          <span className="text-zinc-300 font-mono text-xs">-</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5 max-w-xs">
                          <p className="text-xs text-zinc-600 leading-relaxed font-semibold truncate">
                            {log.details || '-'}
                          </p>
                          {((log as any).record_name || (log as any).record_id) && (
                            <span className="text-[9px] font-mono text-zinc-400 flex items-center gap-1 truncate">
                              <ExternalLink size={8} />
                              {(log as any).record_name || (log as any).record_id}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-600 font-bold">
                            {getDeviceIcon((log as any).device)}
                            <span>{log.ip_address || '0.0.0.0'}</span>
                          </div>
                          <span className="text-[9px] text-zinc-400 font-mono italic">{(log as any).browser} / {(log as any).operating_system}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col text-xs text-zinc-500">
                          <div className="flex items-center gap-1.5 font-bold text-zinc-700">
                            <Calendar size={10} className="text-emerald-500" />
                            <span>{formatDateTime(log.created_at).split(',')[0]}</span>
                          </div>
                          <div className="flex items-center gap-1.5 opacity-70 font-mono text-[10px]">
                            <Clock size={10} />
                            <span>{formatDateTime(log.created_at).split(',')[1]}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                    
                    {/* Expandable details view */}
                    {isExpanded && (
                      <tr className="bg-zinc-50/40 print:hidden animate-in slide-in-from-top-1 duration-200">
                        <td colSpan={10} className="px-6 py-4 border-y border-zinc-100 bg-zinc-50/20">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            
                            {/* Browser, OS, Network */}
                            <div className="bg-white p-4 rounded-xl border border-zinc-100 shadow-2xs space-y-2">
                              <h4 className="font-black text-xs text-zinc-800 border-b pb-1.5 flex items-center gap-1.5">
                                <Globe size={13} className="text-blue-500" />
                                <span>{language === 'ar' ? 'بيانات الشبكة والعميل' : 'Client & Network Details'}</span>
                              </h4>
                              <div className="space-y-1 text-xs text-zinc-600 font-medium">
                                <div className="flex justify-between"><span>{language === 'ar' ? 'المتصفح:' : 'Browser:'}</span><span className="font-bold text-zinc-800">{(log as any).browser}</span></div>
                                <div className="flex justify-between"><span>{language === 'ar' ? 'نظام التشغيل:' : 'OS:'}</span><span className="font-bold text-zinc-800">{(log as any).operating_system}</span></div>
                                <div className="flex justify-between"><span>{language === 'ar' ? 'نوع الجهاز:' : 'Device:'}</span><span className="font-bold text-zinc-800">{(log as any).device}</span></div>
                                <div className="flex justify-between"><span>{language === 'ar' ? 'الفرع:' : 'Branch:'}</span><span className="font-bold text-zinc-800">{(log as any).branch}</span></div>
                                <div className="flex justify-between"><span>{language === 'ar' ? 'عنوان IP:' : 'IP:'}</span><span className="font-mono font-bold text-zinc-800">{log.ip_address}</span></div>
                              </div>
                            </div>

                            {/* Execution / Performance */}
                            <div className="bg-white p-4 rounded-xl border border-zinc-100 shadow-2xs space-y-2">
                              <h4 className="font-black text-xs text-zinc-800 border-b pb-1.5 flex items-center gap-1.5">
                                <Clock size={13} className="text-emerald-500" />
                                <span>{language === 'ar' ? 'أداء وجودة العملية' : 'Execution & Performance'}</span>
                              </h4>
                              <div className="space-y-1 text-xs text-zinc-600 font-medium">
                                <div className="flex justify-between"><span>{language === 'ar' ? 'رقم المستند:' : 'Document No:'}</span><span className="font-mono font-bold text-emerald-700">{documentNumber || '-'}</span></div>
                                <div className="flex justify-between"><span>{language === 'ar' ? 'رقم القيد:' : 'Entry No:'}</span><span className="font-mono font-bold text-blue-700">{entryNumber || '-'}</span></div>
                                <div className="flex justify-between"><span>{language === 'ar' ? 'معرف السجل:' : 'Record ID:'}</span><span className="font-mono text-zinc-500 text-[10px] truncate max-w-[160px]">{(log as any).record_id || '-'}</span></div>
                                <div className="flex justify-between"><span>{language === 'ar' ? 'اسم السجل:' : 'Record Name:'}</span><span className="font-bold text-zinc-800 truncate max-w-[160px]">{(log as any).record_name || '-'}</span></div>
                                <div className="flex justify-between"><span>{language === 'ar' ? 'النتيجة:' : 'Status:'}</span>
                                  <span className={`font-bold flex items-center gap-1 ${ (log as any).success ? 'text-emerald-600' : 'text-red-600' }`}>
                                    {(log as any).success ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                    {(log as any).success ? (language === 'ar' ? 'ناجحة' : 'Success') : (language === 'ar' ? 'فشلت' : 'Failed')}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Data Changes JSON */}
                            <div className="bg-white p-4 rounded-xl border border-zinc-100 shadow-2xs space-y-2">
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

// Specialized page components for each of the 4 requested screens
export const ActivityLogCancellationsPage: React.FC = () => (
  <ActivityLogPage initialMode="cancellations" />
);

export const ActivityLogModificationsPage: React.FC = () => (
  <ActivityLogPage initialMode="modifications" />
);

export const ActivityLogViewsPage: React.FC = () => (
  <ActivityLogPage initialMode="views" />
);

export const ActivityLogPrintsPage: React.FC = () => (
  <ActivityLogPage initialMode="prints" />
);
