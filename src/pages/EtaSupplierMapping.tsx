import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Link2,
  Unlink,
  CheckCircle2,
  AlertCircle,
  Search,
  RefreshCw,
  Building2,
  FileSpreadsheet,
  Printer,
  Plus,
  ArrowRightLeft,
  Sparkles,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Copy,
  Check,
  Info,
  X,
  FileText,
  UserCheck,
  UserX,
  Layers,
  Phone,
  MapPin,
  FileCode
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotification } from '../contexts/NotificationContext';
import { apiRequest } from '../services/dbService';
import { formatMoney } from '../utils/formatUtils';
import { exportToExcel } from '../utils/excelUtils';

export interface EtaPortalSupplier {
  taxNumber: string;
  name: string;
  address: string;
  docCount: number;
  totalAmount: number;
  lastDocDate: string | null;
  isLinked: boolean;
  linkedSupplier: {
    id: string;
    name: string;
    code: string;
    taxNumber: string;
    mobile?: string;
    email?: string;
    linkedAt?: string;
  } | null;
  autoMatchedSupplier: {
    id: string;
    name: string;
    code: string;
    taxNumber: string;
  } | null;
}

export interface SupplierMappingSummary {
  totalPortalSuppliers: number;
  linkedSuppliersCount: number;
  unlinkedSuppliersCount: number;
  autoMatchCandidatesCount: number;
  totalDocumentsCount: number;
  totalInvoicedAmount: number;
}

interface ErpSupplierOption {
  id: string;
  name: string;
  code: string;
  tax_number?: string;
  mobile?: string;
}

