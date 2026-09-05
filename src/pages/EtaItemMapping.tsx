import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  Link2,
  Unlink,
  CheckCircle2,
  AlertCircle,
  Search,
  RefreshCw,
  FileSpreadsheet,
  Plus,
  Sparkles,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Info,
  X,
  FileText,
  Tag,
  Layers,
  Barcode
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotification } from '../contexts/NotificationContext';
import { useNavigation } from '../contexts/NavigationContext';
import { apiRequest } from '../services/dbService';
import { formatMoney } from '../utils/formatUtils';
import { exportToExcel } from '../utils/excelUtils';

export interface EtaPortalItem {
  itemCode: string;
  itemType: string;
  itemName: string;
  description: string;
  unitType: string;
  lastUnitPrice: number;
  docCount: number;
  totalQuantity: number;
  totalAmount: number;
  lastDocDate: string | null;
  sampleDocument?: {
    uuid: string;
    internalId: string;
    issuerName: string;
    date: string;
  };
  isLinked: boolean;
  linkedProduct: {
    id: string;
    name: string;
    code: string;
    barcode?: string;
    taxItemCode?: string;
    taxCodeType?: string;
    unit?: string;
    salePrice?: number;
    costPrice?: number;
    stock?: number;
    linkedAt?: string;
  } | null;
  autoMatchedProduct: {
    id: string;
    name: string;
    code: string;
    taxItemCode?: string;
    taxCodeType?: string;
    barcode?: string;
    matchReason: 'tax_item_code' | 'code' | 'barcode' | 'exact_name';
  } | null;
}

export interface ItemMappingSummary {
  totalPortalItems: number;
  linkedItemsCount: number;
  unlinkedItemsCount: number;
  autoMatchCandidatesCount: number;
  totalDocumentsCount: number;
  totalInvoicedAmount: number;
}

interface ErpProductOption {
  id: string;
  name: string;
  code: string;
  barcode?: string;
  tax_item_code?: string;
  tax_code_type?: string;
  unit?: string;
  sale_price?: number;
  cost_price?: number;
}

