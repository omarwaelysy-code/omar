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
  Barcode,
  Building2,
  ChevronDown,
  ChevronUp
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
  supplierTaxNumber?: string;
  supplierName?: string;
  suppliers?: Array<{
    taxNumber: string;
    name: string;
    docCount: number;
  }>;
  sampleDocument?: {
    uuid: string;
    internalId: string;
    issuerName: string;
    issuerId?: string;
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

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCodeMatchedOnly, setFilterCodeMatchedOnly] = useState(false);

  // Grouping by Supplier (Collapsible)
  const [groupBySupplier, setGroupBySupplier] = useState(false);
  const [expandedSuppliers, setExpandedSuppliers] = useState<Record<string, boolean>>({});

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
  // Golden Rule: Switch to official Products screen to search and link with existing ERP product
  const handleLinkInProductsScreen = (item: EtaPortalItem) => {
    setPendingEtaProductForLinking(item);
    openTab('products');
    showNotification(
      isAr 
        ? `تم الانتقال لدليل الأصناف للبحث عن الصنف المناسب وربطه بكود الضرائب "${item.itemCode}".`
        : `Switched to Products catalog to search and link with ETA code "${item.itemCode}".`,
      'info'
    );
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
        (i.supplierName && i.supplierName.toLowerCase().includes(q)) ||
        (i.supplierTaxNumber && i.supplierTaxNumber.includes(q)) ||
        (i.sampleDocument?.issuerName && i.sampleDocument.issuerName.toLowerCase().includes(q)) ||
        (i.sampleDocument?.issuerId && i.sampleDocument.issuerId.includes(q)) ||
        (i.linkedProduct && (i.linkedProduct.name.toLowerCase().includes(q) || i.linkedProduct.code.toLowerCase().includes(q))) ||
        (i.autoMatchedProduct && (i.autoMatchedProduct.name.toLowerCase().includes(q) || i.autoMatchedProduct.code.toLowerCase().includes(q)))
      );
    }

    return list;
  }, [items, activeTab, filterCodeMatchedOnly, searchQuery]);

  // Paginated Items (for Flat View)
  const totalPages = pageSize === -1 ? 1 : Math.ceil(filteredItems.length / pageSize);
  const paginatedItems = useMemo(() => {
    if (pageSize === -1) return filteredItems;
    const start = (page - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page, pageSize]);

  // Supplier Groups (for Grouped Accordion View)
  interface SupplierGroup {
    key: string;
    taxNumber: string;
    name: string;
    items: EtaPortalItem[];
    totalDocs: number;
    totalAmount: number;
    linkedCount: number;
    unlinkedCount: number;
    autoMatchCount: number;
  }

  const supplierGroups = useMemo(() => {
    if (!groupBySupplier) return [];
    const groupsMap = new Map<string, SupplierGroup>();

    for (const item of filteredItems) {
      const taxNumber = (item.supplierTaxNumber || item.sampleDocument?.issuerId || '').trim();
      const name = (item.supplierName || item.sampleDocument?.issuerName || (isAr ? 'مورد غير محدد' : 'Unknown Supplier')).trim();
      const key = taxNumber || name || 'unknown';

      let group = groupsMap.get(key);
      if (!group) {
        group = {
          key,
          taxNumber,
          name,
          items: [],
          totalDocs: 0,
          totalAmount: 0,
          linkedCount: 0,
          unlinkedCount: 0,
          autoMatchCount: 0
        };
        groupsMap.set(key, group);
      }

      group.items.push(item);
      group.totalDocs += item.docCount || 1;
      group.totalAmount += item.totalAmount || 0;
      if (item.isLinked) {
        group.linkedCount++;
      } else {
        group.unlinkedCount++;
        if (item.autoMatchedProduct) group.autoMatchCount++;
      }
    }

    return Array.from(groupsMap.values()).sort((a, b) => b.totalAmount - a.totalAmount || b.items.length - a.items.length);
  }, [filteredItems, groupBySupplier, isAr]);

  // Paginated Groups
  const totalGroupPages = pageSize === -1 ? 1 : Math.ceil(supplierGroups.length / pageSize);
  const paginatedGroups = useMemo(() => {
    if (!groupBySupplier) return [];
    if (pageSize === -1) return supplierGroups;
    const start = (page - 1) * pageSize;
    return supplierGroups.slice(start, start + pageSize);
  }, [supplierGroups, groupBySupplier, page, pageSize]);

  const activeTotalPages = groupBySupplier ? totalGroupPages : totalPages;

  // Toggle single group open/close
  const isGroupExpanded = useCallback((groupKey: string) => {
    return expandedSuppliers[groupKey] ?? true;
  }, [expandedSuppliers]);

  const toggleGroup = useCallback((groupKey: string) => {
    setExpandedSuppliers(prev => ({
      ...prev,
      [groupKey]: !(prev[groupKey] ?? true)
    }));
  }, []);

  // Expand all groups
  const expandAllGroups = useCallback(() => {
    const state: Record<string, boolean> = {};
    supplierGroups.forEach(g => {
      state[g.key] = true;
    });
    setExpandedSuppliers(state);
  }, [supplierGroups]);

  // Collapse all groups
  const collapseAllGroups = useCallback(() => {
    const state: Record<string, boolean> = {};
    supplierGroups.forEach(g => {
      state[g.key] = false;
    });
    setExpandedSuppliers(state);
  }, [supplierGroups]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [activeTab, searchQuery, filterCodeMatchedOnly, pageSize, groupBySupplier]);

  // Excel Export
  const handleExportExcel = () => {
    const dataToExport = filteredItems.map(i => ({
      [isAr ? 'كود الصنف ETA' : 'ETA Item Code']: i.itemCode,
      [isAr ? 'نوع الكود' : 'Code Type']: i.itemType,
      [isAr ? 'اسم الصنف بالبوابة' : 'Portal Item Name']: i.itemName,
      [isAr ? 'اسم المورد' : 'Supplier Name']: i.supplierName || (i.sampleDocument?.issuerName || ''),
      [isAr ? 'الرقم الضريبي للمورد' : 'Supplier Tax ID']: i.supplierTaxNumber || (i.sampleDocument?.issuerId || ''),
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

  // Helper to render an item table row
  const renderItemRow = (item: EtaPortalItem, showSupplierCols: boolean) => {
    const primaryTaxId = (item.supplierTaxNumber || item.sampleDocument?.issuerId || '').trim();
    const primarySupplierName = (item.supplierName || item.sampleDocument?.issuerName || '').trim();

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
            {!showSupplierCols && primarySupplierName && (
              <div className="text-[11px] text-slate-500 truncate max-w-xs font-medium">
                {isAr ? 'المورد:' : 'Supplier:'} {primarySupplierName}
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

        {/* Supplier Name Column (Only in Flat View) */}
        {showSupplierCols && (
          <td className="p-4">
            <div className="space-y-1">
              <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <Building2 size={15} className="text-indigo-500 flex-shrink-0" />
                <span className="truncate max-w-[170px]" title={primarySupplierName || (isAr ? 'غير محدد' : '---')}>
                  {primarySupplierName || (isAr ? 'مورد غير محدد' : '---')}
                </span>
              </div>
              {item.suppliers && item.suppliers.length > 1 && (
                <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                  +{item.suppliers.length - 1} {isAr ? 'موردين آخرين' : 'other suppliers'}
                </span>
              )}
            </div>
          </td>
        )}

        {/* Supplier Tax ID Column (Only in Flat View) */}
        {showSupplierCols && (
          <td className="p-4">
            {primaryTaxId ? (
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
                  {primaryTaxId}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyCode(primaryTaxId)}
                  className="text-slate-400 hover:text-slate-700 p-1"
                  title={isAr ? 'نسخ الرقم الضريبي' : 'Copy Tax ID'}
                >
                  {copiedCode === primaryTaxId ? (
                    <Check size={13} className="text-emerald-600" />
                  ) : (
                    <Copy size={13} />
                  )}
                </button>
              </div>
            ) : (
              <span className="text-xs text-slate-400 font-mono">---</span>
            )}
          </td>
        )}

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
                  onClick={() => handleLinkInProductsScreen(item)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border border-slate-200"
                  title={isAr ? 'البحث عن الصنف في شاشة الأصناف وربطه' : 'Search and link in Products screen'}
                >
                  <Link2 size={14} />
                  <span>{isAr ? 'ربط بصنف' : 'Link'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenCreateInProducts(item)}
                  className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1 shadow-sm shadow-indigo-600/20 active:scale-95"
                  title={isAr ? 'إنشاء صنف جديد بشاشة الأصناف' : 'Create new product in Products screen'}
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
  };

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

            {/* Group By Supplier Toggle */}
            <button
              type="button"
              onClick={() => setGroupBySupplier(prev => !prev)}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 border shadow-2xs ${
                groupBySupplier
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-600/20'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
              title={isAr ? 'تجميع الأصناف حسب المورد مع إمكانية فتح وطي المجموعات' : 'Group items by supplier with collapsible accordions'}
            >
              <Layers size={14} className={groupBySupplier ? 'text-white' : 'text-indigo-600'} />
              <span>
                {groupBySupplier 
                  ? (isAr ? 'عرض مجمع (حسب المورد)' : 'Grouped by Supplier') 
                  : (isAr ? 'تجميع حسب المورد (ضم وفتح)' : 'Group by Supplier')}
              </span>
            </button>

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

      {/* Main Table / Grouped View */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center space-y-4">
            <RefreshCw className="w-10 h-10 animate-spin text-indigo-600 mx-auto" />
            <p className="text-sm font-bold text-slate-500">
              {isAr ? 'جاري قراءة واستخراج الأصناف من الفواتير...' : 'Extracting portal items from invoices...'}
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
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
        ) : groupBySupplier ? (
          /* ================= Grouped View (By Supplier with Collapsible Accordions) ================= */
          <div className="space-y-0">
            {/* Toolbar for Expand/Collapse All */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-slate-50 border-b border-slate-200/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                  <Building2 size={18} />
                </div>
                <div>
                  <span className="font-black text-slate-900 text-sm block">
                    {isAr 
                      ? `مجموعات الموردين (${supplierGroups.length} مورد)` 
                      : `Supplier Groups (${supplierGroups.length} suppliers)`}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    {filteredItems.length} {isAr ? 'صنف مستخرج من الفواتير' : 'extracted items'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={expandAllGroups}
                  className="px-3.5 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 transition-all shadow-2xs flex items-center gap-1.5"
                >
                  <ChevronDown size={14} />
                  <span>{isAr ? 'فتح الكل' : 'Expand All'}</span>
                </button>

                <button
                  type="button"
                  onClick={collapseAllGroups}
                  className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all shadow-2xs flex items-center gap-1.5"
                >
                  <ChevronUp size={14} />
                  <span>{isAr ? 'طي الكل' : 'Collapse All'}</span>
                </button>
              </div>
            </div>

            {/* List of Supplier Groups */}
            <div className="divide-y divide-slate-100">
              {paginatedGroups.map((group) => {
                const isExpanded = isGroupExpanded(group.key);

                return (
                  <div key={group.key} className="transition-colors">
                    {/* Collapsible Header */}
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.key)}
                      className={`w-full text-start px-6 py-4 transition-all flex items-center justify-between gap-4 ${
                        isExpanded ? 'bg-indigo-50/40 hover:bg-indigo-50/60' : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors ${
                          isExpanded 
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' 
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          <Building2 size={20} />
                        </div>

                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-slate-900 text-base">
                              {group.name}
                            </span>
                            {group.taxNumber && (
                              <span className="font-mono text-xs font-bold bg-white text-slate-700 px-2.5 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                                {isAr ? 'ضريبي:' : 'Tax:'} {group.taxNumber}
                              </span>
                            )}
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-xl text-xs font-black border transition-all ${
                              isExpanded 
                                ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs' 
                                : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            }`}>
                              {isExpanded ? <ChevronUp size={13} className="stroke-[3]" /> : <ChevronDown size={13} className="stroke-[3]" />}
                              <span>
                                {isExpanded 
                                  ? (isAr ? 'مفتوح (انقر للطي ▲)' : 'Open (Click to collapse ▲)') 
                                  : (isAr ? 'مغلق (انقر للفتح ▼)' : 'Closed (Click to expand ▼)')}
                              </span>
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-2 font-medium flex-wrap">
                            <span className="font-bold text-slate-700">{group.items.length} {isAr ? 'صنف' : 'items'}</span>
                            <span>•</span>
                            <span>{group.totalDocs} {isAr ? 'فاتورة' : 'docs'}</span>
                            <span>•</span>
                            <span className="font-black text-indigo-700 font-mono">{formatMoney(group.totalAmount)} {isAr ? 'ج.م' : 'EGP'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="hidden sm:flex items-center gap-2">
                          <span className="text-xs font-bold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
                            {group.linkedCount} {isAr ? 'مربوط' : 'Linked'}
                          </span>
                          {group.unlinkedCount > 0 && (
                            <span className="text-xs font-bold px-2.5 py-1 bg-amber-50 text-amber-700 rounded-xl border border-amber-200">
                              {group.unlinkedCount} {isAr ? 'غير مربوط' : 'Unlinked'}
                            </span>
                          )}
                          {group.autoMatchCount > 0 && (
                            <span className="text-xs font-bold px-2.5 py-1 bg-purple-50 text-purple-700 rounded-xl border border-purple-200 flex items-center gap-1">
                              <Sparkles size={12} className="text-purple-600" />
                              <span>{group.autoMatchCount} {isAr ? 'مقترح' : 'Match'}</span>
                            </span>
                          )}
                        </div>

                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs transition-all border shadow-2xs ${
                          isExpanded 
                            ? 'bg-indigo-600 text-white border-indigo-700' 
                            : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'
                        }`}>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          <span>{isExpanded ? (isAr ? 'طي الأصناف ▲' : 'Collapse Items ▲') : (isAr ? 'عرض الأصناف ▼' : 'Show Items ▼')}</span>
                        </div>
                      </div>
                    </button>

                    {/* Inside Group Table */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-white overflow-x-auto">
                        <table className="w-full text-start border-collapse">
                          <thead>
                            <tr className="bg-slate-50/60 border-b border-slate-100 text-slate-500 text-xs font-black uppercase tracking-wider">
                              <th className="p-4 text-start">{isAr ? 'كود الصنف بالضرائب (ETA)' : 'ETA Item Code'}</th>
                              <th className="p-4 text-start">{isAr ? 'اسم الصنف بالبوابة والوصف' : 'Portal Item Name & Description'}</th>
                              <th className="p-4 text-center">{isAr ? 'الوحدة والسعر' : 'Unit & Price'}</th>
                              <th className="p-4 text-center">{isAr ? 'الوثائق والكميات' : 'Docs & Quantity'}</th>
                              <th className="p-4 text-start">{isAr ? 'حالة الربط والصنف المقترن' : 'Link Status & Mapped Product'}</th>
                              <th className="p-4 text-center">{isAr ? 'الإجراءات' : 'Actions'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-sm">
                            {group.items.map((item) => renderItemRow(item, false))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ================= Flat Table View (With Explicit Supplier & Tax ID Columns) ================= */
          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs font-black uppercase tracking-wider">
                  <th className="p-4 text-start">{isAr ? 'كود الصنف بالضرائب (ETA)' : 'ETA Item Code'}</th>
                  <th className="p-4 text-start">{isAr ? 'اسم الصنف بالبوابة والوصف' : 'Portal Item Name & Description'}</th>
                  <th className="p-4 text-start">{isAr ? 'اسم المورد' : 'Supplier Name'}</th>
                  <th className="p-4 text-start">{isAr ? 'الرقم الضريبي' : 'Tax ID'}</th>
                  <th className="p-4 text-center">{isAr ? 'الوحدة والسعر' : 'Unit & Price'}</th>
                  <th className="p-4 text-center">{isAr ? 'الوثائق والكميات' : 'Docs & Quantity'}</th>
                  <th className="p-4 text-start">{isAr ? 'حالة الربط والصنف المقترن' : 'Link Status & Mapped Product'}</th>
                  <th className="p-4 text-center">{isAr ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {paginatedItems.map((item) => renderItemRow(item, true))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {activeTotalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between gap-4 flex-wrap text-xs">
            <div className="text-slate-500 font-medium">
              {isAr ? 'عرض' : 'Showing'}{' '}
              <span className="font-black text-slate-800">
                {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, groupBySupplier ? supplierGroups.length : filteredItems.length)}
              </span>{' '}
              {isAr ? 'من إجمالي' : 'of'}{' '}
              <span className="font-black text-slate-800">
                {groupBySupplier ? supplierGroups.length : filteredItems.length}
              </span>{' '}
              {groupBySupplier 
                ? (isAr ? 'مورد' : 'suppliers') 
                : (isAr ? 'صنف' : 'items')}
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
                {page} / {activeTotalPages}
              </span>

              <button
                type="button"
                disabled={page >= activeTotalPages}
                onClick={() => setPage(p => Math.min(activeTotalPages, p + 1))}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

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
