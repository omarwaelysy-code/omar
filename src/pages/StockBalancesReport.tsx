import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Product, Warehouse } from '../types';
import { dbService } from '../services/dbService';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigation } from '../contexts/NavigationContext';
import { formatNumber } from '../utils/formatUtils';
import { exportToExcel } from '../utils/excelUtils';
import { exportToPDF } from '../utils/pdfUtils';
import { 
  BarChart3, Search, Calendar, Home, RefreshCw, Printer, Download, FileText, 
  Folder, Sliders, ChevronDown, ChevronRight, Layers, Eye, EyeOff, LayoutGrid,
  Package
} from 'lucide-react';

interface ItemGroup {
  id: string;
  company_id: string;
  name: string;
  code: string;
  type: string;
}

export const StockBalancesReport: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { setCurrentPage } = useNavigation();

  // Data states
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [itemGroups, setItemGroups] = useState<ItemGroup[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [opbBalances, setOpbBalances] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Filter states
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(firstDayOfMonth);
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [filterItemGroupId, setFilterItemGroupId] = useState('');
  const [filterItemType, setFilterItemType] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [hideZeroBalances, setHideZeroBalances] = useState(true);

  // Grouping & Sorting states
  const [groupBy, setGroupBy] = useState<'all' | 'group' | 'type'>('all');
  const [sortBy, setSortBy] = useState<'code' | 'name' | 'ending_qty' | 'ending_val'>('code');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'qty_only' | 'qty_and_val' | 'qty_and_end_val'>('qty_and_val');

  const reportTableRef = useRef<HTMLTableElement>(null);

  // Load basic reference data (products, warehouses, groups)
  useEffect(() => {
    if (!user) return;

    const loadRefData = async () => {
      try {
        setLoading(true);
        const [prodList, whList, groupList] = await Promise.all([
          dbService.list<Product>('products', { company_id: user.company_id }),
          dbService.list<Warehouse>('warehouses', { company_id: user.company_id }),
          dbService.list<ItemGroup>('item_groups', { company_id: user.company_id })
        ]);

        // Filter to physical items only
        const physicalProds = (prodList || []).filter(p => p.type !== 'service');
        setProducts(physicalProds);
        setWarehouses(whList || []);
        setItemGroups(groupList || []);
      } catch (err) {
        console.error('Failed to load reference data for stock balances report', err);
      } finally {
        setLoading(false);
      }
    };

    loadRefData();
  }, [user]);

  // Load and calculate movement data
  const loadReportData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [mvs, opbs, adjs] = await Promise.all([
        dbService.list<any>('inventory_movements', { company_id: user.company_id }),
        dbService.list<any>('opening_stock_balances', { company_id: user.company_id }),
        dbService.list<any>('stock_adjustments', { company_id: user.company_id })
      ]);

      setMovements(mvs || []);
      setOpbBalances(opbs || []);
      setAdjustments(adjs || []);
    } catch (err) {
      console.error('Failed to load transaction data for stock balances report', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [user]);

  // Mapping labels & helper helpers
  const getProductTypeLabel = (type: string) => {
    switch (type) {
      case 'finished_good': return language === 'ar' ? 'منتج تام الصنع' : 'Finished Good';
      case 'raw_material': return language === 'ar' ? 'مواد خام' : 'Raw Material';
      case 'commodity': return language === 'ar' ? 'سلعة تجارية' : 'Commodity';
      case 'consumable': return language === 'ar' ? 'مواد استهلاكية' : 'Consumable';
      default: return type;
    }
  };

  const getCostMethodLabel = (method: string) => {
    switch(method) {
      case 'wac': return 'WAC';
      case 'fifo': return 'FIFO';
      case 'lifo': return 'LIFO';
      default: return method?.toUpperCase() || '-';
    }
  };

  // Compile calculations in-memory dynamically based on current parameters
  const calculatedStats = React.useMemo(() => {
    const stats: Record<string, any> = {};

    // Initialise product stats map
    products.forEach(p => {
      stats[p.id] = {
        product: p,
        opening_qty: 0,
        opening_val: 0,
        opb_qty: 0,
        opb_val: 0,
        purchases_qty: 0,
        purchases_val: 0,
        purchase_returns_qty: 0,
        purchase_returns_val: 0,
        sales_qty: 0,
        sales_val: 0,
        sales_returns_qty: 0,
        sales_returns_val: 0,
        transfers_qty: 0,
        transfers_val: 0,
        adjustments_qty: 0,
        adjustments_val: 0,
        ending_qty: 0,
        ending_val: 0
      };
    });

    const opbIds = new Set(opbBalances.map(d => d.id));

    // Aggregate movements
    movements.forEach(m => {
      const pid = m.product_id;
      if (!stats[pid]) return;

      // Warehouse filter
      if (selectedWarehouseId && m.warehouse_id !== selectedWarehouseId) return;

      const mDate = m.date.slice(0, 10);
      const qty = parseFloat(m.quantity || '0');
      const cost = parseFloat(m.total_cost || '0');

      if (mDate < dateFrom) {
        // Accumulate opening balance before date range
        stats[pid].opening_qty += qty;
        stats[pid].opening_val += cost;
      } else if (mDate <= dateTo) {
        // Accumulate period flows
        const type = m.movement_type;
        const refId = m.reference_id;

        if (type === 'purchase') {
          stats[pid].purchases_qty += qty;
          stats[pid].purchases_val += cost;
        } else if (type === 'purchase_return') {
          stats[pid].purchase_returns_qty += qty;
          stats[pid].purchase_returns_val += cost;
        } else if (type === 'sale') {
          stats[pid].sales_qty += qty;
          stats[pid].sales_val += cost;
        } else if (type === 'sales_return') {
          stats[pid].sales_returns_qty += qty;
          stats[pid].sales_returns_val += cost;
        } else if (type === 'transfer_in' || type === 'transfer_out') {
          stats[pid].transfers_qty += qty;
          stats[pid].transfers_val += cost;
        } else if (type === 'adjustment') {
          if (opbIds.has(refId)) {
            stats[pid].opb_qty += qty;
            stats[pid].opb_val += cost;
          } else {
            stats[pid].adjustments_qty += qty;
            stats[pid].adjustments_val += cost;
          }
        } else if (type === 'opening_balance') {
          stats[pid].opb_qty += qty;
          stats[pid].opb_val += cost;
        }
      }
    });

    // Finalize ending balance values and clean precision
    Object.keys(stats).forEach(pid => {
      const s = stats[pid];
      s.ending_qty = s.opening_qty + s.opb_qty + s.purchases_qty + s.purchase_returns_qty + s.sales_qty + s.sales_returns_qty + s.transfers_qty + s.adjustments_qty;
      s.ending_val = s.opening_val + s.opb_val + s.purchases_val + s.purchase_returns_val + s.sales_val + s.sales_returns_val + s.transfers_val + s.adjustments_val;

      if (Math.abs(s.ending_qty) < 0.0001) {
        s.ending_qty = 0;
        s.ending_val = 0;
      }
      if (Math.abs(s.opening_qty) < 0.0001) {
        s.opening_qty = 0;
        s.opening_val = 0;
      }
    });

    return Object.values(stats);
  }, [products, movements, opbBalances, dateFrom, dateTo, selectedWarehouseId]);

  // Apply filters on calculations
  const filteredStats = React.useMemo(() => {
    return calculatedStats.filter((item: any) => {
      const p = item.product;

      // Group filter
      if (filterItemGroupId && p.item_group_id !== filterItemGroupId) return false;

      // Type filter
      if (filterItemType && p.type !== filterItemType) return false;

      // Search keyword filter
      if (searchKeyword) {
        const term = searchKeyword.toLowerCase();
        const matchesName = (p.name || '').toLowerCase().includes(term);
        const matchesCode = (p.code || '').toLowerCase().includes(term);
        if (!matchesName && !matchesCode) return false;
      }

      // Hide zero balances toggle
      if (hideZeroBalances) {
        const isZero = 
          Math.abs(item.opening_qty) < 0.0001 &&
          Math.abs(item.opb_qty) < 0.0001 &&
          Math.abs(item.purchases_qty) < 0.0001 &&
          Math.abs(item.purchase_returns_qty) < 0.0001 &&
          Math.abs(item.sales_qty) < 0.0001 &&
          Math.abs(item.sales_returns_qty) < 0.0001 &&
          Math.abs(item.transfers_qty) < 0.0001 &&
          Math.abs(item.adjustments_qty) < 0.0001 &&
          Math.abs(item.ending_qty) < 0.0001;
        if (isZero) return false;
      }

      return true;
    });
  }, [calculatedStats, filterItemGroupId, filterItemType, searchKeyword, hideZeroBalances]);

  // Sort helper function
  const sortItems = (items: any[]) => {
    return [...items].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      if (sortBy === 'code') {
        valA = a.product.code || '';
        valB = b.product.code || '';
      } else if (sortBy === 'name') {
        valA = a.product.name || '';
        valB = b.product.name || '';
      } else if (sortBy === 'ending_qty') {
        valA = a.ending_qty;
        valB = b.ending_qty;
      } else if (sortBy === 'ending_val') {
        valA = a.ending_val;
        valB = b.ending_val;
      }

      if (typeof valA === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
    });
  };

  // Group and sort calculations
  const groupedData = React.useMemo(() => {
    if (groupBy === 'group') {
      const map: Record<string, any[]> = {};
      filteredStats.forEach(item => {
        const key = item.product.item_group_id || 'no_group';
        if (!map[key]) map[key] = [];
        map[key].push(item);
      });
      return Object.keys(map).map(groupId => {
        const items = map[groupId];
        const groupName = groupId === 'no_group'
          ? (language === 'ar' ? 'بدون مجموعة' : 'No Group')
          : itemGroups.find(g => g.id === groupId)?.name || groupId;
        return {
          id: groupId,
          name: groupName,
          items: sortItems(items)
        };
      });
    } else if (groupBy === 'type') {
      const map: Record<string, any[]> = {};
      filteredStats.forEach(item => {
        const key = item.product.type || 'no_type';
        if (!map[key]) map[key] = [];
        map[key].push(item);
      });
      return Object.keys(map).map(typeId => {
        const items = map[typeId];
        const typeName = getProductTypeLabel(typeId);
        return {
          id: typeId,
          name: typeName,
          items: sortItems(items)
        };
      });
    } else {
      return [{
        id: 'all',
        name: '',
        items: sortItems(filteredStats)
      }];
    }
  }, [filteredStats, groupBy, itemGroups, sortBy, sortOrder, language]);

  // Sum aggregations for subtotals and grand totals
  const getTotals = (items: any[]) => {
    const totals = {
      opening_qty: 0, opening_val: 0,
      opb_qty: 0, opb_val: 0,
      purchases_qty: 0, purchases_val: 0,
      purchase_returns_qty: 0, purchase_returns_val: 0,
      sales_qty: 0, sales_val: 0,
      sales_returns_qty: 0, sales_returns_val: 0,
      transfers_qty: 0, transfers_val: 0,
      adjustments_qty: 0, adjustments_val: 0,
      ending_qty: 0, ending_val: 0
    };

    items.forEach(i => {
      totals.opening_qty += i.opening_qty;
      totals.opening_val += i.opening_val;
      totals.opb_qty += i.opb_qty;
      totals.opb_val += i.opb_val;
      totals.purchases_qty += i.purchases_qty;
      totals.purchases_val += i.purchases_val;
      totals.purchase_returns_qty += i.purchase_returns_qty;
      totals.purchase_returns_val += i.purchase_returns_val;
      totals.sales_qty += i.sales_qty;
      totals.sales_val += i.sales_val;
      totals.sales_returns_qty += i.sales_returns_qty;
      totals.sales_returns_val += i.sales_returns_val;
      totals.transfers_qty += i.transfers_qty;
      totals.transfers_val += i.transfers_val;
      totals.adjustments_qty += i.adjustments_qty;
      totals.adjustments_val += i.adjustments_val;
      totals.ending_qty += i.ending_qty;
      totals.ending_val += i.ending_val;
    });

    return totals;
  };

  const grandTotals = React.useMemo(() => {
    return getTotals(filteredStats);
  }, [filteredStats]);

  // Export to Excel handler
  const handleExportExcel = () => {
    interface ColDef {
      h1: string;
      h2: string;
      val: (item: any) => any;
    }

    const cols: ColDef[] = [
      { h1: language === 'ar' ? 'الكود' : 'Code', h2: '', val: (item) => item.product?.code || '' },
      { h1: language === 'ar' ? 'الاسم' : 'Name', h2: '', val: (item) => item.product?.name || '' },
      { h1: language === 'ar' ? 'السياسة' : 'Cost Policy', h2: '', val: (item) => item.product ? getCostMethodLabel(item.product.inventory_cost_method) : '' },
      
      // Period Start
      { h1: language === 'ar' ? 'رصيد أول المدة' : 'Period Start Balance', h2: language === 'ar' ? 'كمية' : 'Qty', val: (item) => item.opening_qty },
      ...(viewMode === 'qty_and_val' ? [{ h1: '', h2: language === 'ar' ? 'قيمة' : 'Val', val: (item: any) => item.opening_val }] : []),
      
      // Opening Stock Entry
      { h1: language === 'ar' ? 'رصيد أول سند' : 'Opening Stock Entry', h2: language === 'ar' ? 'كمية' : 'Qty', val: (item) => item.opb_qty },
      ...(viewMode === 'qty_and_val' ? [{ h1: '', h2: language === 'ar' ? 'قيمة' : 'Val', val: (item: any) => item.opb_val }] : []),
      
      // Purchases
      { h1: language === 'ar' ? 'مشتريات' : 'Purchases', h2: language === 'ar' ? 'كمية' : 'Qty', val: (item) => item.purchases_qty },
      ...(viewMode === 'qty_and_val' ? [{ h1: '', h2: language === 'ar' ? 'قيمة' : 'Val', val: (item: any) => item.purchases_val }] : []),
      
      // Purchase Returns
      { h1: language === 'ar' ? 'مردودات مشتريات' : 'Purchase Returns', h2: language === 'ar' ? 'كمية' : 'Qty', val: (item) => Math.abs(item.purchase_returns_qty) },
      ...(viewMode === 'qty_and_val' ? [{ h1: '', h2: language === 'ar' ? 'قيمة' : 'Val', val: (item: any) => Math.abs(item.purchase_returns_val) }] : []),
      
      // Sales
      { h1: language === 'ar' ? 'مبيعات' : 'Sales', h2: language === 'ar' ? 'كمية' : 'Qty', val: (item) => Math.abs(item.sales_qty) },
      ...(viewMode === 'qty_and_val' ? [{ h1: '', h2: language === 'ar' ? 'قيمة' : 'Val', val: (item: any) => Math.abs(item.sales_val) }] : []),
      
      // Sales Returns
      { h1: language === 'ar' ? 'مردودات مبيعات' : 'Sales Returns', h2: language === 'ar' ? 'كمية' : 'Qty', val: (item) => item.sales_returns_qty },
      ...(viewMode === 'qty_and_val' ? [{ h1: '', h2: language === 'ar' ? 'قيمة' : 'Val', val: (item: any) => item.sales_returns_val }] : []),
      
      // Transfers
      { h1: language === 'ar' ? 'تحويلات' : 'Transfers', h2: language === 'ar' ? 'كمية' : 'Qty', val: (item) => item.transfers_qty },
      ...(viewMode === 'qty_and_val' ? [{ h1: '', h2: language === 'ar' ? 'قيمة' : 'Val', val: (item: any) => item.transfers_val }] : []),
      
      // Adjustments
      { h1: language === 'ar' ? 'تسويات' : 'Adjustments', h2: language === 'ar' ? 'كمية' : 'Qty', val: (item) => item.adjustments_qty },
      ...(viewMode === 'qty_and_val' ? [{ h1: '', h2: language === 'ar' ? 'قيمة' : 'Val', val: (item: any) => item.adjustments_val }] : []),
      
      // Period End
      { h1: language === 'ar' ? 'رصيد آخر المدة' : 'Period End Balance', h2: language === 'ar' ? 'كمية' : 'Qty', val: (item) => item.ending_qty },
      ...(viewMode !== 'qty_only' ? [
        { h1: '', h2: language === 'ar' ? 'قيمة' : 'Val', val: (item: any) => item.ending_val },
        { h1: language === 'ar' ? 'قيمة المخزون' : 'Inventory Value', h2: language === 'ar' ? 'قيمة' : 'Val', val: (item: any) => item.ending_val }
      ] : [])
    ];

    const headers1 = cols.map(c => c.h1);
    const headers2 = cols.map(c => c.h2);
    const rows: any[] = [headers1, headers2];

    groupedData.forEach(group => {
      if (groupBy !== 'all') {
        const groupTitleRow = new Array(cols.length).fill('');
        groupTitleRow[0] = group.name;
        rows.push(groupTitleRow);
      }

      group.items.forEach((item: any) => {
        const itemRow = cols.map(c => c.val(item));
        rows.push(itemRow);
      });

      if (groupBy !== 'all' && group.items.length > 0) {
        const subTotals = getTotals(group.items);
        const subtotalRow = cols.map((c, index) => {
          if (index === 0) return language === 'ar' ? `إجمالي: ${group.name}` : `Total: ${group.name}`;
          if (index === 1 || index === 2) return '';
          return c.val(subTotals);
        });
        rows.push(subtotalRow);
      }
    });

    // Grand Totals row
    const grandTotalRow = cols.map((c, index) => {
      if (index === 0) return language === 'ar' ? 'الإجمالي العام' : 'Grand Total';
      if (index === 1 || index === 2) return '';
      return c.val(grandTotals);
    });
    rows.push(grandTotalRow);

    exportToExcel(rows, {
      filename: `Stock_Balances_Report_${dateFrom}_to_${dateTo}`,
      sheetName: language === 'ar' ? 'أرصدة المخزون' : 'Stock Balances'
    });
  };

  // PDF and Print handlers
  const handleExportPDF = async () => {
    if (reportTableRef.current) {
      await exportToPDF(reportTableRef.current, {
        filename: `Stock_Balances_Report_${dateFrom}_to_${dateTo}`,
        reportTitle: language === 'ar'
          ? `تقرير حركة وأرصدة المخزون من ${dateFrom} إلى ${dateTo}`
          : `Stock Balances & Movements Report from ${dateFrom} to ${dateTo}`
      });
    }
  };

  const handlePrint = () => {
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        body * { visibility: hidden !important; }
        #stock-balances-printable, #stock-balances-printable * { visibility: visible !important; }
        #stock-balances-printable {
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

  const toggleSort = (field: 'code' | 'name' | 'ending_qty' | 'ending_val') => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const totalColumns = viewMode === 'qty_and_val' ? 22 : (viewMode === 'qty_only' ? 12 : 14);
  const tableMinWidthClass = viewMode === 'qty_only' ? 'min-w-[1200px]' : (viewMode === 'qty_and_end_val' ? 'min-w-[1400px]' : 'min-w-[2000px]');

  return (
    <div className="space-y-8" dir={dir}>
      {/* Title block */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
            <BarChart3 size={28} />
          </div>
          <div className="text-right">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-1">
              {language === 'ar' ? 'تقرير أرصدة المخزون خلال فترة' : 'Period Stock Balances Report'}
            </h1>
            <p className="text-slate-400 text-sm font-bold">
              {language === 'ar'
                ? 'متابعة كميات وقيم حركة المخزون بالتفصيل مع إمكانية الفرز والتجميع والترتيب'
                : 'Track stock quantities and values in details with sorting and grouping filters'}
            </p>
          </div>
        </div>
      </div>

      {/* Filter panel */}
      <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-right">
          {/* Date From */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest px-1">
              {language === 'ar' ? 'من تاريخ' : 'Date From'}
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3.5 text-slate-400" size={16} />
              <input 
                type="date" 
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-sm text-slate-800"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
          </div>

          {/* Date To */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest px-1">
              {language === 'ar' ? 'إلى تاريخ' : 'Date To'}
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3.5 text-slate-400" size={16} />
              <input 
                type="date" 
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-sm text-slate-800"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          {/* Warehouse Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest px-1">
              {language === 'ar' ? 'المخزن / المستودع' : 'Warehouse'}
            </label>
            <div className="relative">
              <Home className="absolute left-3 top-3.5 text-slate-400" size={16} />
              <select
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-sm text-slate-800 appearance-none"
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
              >
                <option value="">{language === 'ar' ? 'جميع المخازن' : 'All Warehouses'}</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Item Group Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest px-1">
              {language === 'ar' ? 'مجموعة الأصناف' : 'Item Group'}
            </label>
            <div className="relative">
              <Folder className="absolute left-3 top-3.5 text-slate-400" size={16} />
              <select
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-sm text-slate-800 appearance-none"
                value={filterItemGroupId}
                onChange={(e) => setFilterItemGroupId(e.target.value)}
              >
                <option value="">{language === 'ar' ? 'جميع المجموعات' : 'All Groups'}</option>
                {itemGroups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end text-right">
          {/* Item Type Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest px-1">
              {language === 'ar' ? 'نوع الصنف' : 'Item Type'}
            </label>
            <div className="relative">
              <Layers className="absolute left-3 top-3.5 text-slate-400" size={16} />
              <select
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-sm text-slate-800 appearance-none"
                value={filterItemType}
                onChange={(e) => setFilterItemType(e.target.value)}
              >
                <option value="">{language === 'ar' ? 'جميع الأنواع' : 'All Types'}</option>
                <option value="finished_good">{getProductTypeLabel('finished_good')}</option>
                <option value="raw_material">{getProductTypeLabel('raw_material')}</option>
                <option value="commodity">{getProductTypeLabel('commodity')}</option>
                <option value="consumable">{getProductTypeLabel('consumable')}</option>
              </select>
            </div>
          </div>

          {/* Search keyword */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest px-1">
              {language === 'ar' ? 'البحث بالاسم أو الكود' : 'Search Name / Code'}
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-3.5 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder={language === 'ar' ? 'اكتب اسم الصنف أو الكود للبحث...' : 'Search keyword...'}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-sm text-slate-800 text-right"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-4">
            <button 
              onClick={loadReportData}
              disabled={loading}
              className="flex-grow flex items-center justify-center gap-2 px-6 py-2.5 bg-slate-900 text-white hover:bg-slate-800 rounded-xl transition-all disabled:opacity-50 h-[42px] font-bold text-sm"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              {loading ? (language === 'ar' ? 'تحميل...' : 'Loading...') : (language === 'ar' ? 'تحديث البيانات' : 'Refresh')}
            </button>
          </div>
        </div>

        {/* Grouping & Formatting toggles */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-slate-50 px-6 py-4 rounded-2xl border border-slate-100 flex-wrap gap-4 text-right">
          <div className="flex items-center gap-6 flex-wrap">
            {/* Grouping select */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400">{language === 'ar' ? 'تجميع حسب: ' : 'Group by: '}</span>
              <select
                className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as any)}
              >
                <option value="all">{language === 'ar' ? 'بدون تجميع (مسطح)' : 'No Grouping'}</option>
                <option value="group">{language === 'ar' ? 'مجموعة الأصناف' : 'Item Group'}</option>
                <option value="type">{language === 'ar' ? 'نوع الصنف' : 'Item Type'}</option>
              </select>
            </div>

            {/* View Mode select */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400">{language === 'ar' ? 'طريقة العرض: ' : 'View Mode: '}</span>
              <select
                className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as any)}
              >
                <option value="qty_and_val">{language === 'ar' ? 'الكميات والقيمة' : 'Qty and Value'}</option>
                <option value="qty_only">{language === 'ar' ? 'الكميات فقط' : 'Qty Only'}</option>
                <option value="qty_and_end_val">{language === 'ar' ? 'الكميات وقيمة رصيد آخر المدة' : 'Qty and Ending Value'}</option>
              </select>
            </div>

            {/* Zero balance toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input 
                type="checkbox"
                className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                checked={hideZeroBalances}
                onChange={(e) => setHideZeroBalances(e.target.checked)}
              />
              <span className="text-xs font-bold text-slate-500">{language === 'ar' ? 'إخفاء الأصناف الصفرية' : 'Hide zero-balance items'}</span>
            </label>
          </div>

          {/* Export tools */}
          <div className="flex items-center gap-2 self-end">
            <button 
              onClick={handlePrint}
              className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:text-emerald-600 rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2 text-xs font-bold shadow-sm"
            >
              <Printer size={16} />
              <span>{language === 'ar' ? 'طباعة' : 'Print'}</span>
            </button>

            <button 
              onClick={handleExportPDF}
              className="p-2.5 bg-white border border-slate-200 text-rose-600 hover:bg-rose-50 rounded-xl transition-all flex items-center gap-2 text-xs font-bold shadow-sm"
            >
              <FileText size={16} />
              <span>PDF</span>
            </button>

            <button 
              onClick={handleExportExcel}
              className="p-2.5 bg-white border border-slate-200 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all flex items-center gap-2 text-xs font-bold shadow-sm"
            >
              <Download size={16} />
              <span>Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid Table Display */}
      <div id="stock-balances-printable" className="border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm bg-white p-6 md:p-8">
        <div className="text-center mb-8 border-b border-slate-50 pb-6">
          <h2 className="text-2xl font-black text-slate-900 mb-2">
            {language === 'ar' ? 'أرصدة وحركة المخزون خلال فترة' : 'Stock Balances & Movements Report'}
          </h2>
          <div className="flex justify-center flex-wrap gap-8 text-xs text-slate-400 mt-2 font-bold">
            <p>{language === 'ar' ? 'المخزن:' : 'Warehouse:'} <span className="text-slate-800 font-extrabold">{warehouses.find(w => w.id === selectedWarehouseId)?.name || (language === 'ar' ? 'جميع المخازن' : 'All Warehouses')}</span></p>
            <p>{language === 'ar' ? 'الفترة:' : 'Period:'} <span className="text-slate-800 font-extrabold">{dateFrom}</span> {language === 'ar' ? 'إلى' : 'to'} <span className="text-slate-800 font-extrabold">{dateTo}</span></p>
            <p>{language === 'ar' ? 'عدد الأصناف:' : 'Items Count:'} <span className="text-slate-800 font-extrabold">{filteredStats.length}</span></p>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        ) : filteredStats.length === 0 ? (
          <div className="p-16 text-center border-2 border-dashed border-slate-100 rounded-[2.5rem] bg-slate-50/20">
            <Package className="w-14 h-14 text-slate-300 mx-auto mb-4 animate-pulse" />
            <p className="text-slate-400 font-extrabold text-lg">{language === 'ar' ? 'لا توجد أصناف تطابق الفلاتر المحددة' : 'No products match the selected filters'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table ref={reportTableRef} className={`w-full ${tableMinWidthClass} border-collapse bg-white text-center text-[11px] font-bold`}>
              <thead className="bg-slate-50 text-[10px] uppercase font-black tracking-wider text-slate-400 border-b border-slate-200">
                {/* Double-header - Row 1 */}
                <tr>
                  <th colSpan={3} className="px-4 py-3 border-r border-slate-200 text-slate-500 font-black">{language === 'ar' ? 'تفاصيل الصنف' : 'Product Details'}</th>
                  <th colSpan={viewMode === 'qty_and_val' ? 2 : 1} className="px-4 py-3 border-r border-slate-200 bg-slate-100/50 text-slate-600 font-bold">{language === 'ar' ? 'أول الفترة' : 'Period Start'}</th>
                  <th colSpan={viewMode === 'qty_and_val' ? 2 : 1} className="px-4 py-3 border-r border-slate-200 bg-teal-50/20 text-teal-800 font-bold">{language === 'ar' ? 'رصيد أول سند' : 'Opening Doc'}</th>
                  <th colSpan={viewMode === 'qty_and_val' ? 2 : 1} className="px-4 py-3 border-r border-slate-200 bg-emerald-50/30 text-emerald-800 font-bold">{language === 'ar' ? 'مشتريات' : 'Purchases'}</th>
                  <th colSpan={viewMode === 'qty_and_val' ? 2 : 1} className="px-4 py-3 border-r border-slate-200 bg-rose-50/20 text-rose-800 font-bold">{language === 'ar' ? 'مردودات مشتريات' : 'Purchase Returns'}</th>
                  <th colSpan={viewMode === 'qty_and_val' ? 2 : 1} className="px-4 py-3 border-r border-slate-200 bg-sky-50/30 text-sky-800 font-bold">{language === 'ar' ? 'مبيعات' : 'Sales'}</th>
                  <th colSpan={viewMode === 'qty_and_val' ? 2 : 1} className="px-4 py-3 border-r border-slate-200 bg-orange-50/20 text-orange-800 font-bold">{language === 'ar' ? 'مردودات مبيعات' : 'Sales Returns'}</th>
                  <th colSpan={viewMode === 'qty_and_val' ? 2 : 1} className="px-4 py-3 border-r border-slate-200 bg-purple-50/20 text-purple-800 font-bold">{language === 'ar' ? 'صافي تحويلات' : 'Transfers'}</th>
                  <th colSpan={viewMode === 'qty_and_val' ? 2 : 1} className="px-4 py-3 border-r border-slate-200 bg-amber-50/20 text-amber-800 font-bold">{language === 'ar' ? 'تسويات' : 'Adjustments'}</th>
                  <th colSpan={viewMode === 'qty_only' ? 1 : 3} className="px-4 py-3 bg-zinc-100 text-zinc-900 font-black">{language === 'ar' ? 'رصيد آخر الفترة والقيمة' : 'Period End Balance'}</th>
                </tr>
                {/* Double-header - Row 2 */}
                <tr className="border-b border-slate-200 bg-slate-50/30">
                  <th className="px-4 py-2 border-r border-slate-200 cursor-pointer hover:bg-slate-100" onClick={() => toggleSort('code')}>
                    {language === 'ar' ? 'الكود' : 'Code'} {sortBy === 'code' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="px-5 py-2 border-r border-slate-200 cursor-pointer hover:bg-slate-100 text-right" onClick={() => toggleSort('name')}>
                    {language === 'ar' ? 'الاسم' : 'Name'} {sortBy === 'name' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="px-4 py-2 border-r border-slate-200">{language === 'ar' ? 'السياسة' : 'Policy'}</th>
                  
                  {/* Start */}
                  <th className="px-3 py-2 border-r border-slate-200 bg-slate-100/20 text-slate-500">{language === 'ar' ? 'كمية' : 'Qty'}</th>
                  {viewMode === 'qty_and_val' && <th className="px-3 py-2 border-r border-slate-200 bg-slate-100/20 text-slate-500">{language === 'ar' ? 'قيمة' : 'Val'}</th>}
                  
                  {/* Opening balance doc */}
                  <th className="px-3 py-2 border-r border-slate-200 bg-teal-50/10 text-teal-600">{language === 'ar' ? 'كمية' : 'Qty'}</th>
                  {viewMode === 'qty_and_val' && <th className="px-3 py-2 border-r border-slate-200 bg-teal-50/10 text-teal-600">{language === 'ar' ? 'قيمة' : 'Val'}</th>}

                  {/* Purchases */}
                  <th className="px-3 py-2 border-r border-slate-200 bg-emerald-50/10 text-emerald-600">{language === 'ar' ? 'كمية' : 'Qty'}</th>
                  {viewMode === 'qty_and_val' && <th className="px-3 py-2 border-r border-slate-200 bg-emerald-50/10 text-emerald-600">{language === 'ar' ? 'قيمة' : 'Val'}</th>}

                  {/* Purchase Returns */}
                  <th className="px-3 py-2 border-r border-slate-200 bg-rose-50/10 text-rose-600">{language === 'ar' ? 'كمية' : 'Qty'}</th>
                  {viewMode === 'qty_and_val' && <th className="px-3 py-2 border-r border-slate-200 bg-rose-50/10 text-rose-600">{language === 'ar' ? 'قيمة' : 'Val'}</th>}

                  {/* Sales */}
                  <th className="px-3 py-2 border-r border-slate-200 bg-sky-50/10 text-sky-600">{language === 'ar' ? 'كمية' : 'Qty'}</th>
                  {viewMode === 'qty_and_val' && <th className="px-3 py-2 border-r border-slate-200 bg-sky-50/10 text-sky-600">{language === 'ar' ? 'قيمة' : 'Val'}</th>}

                  {/* Sales Returns */}
                  <th className="px-3 py-2 border-r border-slate-200 bg-orange-50/10 text-orange-600">{language === 'ar' ? 'كمية' : 'Qty'}</th>
                  {viewMode === 'qty_and_val' && <th className="px-3 py-2 border-r border-slate-200 bg-orange-50/10 text-orange-600">{language === 'ar' ? 'قيمة' : 'Val'}</th>}

                  {/* Transfers */}
                  <th className="px-3 py-2 border-r border-slate-200 bg-purple-50/10 text-purple-600">{language === 'ar' ? 'كمية' : 'Qty'}</th>
                  {viewMode === 'qty_and_val' && <th className="px-3 py-2 border-r border-slate-200 bg-purple-50/10 text-purple-600">{language === 'ar' ? 'قيمة' : 'Val'}</th>}

                  {/* Adjustments */}
                  <th className="px-3 py-2 border-r border-slate-200 bg-amber-50/10 text-amber-600">{language === 'ar' ? 'كمية' : 'Qty'}</th>
                  {viewMode === 'qty_and_val' && <th className="px-3 py-2 border-r border-slate-200 bg-amber-50/10 text-amber-600">{language === 'ar' ? 'قيمة' : 'Val'}</th>}

                  {/* End */}
                  <th className="px-3 py-2 border-r border-slate-250 bg-zinc-200/50 text-zinc-900 cursor-pointer" onClick={() => toggleSort('ending_qty')}>
                    {language === 'ar' ? 'كمية آخر' : 'Qty End'} {sortBy === 'ending_qty' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  {viewMode !== 'qty_only' && (
                    <>
                      <th className="px-3 py-2 border-r border-slate-250 bg-zinc-200/50 text-zinc-900 cursor-pointer" onClick={() => toggleSort('ending_val')}>
                        {language === 'ar' ? 'القيمة' : 'Inventory Val'} {sortBy === 'ending_val' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </th>
                      <th className="px-3 py-2 bg-emerald-100 text-emerald-800">{language === 'ar' ? 'قيمة المخزون' : 'Stock Value'}</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {groupedData.map(group => (
                  <React.Fragment key={group.id}>
                    {/* Render Group Title Header */}
                    {groupBy !== 'all' && (
                      <tr className="bg-slate-50/80 font-black text-slate-900 text-right">
                        <td colSpan={totalColumns} className="px-6 py-3 font-extrabold text-sm border-y border-slate-200 text-indigo-900">
                          {groupBy === 'group' ? (language === 'ar' ? 'مجموعة: ' : 'Group: ') : (language === 'ar' ? 'نوع: ' : 'Type: ')}
                          {group.name}
                        </td>
                      </tr>
                    )}

                    {/* Group Items */}
                    {group.items.map((item: any, idx) => (
                      <tr key={item.product.id || idx} className="hover:bg-slate-50/30 transition-colors">
                        <td 
                          className="px-4 py-3.5 border-r border-slate-200 font-mono text-[10px] whitespace-nowrap text-indigo-600 hover:text-indigo-900 cursor-pointer hover:underline"
                          onClick={() => {
                            sessionStorage.setItem('stock_card_filter_product_id', item.product.id);
                            sessionStorage.setItem('stock_card_filter_date_from', dateFrom);
                            sessionStorage.setItem('stock_card_filter_date_to', dateTo);
                            setCurrentPage('stock_card_report');
                          }}
                          title={language === 'ar' ? 'عرض كارت الصنف لهذا الصنف' : 'View stock card for this product'}
                        >
                          {item.product.code}
                        </td>
                        <td className="px-5 py-3.5 border-r border-slate-200 text-slate-900 font-bold text-right whitespace-nowrap">{item.product.name}</td>
                        <td className="px-4 py-3.5 border-r border-slate-200 text-[10px] text-slate-500 whitespace-nowrap">{getCostMethodLabel(item.product.inventory_cost_method)}</td>
                        
                        {/* Opening stats */}
                        <td className="px-3 py-3.5 border-r border-slate-200 bg-slate-50/20 font-mono text-slate-600">{item.opening_qty !== 0 ? formatNumber(item.opening_qty) : '-'}</td>
                        {viewMode === 'qty_and_val' && <td className="px-3 py-3.5 border-r border-slate-200 bg-slate-50/20 font-mono text-slate-600">{item.opening_val !== 0 ? formatNumber(item.opening_val) : '-'}</td>}

                        {/* Opening Doc stats */}
                        <td className="px-3 py-3.5 border-r border-slate-200 bg-teal-50/5 font-mono text-slate-800">{item.opb_qty !== 0 ? formatNumber(item.opb_qty) : '-'}</td>
                        {viewMode === 'qty_and_val' && <td className="px-3 py-3.5 border-r border-slate-200 bg-teal-50/5 font-mono text-slate-800">{item.opb_val !== 0 ? formatNumber(item.opb_val) : '-'}</td>}

                        {/* Purchases stats */}
                        <td className="px-3 py-3.5 border-r border-slate-200 bg-emerald-50/5 font-mono text-slate-800">{item.purchases_qty !== 0 ? formatNumber(item.purchases_qty) : '-'}</td>
                        {viewMode === 'qty_and_val' && <td className="px-3 py-3.5 border-r border-slate-200 bg-emerald-50/5 font-mono text-slate-800">{item.purchases_val !== 0 ? formatNumber(item.purchases_val) : '-'}</td>}

                        {/* Purchase returns stats */}
                        <td className="px-3 py-3.5 border-r border-slate-200 bg-rose-50/5 font-mono text-rose-600">{item.purchase_returns_qty !== 0 ? formatNumber(Math.abs(item.purchase_returns_qty)) : '-'}</td>
                        {viewMode === 'qty_and_val' && <td className="px-3 py-3.5 border-r border-slate-200 bg-rose-50/5 font-mono text-rose-600">{item.purchase_returns_val !== 0 ? formatNumber(Math.abs(item.purchase_returns_val)) : '-'}</td>}

                        {/* Sales stats */}
                        <td className="px-3 py-3.5 border-r border-slate-200 bg-sky-50/5 font-mono text-slate-800">{item.sales_qty !== 0 ? formatNumber(Math.abs(item.sales_qty)) : '-'}</td>
                        {viewMode === 'qty_and_val' && <td className="px-3 py-3.5 border-r border-slate-200 bg-sky-50/5 font-mono text-slate-800">{item.sales_val !== 0 ? formatNumber(Math.abs(item.sales_val)) : '-'}</td>}

                        {/* Sales returns stats */}
                        <td className="px-3 py-3.5 border-r border-slate-200 bg-orange-50/5 font-mono text-slate-800">{item.sales_returns_qty !== 0 ? formatNumber(item.sales_returns_qty) : '-'}</td>
                        {viewMode === 'qty_and_val' && <td className="px-3 py-3.5 border-r border-slate-200 bg-orange-50/5 font-mono text-slate-800">{item.sales_returns_val !== 0 ? formatNumber(item.sales_returns_val) : '-'}</td>}

                        {/* Transfers stats */}
                        <td className="px-3 py-3.5 border-r border-slate-200 bg-purple-50/5 font-mono text-slate-800">{item.transfers_qty !== 0 ? formatNumber(item.transfers_qty) : '-'}</td>
                        {viewMode === 'qty_and_val' && <td className="px-3 py-3.5 border-r border-slate-200 bg-purple-50/5 font-mono text-slate-800">{item.transfers_val !== 0 ? formatNumber(item.transfers_val) : '-'}</td>}

                        {/* Adjustments stats */}
                        <td className="px-3 py-3.5 border-r border-slate-200 bg-amber-50/5 font-mono text-slate-800">{item.adjustments_qty !== 0 ? formatNumber(item.adjustments_qty) : '-'}</td>
                        {viewMode === 'qty_and_val' && <td className="px-3 py-3.5 border-r border-slate-200 bg-amber-50/5 font-mono text-slate-800">{item.adjustments_val !== 0 ? formatNumber(item.adjustments_val) : '-'}</td>}

                        {/* Ending stats */}
                        <td className="px-3 py-3.5 border-r border-slate-250 bg-slate-100/50 font-mono text-slate-900 font-black">{formatNumber(item.ending_qty)}</td>
                        {viewMode !== 'qty_only' && (
                          <>
                            <td className="px-3 py-3.5 border-r border-slate-250 bg-slate-100/50 font-mono text-slate-900 font-black">{formatNumber(item.ending_val)}</td>
                            <td className="px-3 py-3.5 bg-emerald-50 font-mono text-emerald-800 font-black">{formatNumber(item.ending_val)}</td>
                          </>
                        )}
                      </tr>
                    ))}

                    {/* Render Group Subtotals */}
                    {groupBy !== 'all' && group.items.length > 0 && (() => {
                      const subTotals = getTotals(group.items);
                      return (
                        <tr className="bg-slate-100/50 font-black text-slate-900 text-xs border-t border-slate-200">
                          <td colSpan={3} className="px-6 py-3 font-extrabold text-indigo-950 text-right">
                            {language === 'ar' ? `إجمالي: ${group.name}` : `Total: ${group.name}`}
                          </td>
                          {/* Totals values */}
                          <td className="px-3 py-3 font-mono">{subTotals.opening_qty !== 0 ? formatNumber(subTotals.opening_qty) : '-'}</td>
                          {viewMode === 'qty_and_val' && <td className="px-3 py-3 font-mono">{subTotals.opening_val !== 0 ? formatNumber(subTotals.opening_val) : '-'}</td>}
                          <td className="px-3 py-3 font-mono">{subTotals.opb_qty !== 0 ? formatNumber(subTotals.opb_qty) : '-'}</td>
                          {viewMode === 'qty_and_val' && <td className="px-3 py-3 font-mono">{subTotals.opb_val !== 0 ? formatNumber(subTotals.opb_val) : '-'}</td>}
                          <td className="px-3 py-3 font-mono">{subTotals.purchases_qty !== 0 ? formatNumber(subTotals.purchases_qty) : '-'}</td>
                          {viewMode === 'qty_and_val' && <td className="px-3 py-3 font-mono">{subTotals.purchases_val !== 0 ? formatNumber(subTotals.purchases_val) : '-'}</td>}
                          <td className="px-3 py-3 font-mono text-rose-600">{subTotals.purchase_returns_qty !== 0 ? formatNumber(Math.abs(subTotals.purchase_returns_qty)) : '-'}</td>
                          {viewMode === 'qty_and_val' && <td className="px-3 py-3 font-mono text-rose-600">{subTotals.purchase_returns_val !== 0 ? formatNumber(Math.abs(subTotals.purchase_returns_val)) : '-'}</td>}
                          <td className="px-3 py-3 font-mono">{subTotals.sales_qty !== 0 ? formatNumber(Math.abs(subTotals.sales_qty)) : '-'}</td>
                          {viewMode === 'qty_and_val' && <td className="px-3 py-3 font-mono">{subTotals.sales_val !== 0 ? formatNumber(Math.abs(subTotals.sales_val)) : '-'}</td>}
                          <td className="px-3 py-3 font-mono">{subTotals.sales_returns_qty !== 0 ? formatNumber(subTotals.sales_returns_qty) : '-'}</td>
                          {viewMode === 'qty_and_val' && <td className="px-3 py-3 font-mono">{subTotals.sales_returns_val !== 0 ? formatNumber(subTotals.sales_returns_val) : '-'}</td>}
                          <td className="px-3 py-3 font-mono">{subTotals.transfers_qty !== 0 ? formatNumber(subTotals.transfers_qty) : '-'}</td>
                          {viewMode === 'qty_and_val' && <td className="px-3 py-3 font-mono">{subTotals.transfers_val !== 0 ? formatNumber(subTotals.transfers_val) : '-'}</td>}
                          <td className="px-3 py-3 font-mono">{subTotals.adjustments_qty !== 0 ? formatNumber(subTotals.adjustments_qty) : '-'}</td>
                          {viewMode === 'qty_and_val' && <td className="px-3 py-3 font-mono">{subTotals.adjustments_val !== 0 ? formatNumber(subTotals.adjustments_val) : '-'}</td>}
                          
                          <td className="px-3 py-3 font-mono text-slate-900 bg-slate-200/50 font-black">{formatNumber(subTotals.ending_qty)}</td>
                          {viewMode !== 'qty_only' && (
                            <>
                              <td className="px-3 py-3 font-mono text-slate-900 bg-slate-200/50 font-black">{formatNumber(subTotals.ending_val)}</td>
                              <td className="px-3 py-3 font-mono text-emerald-800 bg-emerald-100/50 font-black">{formatNumber(subTotals.ending_val)}</td>
                            </>
                          )}
                        </tr>
                      );
                    })()}
                  </React.Fragment>
                ))}

                {/* Grand Total Footer */}
                <tr className="bg-zinc-900 text-white font-black text-xs border-t-2 border-zinc-950">
                  <td colSpan={3} className="px-6 py-4 text-right text-sm">
                    {language === 'ar' ? 'الإجمالي العام للمخزون' : 'Inventory Grand Total'}
                  </td>
                  <td className="px-3 py-4 font-mono">{grandTotals.opening_qty !== 0 ? formatNumber(grandTotals.opening_qty) : '-'}</td>
                  {viewMode === 'qty_and_val' && <td className="px-3 py-4 font-mono">{grandTotals.opening_val !== 0 ? formatNumber(grandTotals.opening_val) : '-'}</td>}
                  <td className="px-3 py-4 font-mono">{grandTotals.opb_qty !== 0 ? formatNumber(grandTotals.opb_qty) : '-'}</td>
                  {viewMode === 'qty_and_val' && <td className="px-3 py-4 font-mono">{grandTotals.opb_val !== 0 ? formatNumber(grandTotals.opb_val) : '-'}</td>}
                  <td className="px-3 py-4 font-mono">{grandTotals.purchases_qty !== 0 ? formatNumber(grandTotals.purchases_qty) : '-'}</td>
                  {viewMode === 'qty_and_val' && <td className="px-3 py-4 font-mono">{grandTotals.purchases_val !== 0 ? formatNumber(grandTotals.purchases_val) : '-'}</td>}
                  <td className="px-3 py-4 font-mono text-rose-300">{grandTotals.purchase_returns_qty !== 0 ? formatNumber(Math.abs(grandTotals.purchase_returns_qty)) : '-'}</td>
                  {viewMode === 'qty_and_val' && <td className="px-3 py-4 font-mono text-rose-300">{grandTotals.purchase_returns_val !== 0 ? formatNumber(Math.abs(grandTotals.purchase_returns_val)) : '-'}</td>}
                  <td className="px-3 py-4 font-mono">{grandTotals.sales_qty !== 0 ? formatNumber(Math.abs(grandTotals.sales_qty)) : '-'}</td>
                  {viewMode === 'qty_and_val' && <td className="px-3 py-4 font-mono">{grandTotals.sales_val !== 0 ? formatNumber(Math.abs(grandTotals.sales_val)) : '-'}</td>}
                  <td className="px-3 py-4 font-mono">{grandTotals.sales_returns_qty !== 0 ? formatNumber(grandTotals.sales_returns_qty) : '-'}</td>
                  {viewMode === 'qty_and_val' && <td className="px-3 py-4 font-mono">{grandTotals.sales_returns_val !== 0 ? formatNumber(grandTotals.sales_returns_val) : '-'}</td>}
                  <td className="px-3 py-4 font-mono">{grandTotals.transfers_qty !== 0 ? formatNumber(grandTotals.transfers_qty) : '-'}</td>
                  {viewMode === 'qty_and_val' && <td className="px-3 py-4 font-mono">{grandTotals.transfers_val !== 0 ? formatNumber(grandTotals.transfers_val) : '-'}</td>}
                  <td className="px-3 py-4 font-mono">{grandTotals.adjustments_qty !== 0 ? formatNumber(grandTotals.adjustments_qty) : '-'}</td>
                  {viewMode === 'qty_and_val' && <td className="px-3 py-4 font-mono">{grandTotals.adjustments_val !== 0 ? formatNumber(grandTotals.adjustments_val) : '-'}</td>}
                  
                  <td className="px-3 py-4 font-mono bg-zinc-800 text-zinc-100 font-extrabold">{formatNumber(grandTotals.ending_qty)}</td>
                  {viewMode !== 'qty_only' && (
                    <>
                      <td className="px-3 py-4 font-mono bg-zinc-800 text-zinc-100 font-extrabold">{formatNumber(grandTotals.ending_val)}</td>
                      <td className="px-3 py-4 font-mono bg-emerald-800 text-emerald-100 font-extrabold">{formatNumber(grandTotals.ending_val)}</td>
                    </>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