export function EtaItemMapping() {
  const { language } = useLanguage();
  const { showNotification } = useNotification();
  const { openTab, setPendingEtaProductForCreation, setPendingEtaProductForLinking } = useNavigation();
  const isAr = language === 'ar';

  // Tabs: all = كل الأصناف الواردة من البوابة, linked = الأصناف المربوطة, unlinked = الأصناف غير المربوطة
  const [activeTab, setActiveTab] = useState<'all' | 'linked' | 'unlinked'>('all');

  // Loading & Data States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<EtaPortalItem[]>([]);
  const [summary, setSummary] = useState<ItemMappingSummary>({
    totalPortalItems: 0,
    linkedItemsCount: 0,
    unlinkedItemsCount: 0,
    autoMatchCandidatesCount: 0,
    totalDocumentsCount: 0,
    totalInvoicedAmount: 0
  });

  // ERP Products List for Manual Select Modal
  const [allErpProducts, setAllErpProducts] = useState<ErpProductOption[]>([]);
  const [loadingErpProducts, setLoadingErpProducts] = useState(false);
  const [manualLinkTarget, setManualLinkTarget] = useState<EtaPortalItem | null>(null);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCodeMatchedOnly, setFilterCodeMatchedOnly] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Copy item code state
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [savingLink, setSavingLink] = useState(false);

  // Unlink Confirmation Modal
  const [unlinkItemTarget, setUnlinkItemTarget] = useState<EtaPortalItem | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  // Bulk Quick-Link State
  const [bulkLinking, setBulkLinking] = useState(false);

  // Load items mappings from backend
  const loadMappings = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await apiRequest<{
        success: boolean;
        items: EtaPortalItem[];
        summary: ItemMappingSummary;
      }>(isRefresh ? '/eta/items/mapping?refresh=true' : '/eta/items/mapping');

      if (res && res.success) {
        setItems(res.items || []);
        setSummary(res.summary || {
          totalPortalItems: 0,
          linkedItemsCount: 0,
          unlinkedItemsCount: 0,
          autoMatchCandidatesCount: 0,
          totalDocumentsCount: 0,
          totalInvoicedAmount: 0
        });
      } else {
        showNotification(isAr ? 'فشل تحميل بيانات ربط الأصناف' : 'Failed to load item mappings', 'error');
      }
    } catch (err: any) {
      console.error('Error loading ETA item mappings:', err);
      showNotification(err.message || (isAr ? 'خطأ في جلب بيانات الأصناف' : 'Error loading items'), 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAr, showNotification]);

  useEffect(() => {
    loadMappings();
  }, [loadMappings]);

  // Load ERP Products for manual picker modal
  const loadErpProducts = async () => {
    if (allErpProducts.length > 0) return;
    try {
      setLoadingErpProducts(true);
      const res = await apiRequest<any[]>('/products');
      if (Array.isArray(res)) {
        setAllErpProducts(res.map(p => ({
          id: p.id,
          name: p.name,
          code: p.code,
          barcode: p.barcode,
          tax_item_code: p.tax_item_code,
          tax_code_type: p.tax_code_type,
          unit: p.unit,
          sale_price: p.sale_price,
          cost_price: p.cost_price
        })));
      }
    } catch (err) {
      console.error('Error loading ERP products list:', err);
    } finally {
      setLoadingErpProducts(false);
    }
  };

  const handleOpenManualLinkModal = (item: EtaPortalItem) => {
    setManualLinkTarget(item);
    setSelectedProductId(item.autoMatchedProduct?.id || '');
    setProductSearchQuery(item.itemName || item.itemCode || '');
    loadErpProducts();
  };

  // Confirm manual link from modal
  const handleConfirmManualLink = async () => {
    if (!manualLinkTarget || !selectedProductId) {
      showNotification(isAr ? 'الرجاء اختيار صنف للربط' : 'Please select a product', 'warning');
      return;
    }

    try {
      setSavingLink(true);
      const res = await apiRequest<{ success: boolean; message?: string }>('/eta/items/mapping/link', 'POST', {
        etaItemCode: manualLinkTarget.itemCode,
        productId: selectedProductId,
        etaItemName: manualLinkTarget.itemName,
        etaItemType: manualLinkTarget.itemType || 'EGS',
        notes: isAr ? 'ربط يدوي عبر شاشة ربط الأصناف' : 'Manual link from item mapping screen'
      });

      if (res && res.success) {
        showNotification(isAr ? 'تم ربط الصنف بنجاح' : 'Item linked successfully', 'success');
        setManualLinkTarget(null);
        setSelectedProductId('');
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

  // Quick link auto-matched item in 1-click
  const handleQuickLinkAutoMatch = async (item: EtaPortalItem) => {
    if (!item.autoMatchedProduct) return;

    try {
      setSavingLink(true);
      const res = await apiRequest<{ success: boolean; message?: string }>('/eta/items/mapping/link', 'POST', {
        etaItemCode: item.itemCode,
        productId: item.autoMatchedProduct.id,
        etaItemName: item.itemName,
        etaItemType: item.itemType || 'EGS',
        notes: isAr ? `ربط تلقائي مطابق لـ ${item.autoMatchedProduct.matchReason}` : 'Auto-linked'
      });

      if (res && res.success) {
        showNotification(
          isAr
            ? `تم ربط كود الصنف "${item.itemCode}" بنجاح مع الصنف "${item.autoMatchedProduct.name}"`
            : `Item linked successfully`,
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

  // Bulk Quick Link All Matched Items
  const handleBulkQuickLinkAll = async () => {
    if (summary.autoMatchCandidatesCount === 0) {
      showNotification(isAr ? 'لا توجد أصناف متطابقة جاهزة للربط التلقائي حالياً' : 'No matched items to link', 'info');
      return;
    }

    try {
      setBulkLinking(true);
      const res = await apiRequest<{ success: boolean; linkedCount: number; message?: string }>(
        '/eta/items/mapping/quick-link-all',
        'POST',
        {}
      );

      if (res && res.success) {
        showNotification(
          isAr
            ? `تم ربط ${res.linkedCount} صنف بنجاح وتحديث بيانات الضرائب!`
            : `Successfully linked ${res.linkedCount} items!`,
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

  // Unlink Item
  const handleConfirmUnlink = async () => {
    if (!unlinkItemTarget) return;

    try {
      setUnlinking(true);
      const res = await apiRequest<{ success: boolean; message?: string }>('/eta/items/mapping/unlink', 'POST', {
        etaItemCode: unlinkItemTarget.itemCode
      });

      if (res && res.success) {
        showNotification(isAr ? 'تم إلغاء ربط الصنف بنجاح' : 'Item unlinked successfully', 'success');
        setUnlinkItemTarget(null);
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

  // Golden Rule: Redirect to official Products screen to create with all official accounting accounts and link immediately
  const handleOpenCreateInProducts = (item: EtaPortalItem) => {
    setPendingEtaProductForCreation({
      itemCode: item.itemCode,
      itemName: item.itemName,
      itemType: item.itemType,
      unit: item.unitType || 'قطعة',
      salePrice: item.lastUnitPrice || 0,
      costPrice: item.lastUnitPrice || 0,
      description: item.description || item.itemName
    });
    openTab('products', isAr ? 'الأصناف' : 'Products');
    showNotification(
      isAr 
        ? `تم الانتقال لشاشة الأصناف لإنشاء الصنف "${item.itemName}". راجع الحسابات واضغط "حفظ وربط مع منظومة ETA فوراً".` 
        : `Switched to Products screen to create "${item.itemName}". Review accounts and click Save & Link to ETA.`,
      'info'
    );
  };

  // Copy code to clipboard
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Filtered Items based on Active Tab, Search Query, and Auto-Match Toggle
  const filteredItems = useMemo(() => {
    let list = items;

    if (activeTab === 'linked') {
      list = list.filter(i => i.isLinked);
    } else if (activeTab === 'unlinked') {
      list = list.filter(i => !i.isLinked);
    }

    if (filterCodeMatchedOnly) {
      list = list.filter(i => !i.isLinked && i.autoMatchedProduct !== null);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(i => 
        (i.itemCode && i.itemCode.toLowerCase().includes(q)) ||
        (i.itemName && i.itemName.toLowerCase().includes(q)) ||
        (i.description && i.description.toLowerCase().includes(q)) ||
        (i.linkedProduct && (i.linkedProduct.name.toLowerCase().includes(q) || i.linkedProduct.code.toLowerCase().includes(q))) ||
        (i.autoMatchedProduct && (i.autoMatchedProduct.name.toLowerCase().includes(q) || i.autoMatchedProduct.code.toLowerCase().includes(q)))
      );
    }

    return list;
  }, [items, activeTab, filterCodeMatchedOnly, searchQuery]);

  // Paginated Items
  const totalPages = pageSize === -1 ? 1 : Math.ceil(filteredItems.length / pageSize);
  const paginatedItems = useMemo(() => {
    if (pageSize === -1) return filteredItems;
    const start = (page - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page, pageSize]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [activeTab, searchQuery, filterCodeMatchedOnly, pageSize]);

  // Excel Export
  const handleExportExcel = () => {
    const dataToExport = filteredItems.map(i => ({
      [isAr ? 'كود الصنف ETA' : 'ETA Item Code']: i.itemCode,
      [isAr ? 'نوع الكود' : 'Code Type']: i.itemType,
      [isAr ? 'اسم الصنف بالبوابة' : 'Portal Item Name']: i.itemName,
      [isAr ? 'الوحدة' : 'Unit']: i.unitType,
      [isAr ? 'آخر سعر وحدة' : 'Last Unit Price']: i.lastUnitPrice,
      [isAr ? 'عدد الفواتير' : 'Doc Count']: i.docCount,
      [isAr ? 'إجمالي الكمية' : 'Total Quantity']: i.totalQuantity,
      [isAr ? 'إجمالي المبالغ' : 'Total Amount']: i.totalAmount,
      [isAr ? 'تاريخ آخر وثيقة' : 'Last Doc Date']: i.lastDocDate ? i.lastDocDate.slice(0, 10) : '',
      [isAr ? 'حالة الربط' : 'Link Status']: i.isLinked ? (isAr ? 'مربوط' : 'Linked') : (isAr ? 'غير مربوط' : 'Unlinked'),
      [isAr ? 'اسم الصنف الداخلي' : 'ERP Product Name']: i.linkedProduct?.name || '',
      [isAr ? 'كود الصنف الداخلي' : 'ERP Product Code']: i.linkedProduct?.code || ''
    }));

    exportToExcel(dataToExport, `ETA_Item_Mappings_${new Date().toISOString().slice(0, 10)}`);
  };

  // Filtered ERP Products for Modal Picker
  const modalFilteredProducts = useMemo(() => {
    if (!productSearchQuery.trim()) return allErpProducts.slice(0, 50);
    const q = productSearchQuery.trim().toLowerCase();
    return allErpProducts.filter(p => 
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.code && p.code.toLowerCase().includes(q)) ||
      (p.barcode && p.barcode.toLowerCase().includes(q)) ||
      (p.tax_item_code && p.tax_item_code.toLowerCase().includes(q))
    ).slice(0, 50);
  }, [allErpProducts, productSearchQuery]);

  return (
    <div className="space-y-6 pb-16">
      {/* Header & Action Bar */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Package size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3">
              <span>{isAr ? 'ربط الأصناف مع منظومة الضرائب (ETA)' : 'ETA Item Mapping'}</span>
              <span className="text-xs font-bold px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
                {summary.totalPortalItems} {isAr ? 'صنف مستخرج' : 'Extracted Items'}
              </span>
            </h1>
            <p className="text-sm font-medium text-slate-500 mt-1">
              {isAr 
                ? 'مطابقة وربط بنود الأصناف الواردة من وثائق الفاتورة الإلكترونية مع دليل أصناف المخزن الحالي.'
                : 'Map incoming electronic portal items with your existing ERP product catalog.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {summary.autoMatchCandidatesCount > 0 && (
            <button
              type="button"
              onClick={handleBulkQuickLinkAll}
              disabled={bulkLinking}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-bold text-sm hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md shadow-emerald-500/20 flex items-center gap-2 disabled:opacity-60"
            >
              <Sparkles size={16} className={bulkLinking ? 'animate-spin' : ''} />
              <span>
                {isAr 
                  ? `ربط الكل تلقائياً (${summary.autoMatchCandidatesCount})` 
                  : `Bulk Link Matched (${summary.autoMatchCandidatesCount})`}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportExcel}
            className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-sm border border-slate-200 transition-all flex items-center gap-2"
          >
            <FileSpreadsheet size={16} className="text-emerald-600" />
            <span>{isAr ? 'تصدير Excel' : 'Export'}</span>
          </button>

          <button
            type="button"
            onClick={() => loadMappings(true)}
            disabled={refreshing || loading}
            className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-sm border border-slate-200 transition-all flex items-center gap-2 disabled:opacity-60"
            title={isAr ? 'تحديث البيانات من الفواتير المستلمة' : 'Refresh from synced documents'}
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin text-indigo-600' : ''} />
            <span>{isAr ? 'تحديث' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Portal Items */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 block mb-1">
              {isAr ? 'إجمالي أصناف البوابة' : 'Total Portal Items'}
            </span>
            <div className="text-3xl font-black text-slate-900">{summary.totalPortalItems}</div>
            <div className="text-xs text-slate-500 mt-2 flex items-center gap-1 font-medium">
              <span>{formatMoney(summary.totalInvoicedAmount)}</span>
              <span className="text-slate-400 text-[11px]">{isAr ? 'ج.م' : 'EGP'}</span>
            </div>
          </div>
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
            <Package size={26} />
          </div>
        </div>

        {/* Linked Items */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 block mb-1">
              {isAr ? 'الأصناف المربوطة' : 'Linked Items'}
            </span>
            <div className="text-3xl font-black text-emerald-600 flex items-center gap-2">
              <span>{summary.linkedItemsCount}</span>
              {summary.totalPortalItems > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full">
                  {Math.round((summary.linkedItemsCount / summary.totalPortalItems) * 100)}%
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-2 font-medium">
              {isAr ? 'جاهزة ومطابقة في النظام' : 'Ready and mapped'}
            </div>
          </div>
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
            <CheckCircle2 size={26} />
          </div>
        </div>

        {/* Unlinked Items */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 block mb-1">
              {isAr ? 'أصناف غير مربوطة' : 'Unlinked Items'}
            </span>
            <div className="text-3xl font-black text-amber-600">{summary.unlinkedItemsCount}</div>
            <div className="text-xs text-slate-500 mt-2 font-medium">
              {isAr ? 'تحتاج إلى ربط أو إنشاء' : 'Pending linking or creation'}
            </div>
          </div>
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
            <AlertCircle size={26} />
          </div>
        </div>

        {/* Auto-Match Candidates */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 block mb-1">
              {isAr ? 'تطابقات كود الصنف المقترحة' : 'Auto-Match Candidates'}
            </span>
            <div className="text-3xl font-black text-purple-600">{summary.autoMatchCandidatesCount}</div>
            <div className="text-xs text-slate-500 mt-2 font-medium flex items-center gap-1">
              <Sparkles size={12} className="text-purple-500" />
              <span>{isAr ? 'تطابق جاهز للربط بنقرة واحدة' : 'Ready 1-click match'}</span>
            </div>
          </div>
          <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
            <Sparkles size={26} />
          </div>
        </div>
      </div>

      {/* Tabs & Search Filter Bar */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
        {/* Three Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
                activeTab === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Package size={16} />
              <span>{isAr ? 'كل الأصناف الواردة من البوابة' : 'All Portal Items'}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'all' ? 'bg-slate-100 text-slate-800' : 'bg-slate-200 text-slate-600'}`}>
                {items.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('linked')}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
                activeTab === 'linked'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 size={16} />
              <span>{isAr ? 'الأصناف المربوطة' : 'Linked Items'}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'linked' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>
                {summary.linkedItemsCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('unlinked')}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
                activeTab === 'unlinked'
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <AlertCircle size={16} />
              <span>{isAr ? 'الأصناف غير المربوطة' : 'Unlinked Items'}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'unlinked' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>
                {summary.unlinkedItemsCount}
              </span>
            </button>
          </div>

          {/* Golden Rule Tip Banner */}
          <div className="hidden lg:flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50/80 px-4 py-2 rounded-2xl border border-emerald-200">
            <Info size={16} className="text-emerald-600 flex-shrink-0" />
            <span>
              {isAr 
                ? 'القاعدة الذهبية: يتم إنشاء الصنف من خلال شاشة الأصناف المعتمدة لضمان تطبيق كافة القيود المحاسبية.'
                : 'Golden Rule: Products are created via official Products screen to enforce all accounting rules.'}
            </span>
          </div>
        </div>

        {/* Search Input & Toggles */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute start-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isAr 
                  ? 'بحث بكود الصنف في الضرائب (EG-...)، اسم الصنف، الوصف، أو الصنف المقترن...' 
                  : 'Search by ETA item code, item name, description, or matched product...'
              }
              className="w-full ps-11 pe-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-400 placeholder:font-normal"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute end-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {activeTab !== 'linked' && summary.autoMatchCandidatesCount > 0 && (
              <button
                type="button"
                onClick={() => setFilterCodeMatchedOnly(prev => !prev)}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 border ${
                  filterCodeMatchedOnly
                    ? 'bg-purple-50 text-purple-700 border-purple-300'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Sparkles size={14} className={filterCodeMatchedOnly ? 'text-purple-600' : 'text-slate-400'} />
                <span>
                  {isAr 
                    ? `عرض المرشحين للربط التلقائي فقط (${summary.autoMatchCandidatesCount})` 
                    : `Auto-match candidates only (${summary.autoMatchCandidatesCount})`}
                </span>
              </button>
            )}

            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <span>{isAr ? 'عدد السجلات:' : 'Rows:'}</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-transparent font-black text-slate-900 outline-none cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
                <option value={1000}>1000</option>
                <option value={-1}>{isAr ? 'الكل' : 'All'}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center space-y-4">
            <RefreshCw className="w-10 h-10 animate-spin text-indigo-600 mx-auto" />
            <p className="text-sm font-bold text-slate-500">
              {isAr ? 'جاري قراءة واستخراج الأصناف من الفواتير...' : 'Extracting portal items from invoices...'}
            </p>
          </div>
        ) : paginatedItems.length === 0 ? (
          <div className="p-16 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center mx-auto">
              <Package size={32} />
            </div>
            <h3 className="text-lg font-black text-slate-800">
              {isAr ? 'لا توجد أصناف تطابق معايير البحث' : 'No items match the search criteria'}
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {isAr 
                ? 'تأكد من اختيار التبويب المناسب أو إعادة ضبط كلمة البحث.' 
                : 'Check your search filters or active tab.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs font-black uppercase tracking-wider">
                  <th className="p-4 text-start">{isAr ? 'كود الصنف بالضرائب (ETA)' : 'ETA Item Code'}</th>
                  <th className="p-4 text-start">{isAr ? 'اسم الصنف بالبوابة والوصف' : 'Portal Item Name & Description'}</th>
                  <th className="p-4 text-center">{isAr ? 'الوحدة والسعر' : 'Unit & Price'}</th>
                  <th className="p-4 text-center">{isAr ? 'الوثائق والكميات' : 'Docs & Quantity'}</th>
                  <th className="p-4 text-start">{isAr ? 'حالة الربط والصنف المقترن' : 'Link Status & Mapped Product'}</th>
                  <th className="p-4 text-center">{isAr ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {paginatedItems.map((item) => {
                  return (
                    <tr 
                      key={item.itemCode} 
                      className={`hover:bg-slate-50/80 transition-colors ${
                        !item.isLinked && item.autoMatchedProduct ? 'bg-purple-50/20' : ''
                      }`}
                    >
                      {/* ETA Item Code & Type */}
                      <td className="p-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-black text-slate-900 text-sm bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {item.itemCode}
                            </span>
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
                              {item.itemType || 'EGS'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyCode(item.itemCode)}
                              className="text-slate-400 hover:text-slate-700 transition-colors p-1"
                              title={isAr ? 'نسخ كود الصنف' : 'Copy item code'}
                            >
                              {copiedCode === item.itemCode ? (
                                <Check size={14} className="text-emerald-600" />
                              ) : (
                                <Copy size={14} />
                              )}
                            </button>
                          </div>
                          {item.sampleDocument?.issuerName && (
                            <div className="text-[11px] text-slate-500 truncate max-w-xs font-medium">
                              {isAr ? 'المورد:' : 'Supplier:'} {item.sampleDocument.issuerName}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Portal Item Name & Description */}
                      <td className="p-4">
                        <div className="space-y-1 max-w-md">
                          <div className="font-black text-slate-900 text-sm leading-snug">
                            {item.itemName}
                          </div>
                          {item.description && item.description !== item.itemName && (
                            <div className="text-xs text-slate-500 line-clamp-1 font-medium">
                              {item.description}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Unit & Unit Price */}
                      <td className="p-4 text-center">
                        <div className="space-y-1">
                          {item.lastUnitPrice > 0 && (
                            <div className="font-black text-slate-900 text-sm font-mono">
                              {formatMoney(item.lastUnitPrice)} <span className="text-[10px] font-bold text-slate-400">{isAr ? 'ج.م' : 'EGP'}</span>
                            </div>
                          )}
                          {item.unitType && (
                            <span className="inline-block text-[11px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                              {item.unitType}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Docs & Quantity */}
                      <td className="p-4 text-center">
                        <div className="space-y-1">
                          <div className="font-black text-slate-900 text-sm">
                            {item.docCount} {isAr ? 'فاتورة' : 'docs'}
                          </div>
                          <div className="text-xs text-slate-500 font-medium">
                            {formatMoney(item.totalAmount)} {isAr ? 'ج.م' : 'EGP'}
                          </div>
                          {item.lastDocDate && (
                            <div className="text-[10px] text-slate-400 font-medium">
                              {item.lastDocDate.slice(0, 10)}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Link Status & Mapped Product */}
                      <td className="p-4">
                        {item.isLinked && item.linkedProduct ? (
                          <div className="flex items-start gap-2.5">
                            <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg mt-0.5">
                              <CheckCircle2 size={16} />
                            </div>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-black text-emerald-900 text-sm">
                                  {item.linkedProduct.name}
                                </span>
                                <span className="font-mono text-[11px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                  {item.linkedProduct.code}
                                </span>
                              </div>
                              <div className="text-xs text-slate-500 flex items-center gap-2 font-medium">
                                {item.linkedProduct.barcode && (
                                  <span>{isAr ? 'باركود:' : 'Barcode:'} {item.linkedProduct.barcode}</span>
                                )}
                                {item.linkedProduct.unit && (
                                  <span>• {item.linkedProduct.unit}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : item.autoMatchedProduct ? (
                          <div className="p-2.5 bg-purple-50 rounded-2xl border border-purple-200/80 space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-bold text-purple-700 flex items-center gap-1">
                                <Sparkles size={12} className="text-purple-600" />
                                <span>
                                  {item.autoMatchedProduct.matchReason === 'tax_item_code' 
                                    ? (isAr ? 'تطابق كود الضرائب' : 'Tax Code Match')
                                    : (item.autoMatchedProduct.matchReason === 'code'
                                      ? (isAr ? 'تطابق كود الصنف' : 'Product Code Match')
                                      : (item.autoMatchedProduct.matchReason === 'barcode'
                                        ? (isAr ? 'تطابق الباركود' : 'Barcode Match')
                                        : (isAr ? 'تطابق الاسم بدقة' : 'Exact Name Match')))}
                                </span>
                              </span>
                              <span className="text-[10px] font-mono font-bold bg-white text-purple-900 px-1.5 py-0.5 rounded border border-purple-200">
                                {item.autoMatchedProduct.code}
                              </span>
                            </div>
                            <div className="font-black text-slate-900 text-xs">
                              {item.autoMatchedProduct.name}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-amber-600 font-bold text-xs bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 w-fit">
                            <AlertCircle size={14} />
                            <span>{isAr ? 'غير مربوط (يحتاج ربط أو إنشاء)' : 'Unlinked'}</span>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                          {item.isLinked ? (
                            <button
                              type="button"
                              onClick={() => setUnlinkItemTarget(item)}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-rose-200"
                              title={isAr ? 'إلغاء ربط الصنف' : 'Unlink product'}
                            >
                              <Unlink size={14} />
                              <span>{isAr ? 'إلغاء الربط' : 'Unlink'}</span>
                            </button>
                          ) : (
                            <>
                              {item.autoMatchedProduct && (
                                <button
                                  type="button"
                                  onClick={() => handleQuickLinkAutoMatch(item)}
                                  disabled={savingLink}
                                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm shadow-emerald-600/30 active:scale-95 disabled:opacity-60"
                                  title={isAr ? 'تأكيد الربط مع الصنف المقترح فوراً' : 'Confirm link'}
                                >
                                  <Check size={14} />
                                  <span>{isAr ? 'تأكيد الربط' : 'Confirm'}</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleOpenManualLinkModal(item)}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border border-slate-200"
                                title={isAr ? 'اختيار صنف موجود من المخزن' : 'Link with existing product'}
                              >
                                <Link2 size={14} />
                                <span>{isAr ? 'ربط بصنف' : 'Link'}</span>
                              </button>

                              {/* Golden Rule: Opens official Products screen */}
                              <button
                                type="button"
                                onClick={() => handleOpenCreateInProducts(item)}
                                className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1 shadow-sm shadow-indigo-600/20 active:scale-95"
                                title={isAr ? 'إنشاء صنف جديد بشاشة الأصناف وتطبيق القاعدة الذهبية' : 'Create new product via official screen'}
                              >
                                <Plus size={14} />
                                <span>{isAr ? '+ إنشاء جديد' : '+ Create'}</span>
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
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between gap-4 flex-wrap text-xs">
            <div className="text-slate-500 font-medium">
              {isAr ? 'عرض' : 'Showing'}{' '}
              <span className="font-black text-slate-800">
                {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, filteredItems.length)}
              </span>{' '}
              {isAr ? 'من إجمالي' : 'of'}{' '}
              <span className="font-black text-slate-800">{filteredItems.length}</span>{' '}
              {isAr ? 'صنف' : 'items'}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={16} />
              </button>

              <span className="px-3 py-1.5 rounded-xl font-black text-slate-800 bg-slate-50 border border-slate-200">
                {page} / {totalPages}
              </span>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Manual Link Modal (Select existing ERP Product) */}
      <AnimatePresence>
        {manualLinkTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-xl w-full shadow-2xl border border-slate-100 space-y-5 max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                    <Link2 size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">
                      {isAr ? 'ربط صنف من الفاتورة بصنف في المخزن' : 'Link Item with ERP Product'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {isAr ? 'اختر الصنف المطابق من قائمة أصناف الشركة الحالية' : 'Select the matching product from your ERP list'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setManualLinkTarget(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Target ETA Item Details */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-500">{isAr ? 'كود الصنف ETA:' : 'ETA Item Code:'}</span>
                  <span className="font-mono font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    {manualLinkTarget.itemCode}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-500">{isAr ? 'اسم الصنف بالبوابة:' : 'Portal Item Name:'}</span>
                  <span className="font-black text-slate-900">{manualLinkTarget.itemName}</span>
                </div>
                {manualLinkTarget.lastUnitPrice > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-500">{isAr ? 'سعر الوحدة بالفاتورة:' : 'Price:'}</span>
                    <span className="font-black text-slate-900 font-mono">
                      {formatMoney(manualLinkTarget.lastUnitPrice)} {isAr ? 'ج.م' : 'EGP'}
                    </span>
                  </div>
                )}
              </div>

              {/* Search in ERP Products */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  {isAr ? 'ابحث عن الصنف في المخزن:' : 'Search ERP Products:'}
                </label>
                <div className="relative">
                  <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={productSearchQuery}
                    onChange={(e) => setProductSearchQuery(e.target.value)}
                    placeholder={isAr ? 'اسم الصنف، الكود، الباركود...' : 'Product name, code, barcode...'}
                    className="w-full ps-10 pe-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              {/* Products List */}
              <div className="flex-1 overflow-y-auto max-h-64 border border-slate-100 rounded-2xl divide-y divide-slate-100 custom-scrollbar">
                {loadingErpProducts ? (
                  <div className="p-8 text-center text-xs text-slate-400 font-bold">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                    <span>{isAr ? 'جاري تحميل الأصناف...' : 'Loading products...'}</span>
                  </div>
                ) : modalFilteredProducts.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 font-bold">
                    {isAr ? 'لا توجد نتائج تطابق البحث' : 'No matching products found'}
                  </div>
                ) : (
                  modalFilteredProducts.map(p => (
                    <label
                      key={p.id}
                      className={`p-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-indigo-50/40 transition-colors ${
                        selectedProductId === p.id ? 'bg-indigo-50 border-s-4 border-indigo-600' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="selectedProduct"
                          value={p.id}
                          checked={selectedProductId === p.id}
                          onChange={() => setSelectedProductId(p.id)}
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <div className="font-black text-slate-900 text-xs">{p.name}</div>
                          <div className="text-[10px] text-slate-500 font-medium flex items-center gap-2 mt-0.5">
                            <span className="font-mono">{p.code}</span>
                            {p.barcode && <span>• {isAr ? 'باركود:' : 'Barcode:'} {p.barcode}</span>}
                            {p.unit && <span>• {p.unit}</span>}
                          </div>
                        </div>
                      </div>
                      {p.sale_price !== undefined && (
                        <div className="text-end font-mono font-bold text-xs text-slate-700">
                          {formatMoney(p.sale_price)} <span className="text-[10px] text-slate-400">{isAr ? 'ج.م' : 'EGP'}</span>
                        </div>
                      )}
                    </label>
                  ))
                )}
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    if (manualLinkTarget) {
                      const t = manualLinkTarget;
                      setManualLinkTarget(null);
                      handleOpenCreateInProducts(t);
                    }
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  <span>{isAr ? 'إنشاء صنف جديد بدلاً من الربط' : 'Create new instead'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setManualLinkTarget(null)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all"
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmManualLink}
                    disabled={!selectedProductId || savingLink}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs transition-all flex items-center gap-1.5 shadow-md shadow-indigo-600/30 disabled:opacity-50"
                  >
                    <Check size={14} />
                    <span>{isAr ? 'تأكيد الربط' : 'Confirm Link'}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Unlink Confirmation Modal */}
      <AnimatePresence>
        {unlinkItemTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4 text-center"
            >
              <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
                <Unlink size={28} />
              </div>
              <h3 className="text-lg font-black text-slate-900">
                {isAr ? 'تأكيد إلغاء ربط الصنف' : 'Confirm Unlink'}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {isAr 
                  ? `هل أنت متأكد من فك ارتباط كود الصنف "${unlinkItemTarget.itemCode}" مع الصنف "${unlinkItemTarget.linkedProduct?.name}"؟ يمكنك إعادة ربطه في أي وقت.`
                  : `Are you sure you want to unlink "${unlinkItemTarget.itemCode}"?`}
              </p>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setUnlinkItemTarget(null)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all"
                >
                  {isAr ? 'تراجع' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmUnlink}
                  disabled={unlinking}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs transition-all shadow-md shadow-rose-600/30 disabled:opacity-60"
                >
                  {unlinking ? (isAr ? 'جاري الفك...' : 'Unlinking...') : (isAr ? 'تأكيد فك الربط' : 'Yes, Unlink')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
export default EtaItemMapping;