export function EtaSupplierMapping() {
  const { language } = useLanguage();
  const { showNotification } = useNotification();
  const isAr = language === 'ar';

  // Tabs: all = كل الموردين الواردة من البوابة, linked = الموردين المربوطة, unlinked = الموردين غير المربوطة
  const [activeTab, setActiveTab] = useState<'all' | 'linked' | 'unlinked'>('all');

  // Loading & Data States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [suppliers, setSuppliers] = useState<EtaPortalSupplier[]>([]);
  const [summary, setSummary] = useState<SupplierMappingSummary>({
    totalPortalSuppliers: 0,
    linkedSuppliersCount: 0,
    unlinkedSuppliersCount: 0,
    autoMatchCandidatesCount: 0,
    totalDocumentsCount: 0,
    totalInvoicedAmount: 0
  });

  // ERP Suppliers List for Manual Select Modal
  const [allErpSuppliers, setAllErpSuppliers] = useState<ErpSupplierOption[]>([]);
  const [loadingErpSuppliers, setLoadingErpSuppliers] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTaxMatchedOnly, setFilterTaxMatchedOnly] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Copy Tax ID tooltip state
  const [copiedTax, setCopiedTax] = useState<string | null>(null);

  // Modal States
  const [linkModalSupplier, setLinkModalSupplier] = useState<EtaPortalSupplier | null>(null);
  const [selectedErpSupplierId, setSelectedErpSupplierId] = useState<string>('');
  const [linkNotes, setLinkNotes] = useState<string>('');
  const [modalSearchSupplier, setModalSearchSupplier] = useState<string>('');
  const [savingLink, setSavingLink] = useState(false);

  // Create & Link Modal
  const [createModalSupplier, setCreateModalSupplier] = useState<EtaPortalSupplier | null>(null);
  const [createForm, setCreateForm] = useState({
    name: '',
    taxNumber: '',
    address: '',
    phone: '',
    notes: ''
  });
  const [savingCreate, setSavingCreate] = useState(false);

  // Unlink Confirmation Modal
  const [unlinkSupplierTarget, setUnlinkSupplierTarget] = useState<EtaPortalSupplier | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  // Bulk Quick-Link State
  const [bulkLinking, setBulkLinking] = useState(false);

  // Load suppliers mappings from backend
  const loadMappings = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await apiRequest<{
        success: boolean;
        suppliers: EtaPortalSupplier[];
        summary: SupplierMappingSummary;
      }>('/eta/suppliers/mapping');

      if (res && res.success) {
        setSuppliers(res.suppliers || []);
        if (res.summary) setSummary(res.summary);
      } else {
        showNotification(isAr ? 'فشل تحميل بيانات ربط الموردين' : 'Failed to load supplier mappings', 'error');
      }
    } catch (err: any) {
      console.error('Error loading ETA supplier mappings:', err);
      showNotification(err.message || (isAr ? 'حدث خطأ أثناء تحميل البيانات' : 'Error loading data'), 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAr, showNotification]);

  // Load ERP Suppliers for dropdowns
  const loadErpSuppliers = useCallback(async () => {
    try {
      setLoadingErpSuppliers(true);
      const res = await apiRequest<{ success: boolean; data: ErpSupplierOption[] }>('/suppliers?limit=1000');
      if (res && res.data) {
        setAllErpSuppliers(res.data);
      }
    } catch (err) {
      console.warn('Could not load ERP suppliers list:', err);
    } finally {
      setLoadingErpSuppliers(false);
    }
  }, []);

  useEffect(() => {
    loadMappings();
    loadErpSuppliers();
  }, [loadMappings, loadErpSuppliers]);

  // Copy Tax ID
  const handleCopyTax = (taxNum: string) => {
    navigator.clipboard.writeText(taxNum);
    setCopiedTax(taxNum);
    setTimeout(() => setCopiedTax(null), 2000);
  };

  // Quick 1-click Link to Auto-Matched Supplier
  const handleQuickLink = async (supplier: EtaPortalSupplier) => {
    if (!supplier.autoMatchedSupplier) return;
    try {
      setSavingLink(true);
      const res = await apiRequest<{ success: boolean; message?: string }>('/eta/suppliers/mapping/link', 'POST', {
        etaTaxNumber: supplier.taxNumber,
        supplierId: supplier.autoMatchedSupplier.id,
        etaSupplierName: supplier.name,
        notes: isAr ? 'ربط تلقائي بالرقم الضريبي' : 'Auto-linked by Tax ID'
      });

      if (res && res.success) {
        showNotification(
          isAr
            ? `تم ربط المورد "${supplier.name}" بنجاح مع "${supplier.autoMatchedSupplier.name}"`
            : `Supplier linked successfully`,
          'success'
        );
        loadMappings(true);
      } else {
        showNotification(res.message || (isAr ? 'فشل إتمام الربط' : 'Failed to link'), 'error');
      }
    } catch (err: any) {
      showNotification(err.message || (isAr ? 'خطأ في عملية الربط' : 'Error linking'), 'error');
    } finally {
      setSavingLink(false);
    }
  };

  // Bulk Quick Link All Matched Suppliers
  const handleBulkQuickLinkAll = async () => {
    if (summary.autoMatchCandidatesCount === 0) {
      showNotification(isAr ? 'لا يوجد موردين متطابقين ضريبياً جاهزين للربط التلقائي' : 'No matched suppliers to link', 'info');
      return;
    }

    try {
      setBulkLinking(true);
      const res = await apiRequest<{ success: boolean; linkedCount: number; message?: string }>(
        '/eta/suppliers/mapping/quick-link-all',
        'POST',
        {}
      );

      if (res && res.success) {
        showNotification(
          isAr
            ? `تم ربط ${res.linkedCount} مورد بنجاح استناداً إلى أرقامهم الضريبية!`
            : `Successfully linked ${res.linkedCount} suppliers by Tax ID!`,
          'success'
        );
        loadMappings(true);
      } else {
        showNotification(res.message || (isAr ? 'فشل إتمام الربط الجماعي' : 'Bulk link failed'), 'error');
      }
    } catch (err: any) {
      showNotification(err.message || (isAr ? 'خطأ في الربط الجماعي' : 'Error bulk linking'), 'error');
    } finally {
      setBulkLinking(false);
    }
  };

  // Open Manual Link Modal
  const openLinkModal = (supplier: EtaPortalSupplier) => {
    setLinkModalSupplier(supplier);
    setSelectedErpSupplierId(supplier.linkedSupplier?.id || supplier.autoMatchedSupplier?.id || '');
    setLinkNotes('');
    setModalSearchSupplier('');
  };

  // Save Manual Link
  const handleSaveManualLink = async () => {
    if (!linkModalSupplier || !selectedErpSupplierId) {
      showNotification(isAr ? 'يرجى اختيار المورد من النظام' : 'Please select an ERP supplier', 'warning');
      return;
    }

    try {
      setSavingLink(true);
      const res = await apiRequest<{ success: boolean; message?: string }>('/eta/suppliers/mapping/link', 'POST', {
        etaTaxNumber: linkModalSupplier.taxNumber,
        supplierId: selectedErpSupplierId,
        etaSupplierName: linkModalSupplier.name,
        notes: linkNotes
      });

      if (res && res.success) {
        showNotification(isAr ? 'تم حفظ ربط المورد بنجاح' : 'Supplier mapping saved successfully', 'success');
        setLinkModalSupplier(null);
        loadMappings(true);
      } else {
        showNotification(res.message || (isAr ? 'فشل حفظ الربط' : 'Failed to save mapping'), 'error');
      }
    } catch (err: any) {
      showNotification(err.message || (isAr ? 'خطأ أثناء حفظ الربط' : 'Error saving mapping'), 'error');
    } finally {
      setSavingLink(false);
    }
  };

  // Unlink Supplier
  const handleConfirmUnlink = async () => {
    if (!unlinkSupplierTarget) return;

    try {
      setUnlinking(true);
      const res = await apiRequest<{ success: boolean; message?: string }>('/eta/suppliers/mapping/unlink', 'POST', {
        etaTaxNumber: unlinkSupplierTarget.taxNumber
      });

      if (res && res.success) {
        showNotification(isAr ? 'تم إلغاء ربط المورد بنجاح' : 'Supplier unlinked successfully', 'success');
        setUnlinkSupplierTarget(null);
        loadMappings(true);
      } else {
        showNotification(res.message || (isAr ? 'فشل إلغاء الربط' : 'Failed to unlink'), 'error');
      }
    } catch (err: any) {
      showNotification(err.message || (isAr ? 'خطأ أثناء إلغاء الربط' : 'Error unlinking'), 'error');
    } finally {
      setUnlinking(false);
    }
  };

  // Open Create & Link Modal
  const openCreateModal = (supplier: EtaPortalSupplier) => {
    setCreateModalSupplier(supplier);
    setCreateForm({
      name: supplier.name || '',
      taxNumber: supplier.taxNumber || '',
      address: supplier.address || '',
      phone: '',
      notes: isAr ? 'تم إنشاؤه وربطه تلقائياً من منظومة الفاتورة الإلكترونية ETA' : 'Created & mapped from ETA Portal'
    });
  };

  // Save Create & Link
  const handleSaveCreateAndLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createModalSupplier) return;
    if (!createForm.name.trim()) {
      showNotification(isAr ? 'اسم المورد مطلوب' : 'Supplier name is required', 'warning');
      return;
    }

    try {
      setSavingCreate(true);
      const res = await apiRequest<{ success: boolean; supplier?: any; message?: string }>(
        '/eta/suppliers/mapping/create-and-link',
        'POST',
        {
          etaTaxNumber: createModalSupplier.taxNumber,
          name: createForm.name.trim(),
          address: createForm.address.trim(),
          phone: createForm.phone.trim(),
          notes: createForm.notes.trim()
        }
      );

      if (res && res.success) {
        showNotification(
          isAr
            ? `تم إنشاء المورد "${createForm.name}" وربطه بنجاح!`
            : `Supplier created and linked successfully!`,
          'success'
        );
        setCreateModalSupplier(null);
        loadMappings(true);
        loadErpSuppliers();
      } else {
        showNotification(res.message || (isAr ? 'فشل إنشاء وربط المورد' : 'Failed to create & link'), 'error');
      }
    } catch (err: any) {
      showNotification(err.message || (isAr ? 'خطأ في إنشاء المورد' : 'Error creating supplier'), 'error');
    } finally {
      setSavingCreate(false);
    }
  };

  // Filtered Suppliers based on Active Tab, Search Query, and Auto-Match Toggle
  const filteredSuppliers = useMemo(() => {
    let list = suppliers;

    // Filter by Tab
    if (activeTab === 'linked') {
      list = list.filter(s => s.isLinked);
    } else if (activeTab === 'unlinked') {
      list = list.filter(s => !s.isLinked);
      if (filterTaxMatchedOnly) {
        list = list.filter(s => !!s.autoMatchedSupplier);
      }
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.taxNumber.toLowerCase().includes(q) ||
        (s.address && s.address.toLowerCase().includes(q)) ||
        (s.linkedSupplier && (
          s.linkedSupplier.name.toLowerCase().includes(q) ||
          s.linkedSupplier.code.toLowerCase().includes(q) ||
          s.linkedSupplier.taxNumber.toLowerCase().includes(q)
        )) ||
        (s.autoMatchedSupplier && (
          s.autoMatchedSupplier.name.toLowerCase().includes(q) ||
          s.autoMatchedSupplier.code.toLowerCase().includes(q)
        ))
      );
    }

    return list;
  }, [suppliers, activeTab, filterTaxMatchedOnly, searchQuery]);

  // Paginated View
  const totalPages = Math.max(1, Math.ceil(filteredSuppliers.length / pageSize));
  const paginatedSuppliers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSuppliers.slice(start, start + pageSize);
  }, [filteredSuppliers, page, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [activeTab, searchQuery, filterTaxMatchedOnly, pageSize]);

  // Export to Excel
  const handleExportExcel = () => {
    const exportData = filteredSuppliers.map((s, idx) => ({
      '#': idx + 1,
      'الرقم الضريبي (ETA)': s.taxNumber,
      'اسم المورد بالبوابة': s.name,
      'العنوان بالبوابة': s.address || '-',
      'عدد الفواتير': s.docCount,
      'إجمالي المبالغ': s.totalAmount,
      'آخر فاتورة': s.lastDocDate ? new Date(s.lastDocDate).toLocaleDateString('ar-EG') : '-',
      'حالة الربط': s.isLinked ? 'مربوط' : 'غير مربوط',
      'كود المورد بالنظام': s.linkedSupplier?.code || (s.autoMatchedSupplier?.code ? `(مطابق: ${s.autoMatchedSupplier.code})` : '-'),
      'اسم المورد بالنظام': s.linkedSupplier?.name || (s.autoMatchedSupplier?.name ? `(مطابق: ${s.autoMatchedSupplier.name})` : '-'),
      'الرقم الضريبي بالنظام': s.linkedSupplier?.taxNumber || s.autoMatchedSupplier?.taxNumber || '-'
    }));

    exportToExcel(exportData, `ربط_موردي_ETA_${activeTab}_${new Date().toISOString().slice(0, 10)}`);
  };

  // Print Table
  const handlePrint = () => {
    window.print();
  };

  // Filtered ERP Suppliers in Modal
  const modalFilteredErpSuppliers = useMemo(() => {
    if (!modalSearchSupplier.trim()) return allErpSuppliers;
    const q = modalSearchSupplier.toLowerCase().trim();
    return allErpSuppliers.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q) ||
      (s.tax_number && s.tax_number.includes(q))
    );
  }, [allErpSuppliers, modalSearchSupplier]);

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 p-4 md:p-6 lg:p-8 space-y-6">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-xl shadow-md shadow-indigo-500/20">
            <Link2 className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              {isAr ? 'ربط الموردين (منظومة الفاتورة الإلكترونية ETA)' : 'ETA Supplier Mapping'}
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                ETA Portal
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {isAr
                ? 'مطابقة وتعيين موردي البوابة الإلكترونية بحسابات الموردين في دليل الحسابات بالنظام المحاسبي'
                : 'Map and align portal invoice suppliers with internal ERP supplier accounts'}
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {summary.autoMatchCandidatesCount > 0 && (
            <button
              onClick={handleBulkQuickLinkAll}
              disabled={bulkLinking}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-sm font-semibold rounded-xl shadow-sm shadow-emerald-600/30 transition-all disabled:opacity-50"
              title={isAr ? 'ربط جميع الموردين الذين يتطابق رقمهم الضريبي مع موردين مسجلين' : 'Auto-link all matching suppliers'}
            >
              <Sparkles className={`w-4 h-4 ${bulkLinking ? 'animate-spin' : ''}`} />
              <span>
                {isAr
                  ? `ربط سريع للمتطابقين (${summary.autoMatchCandidatesCount})`
                  : `Quick Link Matched (${summary.autoMatchCandidatesCount})`}
              </span>
            </button>
          )}

          <button
            onClick={() => loadMappings(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-xl transition-all disabled:opacity-50"
            title={isAr ? 'تحديث البيانات' : 'Refresh'}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isAr ? 'تحديث' : 'Refresh'}</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-emerald-600 dark:text-emerald-400 text-sm font-medium rounded-xl transition-all"
            title={isAr ? 'تصدير إكسيل' : 'Export to Excel'}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">{isAr ? 'إكسيل' : 'Excel'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-xl transition-all"
            title={isAr ? 'طباعة' : 'Print'}
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">{isAr ? 'طباعة' : 'Print'}</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Portal Suppliers */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {isAr ? 'إجمالي موردي البوابة' : 'Total Portal Suppliers'}
            </span>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
              {summary.totalPortalSuppliers.toLocaleString()}
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <span>{summary.totalDocumentsCount.toLocaleString()} {isAr ? 'وثيقة واردة' : 'docs'}</span>
              <span>•</span>
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">{formatMoney(summary.totalInvoicedAmount)}</span>
            </div>
          </div>
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        {/* Linked Suppliers */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {isAr ? 'الموردين المربوطة' : 'Linked Suppliers'}
            </span>
            <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
              {summary.linkedSuppliersCount.toLocaleString()}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {summary.totalPortalSuppliers > 0
                ? `${Math.round((summary.linkedSuppliersCount / summary.totalPortalSuppliers) * 100)}% ${isAr ? 'نسبة الإنجاز' : 'mapped'}`
                : '0%'}
            </div>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Unlinked Suppliers */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {isAr ? 'الموردين غير المربوطة' : 'Unlinked Suppliers'}
            </span>
            <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
              {summary.unlinkedSuppliersCount.toLocaleString()}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {isAr ? 'بحاجة للربط أو الإنشاء' : 'Require mapping'}
            </div>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl">
            <UserX className="w-6 h-6" />
          </div>
        </div>

        {/* Auto-Match Candidates */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {isAr ? 'تطابق ضريبي جاهز للربط' : 'Ready Tax ID Matches'}
            </span>
            <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">
              {summary.autoMatchCandidatesCount.toLocaleString()}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {isAr ? 'تطابق مؤكد 100% بالرقم الضريبي' : 'Exact Tax ID match in ERP'}
            </div>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Card with Tabs & Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-hidden">
        
        {/* Navigation Tabs Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 dark:border-slate-700 px-6 pt-4 gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-[-1px]">
            
            {/* Tab 1: كل الموردين الواردة من البوابة */}
            <button
              onClick={() => setActiveTab('all')}
              className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold border-b-2 transition-colors relative whitespace-nowrap ${
                activeTab === 'all'
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>{isAr ? 'كل الموردين الواردة من البوابة' : 'All Portal Suppliers'}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === 'all'
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
              }`}>
                {summary.totalPortalSuppliers}
              </span>
            </button>

            {/* Tab 2: الموردين المربوطة مع الموردين الموجودين */}
            <button
              onClick={() => setActiveTab('linked')}
              className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold border-b-2 transition-colors relative whitespace-nowrap ${
                activeTab === 'linked'
                  ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>{isAr ? 'الموردين المربوطة مع الموردين الموجودين' : 'Linked Suppliers'}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === 'linked'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
              }`}>
                {summary.linkedSuppliersCount}
              </span>
            </button>

            {/* Tab 3: الموردين غير المربوطة يتم جلب المورد على اساس الرقم الضريبي */}
            <button
              onClick={() => setActiveTab('unlinked')}
              className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold border-b-2 transition-colors relative whitespace-nowrap ${
                activeTab === 'unlinked'
                  ? 'border-amber-600 text-amber-600 dark:border-amber-400 dark:text-amber-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <span>{isAr ? 'الموردين غير المربوطة (جلب بالرقم الضريبي)' : 'Unlinked Suppliers (Tax ID Match)'}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === 'unlinked'
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
              }`}>
                {summary.unlinkedSuppliersCount}
              </span>
              {summary.autoMatchCandidatesCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-500 text-white animate-pulse">
                  {summary.autoMatchCandidatesCount} {isAr ? 'مطابق' : 'matched'}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 md:p-6 bg-slate-50/60 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={isAr ? 'بحث بالاسم، الرقم الضريبي، الكود...' : 'Search by name, Tax ID, code...'}
              className="w-full pl-3 pr-9 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
            {activeTab === 'unlinked' && (
              <button
                onClick={() => setFilterTaxMatchedOnly(!filterTaxMatchedOnly)}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${
                  filterTaxMatchedOnly
                    ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/40 dark:border-blue-700 dark:text-blue-300'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                <span>{isAr ? 'إظهار المتطابقين ضريبياً فقط' : 'Only Tax ID Matched'}</span>
              </button>
            )}

            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>{isAr ? 'عرض في الصفحة:' : 'Per page:'}</span>
              <select
                value={pageSize}
                onChange={e => setPageSize(Number(e.target.value))}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto min-h-[350px]">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
              <p className="text-sm font-medium">{isAr ? 'جاري تحميل بيانات الموردين من البوابة...' : 'Loading portal suppliers...'}</p>
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400 text-center px-4">
              <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-400">
                <Building2 className="w-10 h-10" />
              </div>
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-200">
                {isAr ? 'لا توجد بيانات تطابق الفلتر المحدد' : 'No suppliers found'}
              </h3>
              <p className="text-xs text-slate-400 max-w-sm">
                {isAr
                  ? 'لم يتم العثور على موردين ضمن هذا التبويب، أو أن كلمة البحث غير متطابقة.'
                  : 'No suppliers match your current tab or search query.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50/80 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3.5 px-4 font-semibold w-12 text-center">#</th>
                  <th className="py-3.5 px-4 font-semibold">{isAr ? 'الرقم الضريبي (ETA)' : 'ETA Tax ID'}</th>
                  <th className="py-3.5 px-4 font-semibold">{isAr ? 'اسم المورد في البوابة' : 'ETA Supplier Name'}</th>
                  <th className="py-3.5 px-4 font-semibold text-center">{isAr ? 'الوثائق' : 'Documents'}</th>
                  <th className="py-3.5 px-4 font-semibold">{isAr ? 'إجمالي المبالغ' : 'Total Amount'}</th>
                  <th className="py-3.5 px-4 font-semibold">{isAr ? 'حالة الربط والمورد بالنظام' : 'Mapping Status & ERP Supplier'}</th>
                  <th className="py-3.5 px-4 font-semibold text-center w-52">{isAr ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 dark:divide-slate-700/80">
                {paginatedSuppliers.map((supplier, idx) => {
                  const globalIndex = (page - 1) * pageSize + idx + 1;
                  return (
                    <tr
                      key={supplier.taxNumber}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-750 transition-colors"
                    >
                      {/* Index */}
                      <td className="py-3.5 px-4 text-center text-xs text-slate-400 font-mono">
                        {globalIndex}
                      </td>

                      {/* Tax ID */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                          <span>{supplier.taxNumber}</span>
                          <button
                            onClick={() => handleCopyTax(supplier.taxNumber)}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-slate-600 transition-colors"
                            title={isAr ? 'نسخ الرقم الضريبي' : 'Copy Tax ID'}
                          >
                            {copiedTax === supplier.taxNumber ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Name & Address */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {supplier.name}
                        </div>
                        {supplier.address && (
                          <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5 line-clamp-1">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{supplier.address}</span>
                          </div>
                        )}
                      </td>

                      {/* Doc Count */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                          <FileText className="w-3 h-3 text-slate-500" />
                          {supplier.docCount}
                        </span>
                      </td>

                      {/* Total Amount & Last Doc Date */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {formatMoney(supplier.totalAmount)}
                        </div>
                        {supplier.lastDocDate && (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {isAr ? 'آخر وثيقة:' : 'Last doc:'}{' '}
                            {new Date(supplier.lastDocDate).toLocaleDateString('ar-EG')}
                          </div>
                        )}
                      </td>

                      {/* Mapping Status & ERP Supplier */}
                      <td className="py-3.5 px-4">
                        {supplier.isLinked && supplier.linkedSupplier ? (
                          // Linked Badge
                          <div className="p-2 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                {supplier.linkedSupplier.name}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded">
                                {supplier.linkedSupplier.code}
                              </span>
                            </div>
                            <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5 font-mono">
                              {isAr ? 'الرقم الضريبي بالنظام:' : 'ERP Tax ID:'} {supplier.linkedSupplier.taxNumber || (isAr ? 'غير مسجل' : 'N/A')}
                            </div>
                          </div>
                        ) : supplier.autoMatchedSupplier ? (
                          // Auto Matched Candidate by Tax ID
                          <div className="p-2 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-xl">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                                {supplier.autoMatchedSupplier.name}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded">
                                {supplier.autoMatchedSupplier.code}
                              </span>
                            </div>
                            <div className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5 flex items-center gap-1 font-medium">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                              <span>{isAr ? 'تطابق تام بالرقم الضريبي بالنظام' : 'Exact Tax ID match'}</span>
                            </div>
                          </div>
                        ) : (
                          // Unlinked & No Match
                          <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
                            <AlertCircle className="w-4 h-4" />
                            <span>{isAr ? 'غير مربوط (لم يتم العثور على تطابق)' : 'Not mapped (no match)'}</span>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {supplier.isLinked ? (
                            <>
                              <button
                                onClick={() => openLinkModal(supplier)}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1"
                                title={isAr ? 'تعديل الربط' : 'Edit link'}
                              >
                                <ArrowRightLeft className="w-3 h-3" />
                                <span>{isAr ? 'تعديل' : 'Edit'}</span>
                              </button>
                              <button
                                onClick={() => setUnlinkSupplierTarget(supplier)}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/40 dark:hover:bg-red-900/60 dark:text-red-400 transition-colors flex items-center gap-1"
                                title={isAr ? 'إلغاء الربط' : 'Unlink'}
                              >
                                <Unlink className="w-3 h-3" />
                                <span>{isAr ? 'فك الربط' : 'Unlink'}</span>
                              </button>
                            </>
                          ) : (
                            <>
                              {/* Quick 1-click link if auto matched */}
                              {supplier.autoMatchedSupplier && (
                                <button
                                  onClick={() => handleQuickLink(supplier)}
                                  disabled={savingLink}
                                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all active:scale-95 flex items-center gap-1"
                                  title={isAr ? 'ربط سريع بالمورد المتطابق ضريبياً' : 'Quick link'}
                                >
                                  <Sparkles className="w-3 h-3" />
                                  <span>{isAr ? 'ربط سريع' : 'Quick Link'}</span>
                                </button>
                              )}

                              {/* Manual Link Modal button */}
                              <button
                                onClick={() => openLinkModal(supplier)}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 dark:text-indigo-300 transition-colors flex items-center gap-1"
                                title={isAr ? 'ربط بمورد مسجل بالنظام' : 'Link to ERP supplier'}
                              >
                                <Link2 className="w-3 h-3" />
                                <span>{isAr ? 'ربط بمورد' : 'Link'}</span>
                              </button>

                              {/* Create & Link button */}
                              <button
                                onClick={() => openCreateModal(supplier)}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1"
                                title={isAr ? 'إنشاء مورد جديد بالبيانات وربطه فوراً' : 'Create & Link'}
                              >
                                <Plus className="w-3 h-3" />
                                <span>{isAr ? 'إنشاء جديد' : 'New'}</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div>
            {isAr ? 'عرض' : 'Showing'}{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {filteredSuppliers.length > 0 ? (page - 1) * pageSize + 1 : 0}
            </span>{' '}
            {isAr ? 'إلى' : 'to'}{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {Math.min(page * pageSize, filteredSuppliers.length)}
            </span>{' '}
            {isAr ? 'من إجمالي' : 'of'}{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-200">{filteredSuppliers.length}</span>{' '}
            {isAr ? 'مورد' : 'suppliers'}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="px-2 font-medium">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Manual Link Modal */}
      <AnimatePresence>
        {linkModalSupplier && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-lg overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
                    <Link2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white">
                      {isAr ? 'ربط مورد البوابة بحساب بالنظام' : 'Link ETA Supplier to ERP'}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {isAr ? 'اختر المورد المقابل في دليل حسابات الموردين' : 'Select corresponding ERP supplier'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setLinkModalSupplier(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 space-y-4 text-sm">
                {/* Target ETA Supplier Info */}
                <div className="p-3 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400">{isAr ? 'مورد البوابة:' : 'ETA Supplier:'}</span>
                    <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {linkModalSupplier.taxNumber}
                    </span>
                  </div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    {linkModalSupplier.name}
                  </div>
                  {linkModalSupplier.address && (
                    <div className="text-xs text-slate-400 truncate">
                      {linkModalSupplier.address}
                    </div>
                  )}
                </div>

                {/* ERP Supplier Search & Select */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {isAr ? 'اختر مورد النظام المقابل *' : 'Select ERP Supplier *'}
                  </label>
                  
                  {/* Search inside ERP suppliers */}
                  <div className="relative mb-2">
                    <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={modalSearchSupplier}
                      onChange={e => setModalSearchSupplier(e.target.value)}
                      placeholder={isAr ? 'ابحث في قائمة الموردين...' : 'Search ERP suppliers...'}
                      className="w-full pl-3 pr-8 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>

                  {/* Select Dropdown / List */}
                  <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-700/60">
                    {modalFilteredErpSuppliers.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        {isAr ? 'لا يوجد موردين مطابقين للبحث' : 'No suppliers found'}
                      </div>
                    ) : (
                      modalFilteredErpSuppliers.map(erpSup => {
                        const isSelected = selectedErpSupplierId === erpSup.id;
                        const isTaxExactMatch = erpSup.tax_number && erpSup.tax_number.replace(/[-\s]/g, '') === linkModalSupplier.taxNumber.replace(/[-\s]/g, '');

                        return (
                          <div
                            key={erpSup.id}
                            onClick={() => setSelectedErpSupplierId(erpSup.id)}
                            className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-750'
                            }`}
                          >
                            <div>
                              <div className="font-semibold text-xs flex items-center gap-1.5">
                                <span>{erpSup.name}</span>
                                {isTaxExactMatch && (
                                  <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 px-1 rounded font-bold">
                                    {isAr ? 'مطابق ضريبياً' : 'Tax Match'}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                {isAr ? 'كود:' : 'Code:'} {erpSup.code} {erpSup.tax_number ? `• ضريبي: ${erpSup.tax_number}` : ''}
                              </div>
                            </div>
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                              isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                            }`}>
                              {isSelected && <Check className="w-2.5 h-2.5" />}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? 'ملاحظات الربط (اختياري)' : 'Notes (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={linkNotes}
                    onChange={e => setLinkNotes(e.target.value)}
                    placeholder={isAr ? 'أي ملاحظات خاصة بربط هذا المورد...' : 'Any mapping notes...'}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
                <button
                  onClick={() => setLinkModalSupplier(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 dark:text-slate-400 rounded-xl"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  onClick={handleSaveManualLink}
                  disabled={!selectedErpSupplierId || savingLink}
                  className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-all disabled:opacity-50"
                >
                  {savingLink ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ الربط' : 'Save Mapping')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create & Link Supplier Modal */}
      <AnimatePresence>
        {createModalSupplier && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-lg overflow-hidden"
            >
              <form onSubmit={handleSaveCreateAndLink}>
                {/* Header */}
                <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
                      <Plus className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-slate-900 dark:text-white">
                        {isAr ? 'إنشاء مورد جديد بالنظام وربطه فوراً' : 'Create & Link New Supplier'}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {isAr ? 'يتم ملء البيانات تلقائياً من بيانات منظومة الفاتورة الإلكترونية' : 'Pre-filled from ETA Portal invoice details'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCreateModalSupplier(null)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Form Fields */}
                <div className="p-5 space-y-3.5 text-sm">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {isAr ? 'اسم المورد *' : 'Supplier Name *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={createForm.name}
                      onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        {isAr ? 'الرقم الضريبي (ETA)' : 'Tax ID (ETA)'}
                      </label>
                      <input
                        type="text"
                        disabled
                        value={createForm.taxNumber}
                        className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-600 dark:text-slate-300 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        {isAr ? 'رقم الهاتف / الجوال' : 'Phone / Mobile'}
                      </label>
                      <input
                        type="text"
                        value={createForm.phone}
                        onChange={e => setCreateForm({ ...createForm, phone: e.target.value })}
                        placeholder={isAr ? 'مثال: 01012345678' : 'e.g. 01012345678'}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {isAr ? 'العنوان' : 'Address'}
                    </label>
                    <input
                      type="text"
                      value={createForm.address}
                      onChange={e => setCreateForm({ ...createForm, address: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {isAr ? 'ملاحظات' : 'Notes'}
                    </label>
                    <input
                      type="text"
                      value={createForm.notes}
                      onChange={e => setCreateForm({ ...createForm, notes: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateModalSupplier(null)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 dark:text-slate-400 rounded-xl"
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={savingCreate}
                    className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-all disabled:opacity-50"
                  >
                    {savingCreate ? (isAr ? 'جاري الإنشاء والربط...' : 'Creating...') : (isAr ? 'تأكيد الإنشاء والربط' : 'Create & Link')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Unlink Confirmation Modal */}
      <AnimatePresence>
        {unlinkSupplierTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-md overflow-hidden p-6 space-y-4 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/50 text-red-600 mx-auto flex items-center justify-center">
                <Unlink className="w-6 h-6" />
              </div>

              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                  {isAr ? 'تأكيد إلغاء الربط' : 'Confirm Unlink'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {isAr
                    ? `هل أنت متأكد من رغبتك في إلغاء ربط المورد "${unlinkSupplierTarget.name}" بحسابه في النظام؟`
                    : `Are you sure you want to unlink supplier "${unlinkSupplierTarget.name}"?`}
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  onClick={() => setUnlinkSupplierTarget(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"
                >
                  {isAr ? 'تراجع' : 'Cancel'}
                </button>
                <button
                  onClick={handleConfirmUnlink}
                  disabled={unlinking}
                  className="px-5 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-sm transition-all disabled:opacity-50"
                >
                  {unlinking ? (isAr ? 'جاري الفك...' : 'Unlinking...') : (isAr ? 'تأكيد فك الربط' : 'Confirm Unlink')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
export default EtaSupplierMapping;
