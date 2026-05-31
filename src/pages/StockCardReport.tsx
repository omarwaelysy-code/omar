import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Product, Warehouse } from '../types';
import { History, Search, FileText, Download, Calendar, Printer, RefreshCw, Package, User } from 'lucide-react';
import { dbService } from '../services/dbService';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigation } from '../contexts/NavigationContext';
import { formatNumber, formatDate } from '../utils/formatUtils';
import { exportToExcel } from '../utils/excelUtils';
import { exportToPDF } from '../utils/pdfUtils';

interface DocMapInfo {
  partner: string;
  description: string;
  entry_number?: string;
}

export const StockCardReport: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { pendingViewDoc, setPendingViewDoc, setCurrentPage } = useNavigation();

  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  
  // Filter States
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [filterType, setFilterType] = useState('');
  const [filterRefNum, setFilterRefNum] = useState('');
  const [filterPartner, setFilterPartner] = useState('');

  const [movements, setMovements] = useState<any[]>([]);
  const [docMap, setDocMap] = useState<Record<string, DocMapInfo>>({});
  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const reportTableRef = useRef<HTMLTableElement>(null);

  // Load all products and warehouses for dropdown selection
  useEffect(() => {
    if (!user) return;
    setLoadingProducts(true);
    
    const loadSelectData = async () => {
      try {
        const prodList = await dbService.list<Product>('products', { company_id: user.company_id });
        // Filter out service-type items as they don't have stock or inventory movements
        const physicalProducts = (prodList || []).filter(p => p.type !== 'service');
        setProducts(physicalProducts);

        const whList = await dbService.list<Warehouse>('warehouses', { company_id: user.company_id });
        setWarehouses(whList || []);
      } catch (err) {
        console.error('Failed to load products/warehouses for stock report', err);
      } finally {
        setLoadingProducts(false);
      }
    };

    loadSelectData();
  }, [user]);

  // Check for pending selected product ID from navigation
  useEffect(() => {
    if (pendingViewDoc && pendingViewDoc.type === 'stock_card' && pendingViewDoc.idOrNumber) {
      setSelectedProductId(pendingViewDoc.idOrNumber);
      // Clear pendingViewDoc so we don't trigger it continuously
      setPendingViewDoc(null);
    }
  }, [pendingViewDoc]);

  // Load movement data when selected product changes
  const loadMovementData = async () => {
    if (!user || !selectedProductId) return;
    setLoading(true);

    try {
      const mvs = await dbService.list<any>('inventory_movements', { 
        company_id: user.company_id,
        product_id: selectedProductId 
      });

      const [invs, pinvs, rets, prets, jes] = await Promise.all([
        dbService.list<any>('invoices', { company_id: user.company_id }),
        dbService.list<any>('purchase_invoices', { company_id: user.company_id }),
        dbService.list<any>('returns', { company_id: user.company_id }),
        dbService.list<any>('purchase_returns', { company_id: user.company_id }),
        dbService.list<any>('journal_entries', { company_id: user.company_id })
      ]);

      const jeMap: Record<string, string> = {};
      (jes || []).forEach(j => {
        if (j.reference_id && j.entry_number) {
          jeMap[j.reference_id] = j.entry_number;
        }
      });

      const map: Record<string, DocMapInfo> = {};
      
      (invs || []).forEach(x => {
        map[x.id] = { 
          partner: x.customer_name || t('common.customer') || 'عميل', 
          description: x.description || '',
          entry_number: jeMap[x.id]
        };
      });
      (pinvs || []).forEach(x => {
        map[x.id] = { 
          partner: x.supplier_name || t('common.supplier') || 'مورد', 
          description: x.description || '',
          entry_number: jeMap[x.id]
        };
      });
      (rets || []).forEach(x => {
        map[x.id] = { 
          partner: x.customer_name || t('common.customer') || 'عميل', 
          description: x.description || '',
          entry_number: jeMap[x.id]
        };
      });
      (prets || []).forEach(x => {
        map[x.id] = { 
          partner: x.supplier_name || t('common.supplier') || 'مورد', 
          description: x.description || '',
          entry_number: jeMap[x.id]
        };
      });

      setDocMap(map);
      setMovements(mvs || []);
    } catch (e) {
      console.error("Failed to load product movements", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedProductId) {
      loadMovementData();
    } else {
      setMovements([]);
    }
  }, [selectedProductId]);

  const selectedProduct = products.find(p => p.id === selectedProductId) || null;

  const getMovementTypeLabel = (type: string) => {
    switch(type) {
      case 'purchase': return language === 'ar' ? 'فاتورة شراء' : 'Purchase Invoice';
      case 'sale': return language === 'ar' ? 'فاتورة بيع' : 'Sales Invoice';
      case 'sales_return': return language === 'ar' ? 'مردود مبيعات' : 'Sales Return';
      case 'purchase_return': return language === 'ar' ? 'مردود مشتريات' : 'Purchase Return';
      default: return type;
    }
  };

  const getCostMethodLabel = (method: string) => {
    switch(method) {
      case 'wac': return language === 'ar' ? 'متوسط مرجح (WAC)' : 'Weighted Average (WAC)';
      case 'fifo': return language === 'ar' ? 'الوارد أولاً يصرف أولاً (FIFO)' : 'First In First Out (FIFO)';
      case 'lifo': return language === 'ar' ? 'الوارد أخيراً يصرف أولاً (LIFO)' : 'Last In First Out (LIFO)';
      default: return method?.toUpperCase() || '-';
    }
  };

  const getMovementCostPolicyLabel = (mType: string, method: string) => {
    if (mType === 'purchase') {
      return language === 'ar' ? 'شراء' : 'Purchase';
    }
    if (mType === 'purchase_return') {
      return language === 'ar' ? 'مرتجع شراء' : 'Purchase Return';
    }
    return getCostMethodLabel(method);
  };

  // Processing movements calculation sequentially to get correct running balances
  const sortedMovements = [...movements].sort((a, b) => {
    const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (dateDiff !== 0) return dateDiff;
    
    // Sort inflows (quantity > 0) before outflows (quantity <= 0)
    const aQty = parseFloat(a.quantity || '0');
    const bQty = parseFloat(b.quantity || '0');
    const aIsInflow = aQty > 0;
    const bIsInflow = bQty > 0;
    
    if (aIsInflow && !bIsInflow) return -1;
    if (!aIsInflow && bIsInflow) return 1;
    
    // Tie-breaker 1: Reference number (e.g. Doc number)
    const aRef = a.reference_number || '';
    const bRef = b.reference_number || '';
    const refDiff = aRef.localeCompare(bRef, undefined, { numeric: true });
    if (refDiff !== 0) return refDiff;

    // Tie-breaker 2: Created at timestamp
    const timeDiff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (timeDiff !== 0) return timeDiff;

    // Tie-breaker 3: ID
    return (a.id || '').localeCompare(b.id || '');
  });

  let runningQty = 0;
  let runningValue = 0;

  const movementsWithBalances = sortedMovements.map(m => {
    const qty = parseFloat(m.quantity || '0');
    const totalCost = parseFloat(m.total_cost || '0');
    
    const isIncoming = qty > 0;
    const qtyIn = isIncoming ? Math.abs(qty) : 0;
    const qtyOut = !isIncoming ? Math.abs(qty) : 0;
    
    const debitVal = isIncoming ? Math.abs(totalCost) : 0;
    const creditVal = !isIncoming ? Math.abs(totalCost) : 0;
    
    runningQty += qty;
    runningValue += isIncoming ? debitVal : -creditVal;
    
    const docInfo = docMap[m.reference_id] || { partner: '', description: '' };
    const whName = warehouses.find(w => w.id === m.warehouse_id)?.name || 'الرئيسي';
    
    return {
      ...m,
      qtyIn,
      qtyOut,
      debitVal,
      creditVal,
      runningQty,
      runningValue,
      partner: docInfo.partner,
      description: m.description || docInfo.description || '',
      warehouseName: whName,
      entry_number: docInfo.entry_number
    };
  });

  const filteredMovements = movementsWithBalances.filter(m => {
    if (dateFrom && m.date?.slice(0, 10) < dateFrom) return false;
    if (dateTo && m.date?.slice(0, 10) > dateTo) return false;
    if (filterType && m.movement_type !== filterType) return false;
    if (filterRefNum && !(m.reference_number || '').toLowerCase().includes(filterRefNum.toLowerCase())) return false;
    if (filterPartner && !(m.partner || '').toLowerCase().includes(filterPartner.toLowerCase())) return false;
    return true;
  });

  const handleExportStockCardExcel = () => {
    if (!selectedProduct) return;
    const headers = language === 'ar' ? [
      'التاريخ', 'رقم الحركة', 'رقم القيد', 'نوع الحركة', 'المخزن', 'العميل / المورد', 'الوصف', 
      'الوارد (+)', 'المصرف (-)', 'رصيد الكمية', 
      'سياسة التكلفة', 'تكلفة الوحدة', 
      'قيمة مدين (+)', 'قيمة دائن (-)', 'رصيد القيمة'
    ] : [
      'Date', 'Ref Number', 'Entry No.', 'Movement Type', 'Warehouse', 'Customer/Supplier', 'Description', 
      'In Quantity (+)', 'Out Quantity (-)', 'Running Qty', 
      'Cost Policy', 'Unit Cost', 
      'Debit Value (+)', 'Credit Value (-)', 'Running Balance Value'
    ];

    const data = filteredMovements.map(m => [
      m.date.slice(0, 10),
      m.reference_number || '',
      m.entry_number || '',
      getMovementTypeLabel(m.movement_type),
      m.warehouseName || '',
      m.partner || '',
      m.description || '',
      m.qtyIn || 0,
      m.qtyOut || 0,
      m.runningQty || 0,
      getMovementCostPolicyLabel(m.movement_type, selectedProduct.inventory_cost_method || 'wac'),
      m.unit_cost || 0,
      m.debitVal || 0,
      m.creditVal || 0,
      m.runningValue || 0
    ]);

    exportToExcel([headers, ...data], { 
      filename: `Stock_Card_${selectedProduct.name}_${new Date().toISOString().slice(0, 10)}`,
      sheetName: language === 'ar' ? 'كارت الصنف' : 'Stock Card' 
    });
  };

  const handleExportStockCardPDF = async () => {
    if (reportTableRef.current && selectedProduct) {
      await exportToPDF(reportTableRef.current, {
        filename: `Stock_Card_${selectedProduct.name}`,
        reportTitle: language === 'ar' 
          ? `كارت حركة وتكلفة الصنف: ${selectedProduct.name} (${selectedProduct.code})` 
          : `Stock Card: ${selectedProduct.name} (${selectedProduct.code})`
      });
    }
  };

  const handleRecalculate = async () => {
    try {
      setLoading(true);
      await fetch('/api/erp/inventory/recalculate_all', {
         method: 'POST',
         headers: {
           'Authorization': `Bearer ${localStorage.getItem('token')}`
         }
      });
      await loadMovementData();
    } catch(err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintStockCard = () => {
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        body * {
          visibility: hidden !important;
        }
        #stock-card-report-printable-area, #stock-card-report-printable-area * {
          visibility: visible !important;
        }
        #stock-card-report-printable-area {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          padding: 0 !important;
          margin: 0 !important;
          box-shadow: none !important;
          border: none !important;
        }
      }
    `;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => document.head.removeChild(style), 1000);
  };

  return (
    <div className="space-y-8" dir={dir}>
      {/* Title Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
            <History size={28} />
          </div>
          <div className="text-right">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-1">
              {language === 'ar' ? 'تقرير حركة وتكلفة الصنف (كارت الصنف)' : 'Product Stock Card Report'}
            </h1>
            <p className="text-slate-400 text-sm font-bold">
              {language === 'ar' ? 'التحري والتحليل التفصيلي لحركات الوارد والمصرف وتقييم التكلفة للصنف بالسياسة المتبعة' : 'Detailed tracking and analysis of inflows, outflows, and unit costing'}
            </p>
          </div>
        </div>
      </div>

      {/* Select Product and Filter Board */}
      <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
          {/* Select Product Dropdown */}
          <div className="space-y-2 text-right">
            <label className="block text-sm font-bold text-slate-700 uppercase tracking-tighter">
              {language === 'ar' ? 'الصنف المراد فحصه' : 'Select Product'}
            </label>
            <div className="relative">
              <Package className="absolute left-3 top-3 text-slate-400" size={18} />
              <select 
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-sm text-slate-800"
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                disabled={loadingProducts}
              >
                <option value="">{language === 'ar' ? 'اختر الصنف من القائمة...' : 'Choose product...'}</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Date From */}
          <div className="space-y-2 text-right">
            <label className="block text-sm font-bold text-slate-700 uppercase tracking-tighter">
              {language === 'ar' ? 'من تاريخ' : 'Date From'}
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 text-slate-400" size={18} />
              <input 
                type="date" 
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-sm text-slate-800"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
          </div>

          {/* Date To */}
          <div className="space-y-2 text-right">
            <label className="block text-sm font-bold text-slate-700 uppercase tracking-tighter">
              {language === 'ar' ? 'إلى تاريخ' : 'Date To'}
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 text-slate-400" size={18} />
              <input 
                type="date" 
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-sm text-slate-800"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          {/* Refresh and Action buttons */}
          <div className="flex gap-2">
            <button 
              onClick={loadMovementData}
              disabled={loading || !selectedProductId}
              className="flex-grow flex items-center justify-center gap-2 px-6 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-xl transition-all disabled:opacity-50 h-[42px] font-bold text-sm"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              {loading ? (language === 'ar' ? 'تحميل...' : 'Loading...') : (language === 'ar' ? 'تحديث التقرير' : 'Run Report')}
            </button>
          </div>
        </div>

        {/* Additional detailed filters aligned horizontally */}
        {selectedProductId && (
          <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4 text-right">
            {/* Movement Type filter */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400">
                {language === 'ar' ? 'نوع الحركة' : 'Movement Type'}
              </label>
              <select 
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-xs text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="">{language === 'ar' ? 'الكل' : 'All'}</option>
                <option value="purchase">{language === 'ar' ? 'فاتورة شراء' : 'Purchase Invoice'}</option>
                <option value="sale">{language === 'ar' ? 'فاتورة بيع' : 'Sales Invoice'}</option>
                <option value="sales_return">{language === 'ar' ? 'مردود مبيعات' : 'Sales Return'}</option>
                <option value="purchase_return">{language === 'ar' ? 'مردود مشتريات' : 'Purchase Return'}</option>
              </select>
            </div>

            {/* Movement custom number filter */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400">
                {language === 'ar' ? 'رقم الحركة' : 'Movement Number'}
              </label>
              <input 
                type="text" 
                placeholder={language === 'ar' ? 'البحث بالرقم...' : 'Search by number...'}
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-xs text-slate-700 placeholder:text-slate-300 outline-none focus:ring-2 focus:ring-emerald-500/20 text-right"
                value={filterRefNum}
                onChange={(e) => setFilterRefNum(e.target.value)}
              />
            </div>

            {/* Customer/Supplier name filter */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400">
                {language === 'ar' ? 'العميل / المورد' : 'Customer / Supplier'}
              </label>
              <input 
                type="text" 
                placeholder={language === 'ar' ? 'اسم العميل لفلترة الحركات...' : 'Customer or supplier...'}
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-xs text-slate-700 placeholder:text-slate-300 outline-none focus:ring-2 focus:ring-emerald-500/20 text-right"
                value={filterPartner}
                onChange={(e) => setFilterPartner(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Action Controls for Excel / PDF / Print */}
        {selectedProductId && movements.length > 0 && (
          <div className="flex justify-between items-center bg-slate-50 px-6 py-4 rounded-2xl border border-slate-100 flex-wrap gap-3">
            <div className="flex items-center gap-2 bg-white border border-slate-100 px-4 py-2 rounded-xl text-xs font-black text-slate-600">
              <span className="text-slate-400">{language === 'ar' ? 'السياسة المطبقة: ' : 'Cost Policy: '}</span>
              <span className="text-emerald-600 font-extrabold">{getCostMethodLabel(selectedProduct?.inventory_cost_method)}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={handleRecalculate}
                className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:text-blue-600 rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2 text-xs font-bold shadow-sm"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                <span>{language === 'ar' ? 'إعادة حساب التكلفة' : 'Recalculate'}</span>
              </button>
              <button 
                onClick={handlePrintStockCard}
                className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:text-emerald-600 rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2 text-xs font-bold shadow-sm"
              >
                <Printer size={16} />
                <span>{language === 'ar' ? 'طباعة كارت الصنف' : 'Print'}</span>
              </button>

              <button 
                onClick={handleExportStockCardPDF}
                className="p-2.5 bg-white border border-slate-200 text-rose-600 hover:bg-rose-50 rounded-xl transition-all flex items-center gap-2 text-xs font-bold shadow-sm"
              >
                <FileText size={16} />
                <span>PDF</span>
              </button>

              <button 
                onClick={handleExportStockCardExcel}
                className="p-2.5 bg-white border border-slate-200 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all flex items-center gap-2 text-xs font-bold shadow-sm"
              >
                <Download size={16} />
                <span>Excel</span>
              </button>
            </div>
          </div>
        )}

        {/* Ledger Document Output Area inside Card View styling */}
        {selectedProductId && (
          <div id="stock-card-report-printable-area" className="border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm bg-white p-6 md:p-8">
            <div className="text-center mb-8 border-b border-zinc-100 pb-6">
              <h3 className="text-2xl font-black text-slate-900 mb-2">
                {language === 'ar' ? 'كارت حركة وتكلفة الصنف' : 'Product Stock Card Report'}
              </h3>
              <div className="flex justify-center flex-wrap gap-8 text-sm text-slate-500 mt-3 font-semibold">
                <p>{language === 'ar' ? 'الصنف:' : 'Product:'} <span className="font-bold text-slate-900">{selectedProduct?.name}</span></p>
                <p>{language === 'ar' ? 'الرمز:' : 'Code:'} <span className="font-bold font-mono text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md text-xs">{selectedProduct?.code}</span></p>
                <p>{language === 'ar' ? 'الفترة:' : 'Period:'} <span className="font-bold text-slate-900">{dateFrom || (language === 'ar' ? 'البداية' : 'Start')}</span> {language === 'ar' ? 'إلى' : 'to'} <span className="font-bold text-slate-900">{dateTo}</span></p>
              </div>
            </div>

            {loading ? (
              <div className="py-20 text-center">
                <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              </div>
            ) : filteredMovements.length === 0 ? (
              <div className="p-16 text-center border-2 border-dashed border-slate-100 rounded-[2.5rem] bg-slate-50/20">
                <History className="w-14 h-14 text-slate-300 mx-auto mb-4 animate-pulse" />
                <p className="text-slate-400 font-extrabold text-lg">{language === 'ar' ? 'لا توجد حركات مسجلة لهذا الصنف تطابق الفلاتر المحددة' : 'No recorded movements matching the filters for this product'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto custom-scrollbar">
                <table ref={reportTableRef} className="w-full min-w-[1250px] border-collapse bg-white text-center text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase font-black tracking-widest text-slate-400 border-b border-slate-200">
                    <tr>
                      <th rowSpan={2} className="px-4 py-3 border-r border-slate-200 whitespace-nowrap">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                      <th rowSpan={2} className="px-4 py-3 border-r border-slate-200 whitespace-nowrap">{language === 'ar' ? 'رقم الحركة' : 'Movement No.'}</th>
                      <th rowSpan={2} className="px-4 py-3 border-r border-slate-200 whitespace-nowrap">{language === 'ar' ? 'رقم القيد' : 'Entry No.'}</th>
                      <th rowSpan={2} className="px-4 py-3 border-r border-slate-200 whitespace-nowrap">{language === 'ar' ? 'نوع الحركة' : 'Type'}</th>
                      <th rowSpan={2} className="px-4 py-3 border-r border-slate-200 whitespace-nowrap">{language === 'ar' ? 'المخزن' : 'Warehouse'}</th>
                      <th rowSpan={2} className="px-5 py-3 border-r border-slate-200 whitespace-nowrap">{language === 'ar' ? 'العميل / المورد' : 'Customer/Supplier'}</th>
                      <th rowSpan={1} className="px-5 py-3 border-r border-slate-200 whitespace-nowrap">{language === 'ar' ? 'الوصف' : 'Description'}</th>
                      <th colSpan={3} className="px-1.5 py-1.5 border-r border-b border-slate-200 bg-emerald-50/30 text-emerald-800 font-bold">{language === 'ar' ? 'الكمية' : 'Quantity'}</th>
                      <th rowSpan={2} className="px-4 py-3 border-r border-slate-200 whitespace-nowrap">{language === 'ar' ? 'سياسة التكلفة' : 'Cost Policy'}</th>
                      <th rowSpan={2} className="px-4 py-3 border-r border-slate-200 whitespace-nowrap">{language === 'ar' ? 'سعر التكلفة' : 'Unit Cost'}</th>
                      <th colSpan={3} className="px-1.5 py-1.5 border-b border-slate-200 bg-sky-50/30 text-sky-800 font-bold">{language === 'ar' ? 'القيم المالية للمخزون' : 'Financial Value'}</th>
                    </tr>
                    <tr>
                      <th className="px-5 py-1.5 border-r border-slate-200 text-slate-400 text-[10px] whitespace-nowrap">{language === 'ar' ? 'شرح الحركة' : 'Remark'}</th>
                      <th className="px-3 py-1.5 border-r border-slate-200 bg-emerald-50/10 text-emerald-600 font-bold whitespace-nowrap">{language === 'ar' ? 'الوارد (+)' : 'In (+)'}</th>
                      <th className="px-3 py-1.5 border-r border-slate-200 bg-rose-50/10 text-rose-600 font-bold whitespace-nowrap">{language === 'ar' ? 'المصرف (-)' : 'Out (-)'}</th>
                      <th className="px-3 py-1.5 border-r border-slate-200 bg-emerald-100/30 text-emerald-800 font-black whitespace-nowrap">{language === 'ar' ? 'الرصيد' : 'Balance'}</th>
                      <th className="px-3 py-1.5 border-r border-slate-200 bg-sky-50/10 text-sky-600 font-bold whitespace-nowrap">{language === 'ar' ? 'قيمة مدين (+)' : 'Debit Value'}</th>
                      <th className="px-3 py-1.5 border-r border-slate-200 bg-rose-50/10 text-rose-600 font-bold whitespace-nowrap">{language === 'ar' ? 'قيمة دائن (-)' : 'Credit Value'}</th>
                      <th className="px-4 py-1.5 bg-blue-100/30 text-blue-800 font-black whitespace-nowrap">{language === 'ar' ? 'الرصيد' : 'Balance Value'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-bold">
                    {filteredMovements.map((m, index) => (
                      <tr key={m.id || index} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-4 border-r border-slate-200 font-mono whitespace-nowrap">{m.date.slice(0, 10)}</td>
                        <td className="px-4 py-4 border-r border-slate-200 font-mono text-slate-500 whitespace-nowrap">{m.reference_number}</td>
                        <td className="px-4 py-4 border-r border-slate-200 whitespace-nowrap">
                          {m.entry_number ? (
                            <span 
                              onClick={() => {
                                setPendingViewDoc({ type: 'journal', idOrNumber: m.entry_number });
                                setCurrentPage('journal_entries');
                              }}
                              className="px-3 py-1 bg-zinc-100 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg text-xs font-black cursor-pointer transition-all inline-block hover:scale-105 active:scale-95 whitespace-nowrap"
                            >
                              {m.entry_number}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-4 border-r border-slate-200 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            m.movement_type === 'purchase' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                            m.movement_type === 'sale' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                            m.movement_type === 'sales_return' ? 'bg-teal-50 text-teal-700 border border-teal-100' :
                            'bg-amber-50 text-amber-700 border border-amber-100'
                          }`}>
                            {getMovementTypeLabel(m.movement_type)}
                          </span>
                        </td>
                        <td className="px-4 py-4 border-r border-slate-200 text-slate-600 whitespace-nowrap">{m.warehouseName}</td>
                        <td className="px-5 py-4 border-r border-slate-200 text-slate-800 font-black whitespace-nowrap">{m.partner || '-'}</td>
                        <td className="px-5 py-4 border-r border-slate-200 text-right text-slate-500 whitespace-normal max-w-[200px] truncate" title={m.description}>{m.description || '-'}</td>
                        
                        {/* Quantities */}
                        <td className="px-3 py-4 border-r border-slate-200 bg-emerald-50/5 font-mono text-slate-800">{m.qtyIn > 0 ? formatNumber(m.qtyIn) : '-'}</td>
                        <td className="px-3 py-4 border-r border-slate-200 bg-rose-50/5 font-mono text-slate-800">{m.qtyOut > 0 ? formatNumber(m.qtyOut) : '-'}</td>
                        <td className="px-3 py-4 border-r border-slate-200 bg-emerald-50/20 font-black font-mono text-emerald-700">{formatNumber(m.runningQty)}</td>
                        
                        {/* Cost Policy & Cost Price */}
                        <td className="px-4 py-4 border-r border-slate-200 text-[10px] text-slate-500 whitespace-nowrap">
                          {getMovementCostPolicyLabel(m.movement_type, selectedProduct.inventory_cost_method || 'wac')}
                        </td>
                        <td className="px-4 py-4 border-r border-slate-200 font-mono text-slate-800">{formatNumber(m.unit_cost)}</td>
                        
                        {/* Values */}
                        <td className="px-3 py-4 border-r border-slate-200 bg-sky-50/5 font-mono text-slate-800">{m.debitVal > 0 ? formatNumber(m.debitVal) : '-'}</td>
                        <td className="px-3 py-4 border-r border-slate-200 bg-rose-50/5 font-mono text-slate-800">{m.creditVal > 0 ? formatNumber(m.creditVal) : '-'}</td>
                        <td className="px-4 py-4 bg-blue-50/20 font-black font-mono text-blue-700">{formatNumber(m.runningValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
