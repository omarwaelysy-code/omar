import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Product, Warehouse } from '../types';
import { dbService } from '../services/dbService';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigation } from '../contexts/NavigationContext';
import { formatNumber, formatDate } from '../utils/formatUtils';
import { exportToExcel } from '../utils/excelUtils';
import { exportToPDF } from '../utils/pdfUtils';
import { 
  BarChart3, Search, Calendar, Home, RefreshCw, Printer, Download, FileText, 
  Folder, Sliders, ChevronDown, ChevronRight, Layers, Package, History, ArrowUpDown
} from 'lucide-react';

interface ItemGroup {
  id: string;
  company_id: string;
  name: string;
  code: string;
  type: string;
}

interface DocMapInfo {
  partner: string;
  description: string;
  entry_number?: string;
  type?: string;
}

export const GeneralStockMovementsReport: React.FC = () => {
  const { user } = useAuth();
  const { dir, language } = useLanguage();
  const { setCurrentPage, setPendingViewDoc } = useNavigation();

  // Data states
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [itemGroups, setItemGroups] = useState<ItemGroup[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [goodsReceipts, setGoodsReceipts] = useState<any[]>([]);
  const [goodsReceiptItems, setGoodsReceiptItems] = useState<any[]>([]);
  const [docMap, setDocMap] = useState<Record<string, DocMapInfo>>({});
  const [loading, setLoading] = useState(false);

  const printableAreaRef = useRef<HTMLDivElement>(null);
  const reportTableRef = useRef<HTMLTableElement>(null);

  // Filter states
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(firstDayOfMonth);
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [filterItemGroupId, setFilterItemGroupId] = useState('');
  const [filterItemType, setFilterItemType] = useState('');
  const [filterMovementType, setFilterMovementType] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');

  // Grouping & Sorting states
  const [groupBy, setGroupBy] = useState<'all' | 'group' | 'type'>('all');
  const [sortBy, setSortBy] = useState<string>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Load basic reference data
  useEffect(() => {
    if (!user) return;
    const loadSelectData = async () => {
      try {
        const [prodList, whList, groupList] = await Promise.all([
          dbService.list<Product>('products', { company_id: user.company_id }),
          dbService.list<Warehouse>('warehouses', { company_id: user.company_id }),
          dbService.list<ItemGroup>('item_groups', { company_id: user.company_id })
        ]);
        setProducts((prodList || []).filter(p => p.type !== 'service'));
        setWarehouses(whList || []);
        setItemGroups(groupList || []);
      } catch (err) {
        console.error('Failed to load reference data for movements report', err);
      }
    };
    loadSelectData();
  }, [user]);

  // Load report data
  const loadReportData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Fetch movements & related docs
      const [mvs, invs, pinvs, rets, prets, jes, adjustments, transfers, openingStocks, grs, grItems] = await Promise.all([
        dbService.list<any>('inventory_movements', { company_id: user.company_id }),
        dbService.list<any>('invoices', { company_id: user.company_id }),
        dbService.list<any>('purchase_invoices', { company_id: user.company_id }),
        dbService.list<any>('returns', { company_id: user.company_id }),
        dbService.list<any>('purchase_returns', { company_id: user.company_id }),
        dbService.list<any>('journal_entries', { company_id: user.company_id }),
        dbService.list<any>('stock_adjustments', { company_id: user.company_id }),
        dbService.list<any>('warehouse_transfers', { company_id: user.company_id }),
        dbService.list<any>('opening_stock_balances', { company_id: user.company_id }),
        dbService.list<any>('goods_receipts', { company_id: user.company_id }),
        dbService.list<any>('goods_receipt_items', { company_id: user.company_id })
      ]);

      // 2. Build Journal Entry map reference_id -> entry_number
      const jeMap: Record<string, string> = {};
      (jes || []).forEach(j => {
        if (j.reference_id && j.entry_number) {
          jeMap[j.reference_id] = j.entry_number;
        }
      });

      // 3. Build doc mapping for partner and description
      const map: Record<string, DocMapInfo> = {};
      
      (invs || []).forEach(x => {
        map[x.id] = { 
          partner: x.customer_name || (language === 'ar' ? 'عميل' : 'Customer'), 
          description: x.description || '',
          entry_number: jeMap[x.id],
          type: 'sale'
        };
      });

      (pinvs || []).forEach(x => {
        map[x.id] = { 
          partner: x.supplier_name || (language === 'ar' ? 'مورد' : 'Supplier'), 
          description: x.description || '',
          entry_number: jeMap[x.id],
          type: 'purchase'
        };
      });

      (rets || []).forEach(x => {
        map[x.id] = { 
          partner: x.customer_name || (language === 'ar' ? 'عميل' : 'Customer'), 
          description: x.description || '',
          entry_number: jeMap[x.id],
          type: 'sales_return'
        };
      });

      (prets || []).forEach(x => {
        map[x.id] = { 
          partner: x.supplier_name || (language === 'ar' ? 'مورد' : 'Supplier'), 
          description: x.description || '',
          entry_number: jeMap[x.id],
          type: 'purchase_return'
        };
      });

      (adjustments || []).forEach(x => {
        map[x.id] = {
          partner: '-',
          description: x.notes || x.description || (language === 'ar' ? 'تسوية مخزنية' : 'Stock Adjustment'),
          entry_number: jeMap[x.id],
          type: 'adjustment'
        };
      });

      (transfers || []).forEach(x => {
        map[x.id] = {
          partner: '-',
          description: x.notes || x.description || (language === 'ar' ? 'تحويل مخزني' : 'Warehouse Transfer'),
          entry_number: jeMap[x.id],
          type: 'transfer'
        };
      });

      (openingStocks || []).forEach(x => {
        map[x.id] = {
          partner: '-',
          description: x.notes || (language === 'ar' ? 'رصيد أول المدة' : 'Opening Stock Balance'),
          entry_number: jeMap[x.id],
          type: 'opening_stock'
        };
      });

      setDocMap(map);
      setMovements(mvs || []);
      setGoodsReceipts(grs || []);
      setGoodsReceiptItems(grItems || []);
    } catch (err) {
      console.error('Failed to load movements ledger', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadReportData();
    }
  }, [user]);

  // Translate helpers
  const getProductTypeLabel = (type: string) => {
    switch (type) {
      case 'finished_good': return language === 'ar' ? 'منتج تام الصنع' : 'Finished Good';
      case 'raw_material': return language === 'ar' ? 'مواد خام' : 'Raw Material';
      case 'commodity': return language === 'ar' ? 'بضاعة تجارية' : 'Commodity';
      case 'consumable': return language === 'ar' ? 'مواد استهلاكية' : 'Consumable';
      default: return type;
    }
  };

  const getCostMethodLabel = (method: string) => {
    switch (method) {
      case 'wac': return language === 'ar' ? 'متوسط مرجح (WAC)' : 'Weighted Average (WAC)';
      case 'fifo': return language === 'ar' ? 'الوارد أولاً (FIFO)' : 'First In First Out (FIFO)';
      case 'lifo': return language === 'ar' ? 'الصادر أولاً (LIFO)' : 'Last In First Out (LIFO)';
      default: return method || '-';
    }
  };

  const getMovementTypeLabel = (type: string) => {
    switch(type) {
      case 'purchase': return language === 'ar' ? 'فاتورة شراء' : 'Purchase Invoice';
      case 'sale': return language === 'ar' ? 'فاتورة بيع' : 'Sales Invoice';
      case 'sales_return': return language === 'ar' ? 'مردود مبيعات' : 'Sales Return';
      case 'purchase_return': return language === 'ar' ? 'مردود مشتريات' : 'Purchase Return';
      case 'adjustment': return language === 'ar' ? 'تسوية' : 'Adjustment';
      case 'transfer': return language === 'ar' ? 'تحويل' : 'Transfer';
      default: return type;
    }
  };

  const getMovementTypePillColor = (type: string) => {
    switch(type) {
      case 'purchase': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'sale': return 'bg-sky-50 text-sky-700 border-sky-100';
      case 'sales_return': return 'bg-orange-50 text-orange-700 border-orange-100';
      case 'purchase_return': return 'bg-rose-50 text-rose-700 border-rose-100';
      case 'adjustment': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'transfer': return 'bg-purple-50 text-purple-700 border-purple-100';
      default: return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // Nav actions
  const handleProductCodeClick = (productId: string) => {
    sessionStorage.setItem('stock_card_filter_product_id', productId);
    sessionStorage.setItem('stock_card_filter_date_from', dateFrom);
    sessionStorage.setItem('stock_card_filter_date_to', dateTo);
    setCurrentPage('stock_card_report');
  };

  const handleMovementClick = (m: any) => {
    const referenceNumber = m.reference_number;
    const type = m.movement_type;
    if (!referenceNumber) return;

    if (type === 'sale') {
      setPendingViewDoc({ type: 'invoice', idOrNumber: referenceNumber });
      setCurrentPage('invoices');
    } else if (type === 'purchase') {
      setPendingViewDoc({ type: 'purchase_invoice', idOrNumber: referenceNumber });
      setCurrentPage('purchase_invoices');
    } else if (type === 'sales_return') {
      setPendingViewDoc({ type: 'return', idOrNumber: referenceNumber });
      setCurrentPage('returns');
    } else if (type === 'purchase_return') {
      setPendingViewDoc({ type: 'purchase_return', idOrNumber: referenceNumber });
      setCurrentPage('purchase_returns');
    } else if (type === 'transfer') {
      setCurrentPage('warehouse_transfers');
    } else if (type === 'adjustment') {
      setCurrentPage('stock_adjustments');
    }
  };

  const handleJournalEntryClick = (entryNumber: string) => {
    if (!entryNumber) return;
    setPendingViewDoc({ type: 'journal', idOrNumber: entryNumber });
    setCurrentPage('journal_entries');
  };

  // Build raw list of items chronologically per product to compute running value balances
  const processedData = React.useMemo(() => {
    if (movements.length === 0 || products.length === 0) return [];

    const filteredMovements = movements.filter(m => m.movement_type !== 'goods_receipt');

    // Map of product ID -> array of movements
    const productMovements: Record<string, any[]> = {};
    products.forEach(p => {
      productMovements[p.id] = [];
    });

    filteredMovements.forEach(m => {
      if (productMovements[m.product_id]) {
        productMovements[m.product_id].push(m);
      }
    });

    const results: any[] = [];

    // Calculate chronological running value balance per product
    Object.keys(productMovements).forEach(prodId => {
      const prod = products.find(p => p.id === prodId)!;
      const mvsForProduct = productMovements[prodId];

      // Sort by date ascending to calculate running balances correctly
      mvsForProduct.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      let runningQty = 0;
      let runningValue = 0;

      const mapped = mvsForProduct.map(m => {
        const qty = m.quantity || 0;
        const unitCost = m.unit_cost || 0;
        const totalCost = m.total_cost || (qty * unitCost);
        const isIncoming = qty > 0;

        const debitVal = isIncoming ? totalCost : 0;
        const creditVal = !isIncoming ? Math.abs(totalCost) : 0;

        runningQty += qty;
        runningValue += isIncoming ? debitVal : -creditVal;

        const docInfo = docMap[m.reference_id] || { partner: '-', description: '' };
        const whName = warehouses.find(w => w.id === m.warehouse_id)?.name || (language === 'ar' ? 'الرئيسي' : 'Main');

        return {
          ...m,
          product: prod,
          qtyIn: isIncoming ? qty : 0,
          qtyOut: !isIncoming ? Math.abs(qty) : 0,
          debitVal,
          creditVal,
          runningQty,
          runningValue,
          partner: docInfo.partner || '-',
          description: m.description || docInfo.description || '-',
          warehouseName: whName,
          entry_number: docInfo.entry_number || ''
        };
      });

      results.push(...mapped);
    });

    return results;
  }, [movements, products, docMap, warehouses, language]);

  // Load GRNI (Uninvoiced Goods Receipts) data for all products
  const uninvoicedReceipts = React.useMemo(() => {
    return goodsReceiptItems
      .filter(item => {
        const gr = goodsReceipts.find(g => g.id === item.goods_receipt_id);
        const prod = products.find(p => p.id === item.product_id);
        return gr && gr.status === 'posted' && prod && parseFloat(item.remaining_quantity || '0') > 0.0001;
      })
      .map(item => {
        const gr = goodsReceipts.find(g => g.id === item.goods_receipt_id);
        const prod = products.find(p => p.id === item.product_id)!;
        const qty = parseFloat(item.quantity || '0');
        const billedQty = parseFloat(item.billed_quantity || '0');
        const remainingQty = parseFloat(item.remaining_quantity || '0');
        return {
          ...item,
          product: prod,
          receipt_number: gr?.receipt_number || '',
          date: gr?.date || '',
          supplier_name: gr?.supplier_name || '',
          quantity: qty,
          billed_quantity: billedQty,
          remaining_quantity: remainingQty
        };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [goodsReceiptItems, goodsReceipts, products]);

  const filteredUninvoicedReceipts = React.useMemo(() => {
    return uninvoicedReceipts.filter(item => {
      // 1. Date filter
      const rDate = item.date?.slice(0, 10);
      if (dateFrom && rDate < dateFrom) return false;
      if (dateTo && rDate > dateTo) return false;

      // 2. Warehouse filter
      const gr = goodsReceipts.find(g => g.id === item.goods_receipt_id);
      if (selectedWarehouseId && gr?.warehouse_id !== selectedWarehouseId) return false;

      // 3. Item Group filter
      if (filterItemGroupId && item.product.item_group_id !== filterItemGroupId) return false;

      // 4. Item Type filter
      if (filterItemType && item.product.type !== filterItemType) return false;

      // 5. Search keyword
      if (searchKeyword) {
        const kw = searchKeyword.toLowerCase();
        const codeMatch = (item.product.code || '').toLowerCase().includes(kw);
        const nameMatch = (item.product.name || '').toLowerCase().includes(kw);
        const refMatch = (item.receipt_number || '').toLowerCase().includes(kw);
        const supplierMatch = (item.supplier_name || '').toLowerCase().includes(kw);

        if (!codeMatch && nameMatch && !refMatch && !supplierMatch) {
          return false;
        }
      }

      return true;
    });
  }, [uninvoicedReceipts, goodsReceipts, dateFrom, dateTo, selectedWarehouseId, filterItemGroupId, filterItemType, searchKeyword]);

  // Summary computations for all products
  const finalInvoicedQty = React.useMemo(() => {
    const lastMovementPerProduct: Record<string, number> = {};
    products.forEach(p => {
      lastMovementPerProduct[p.id] = 0;
    });
    processedData.forEach(m => {
      if (!dateTo || m.date?.slice(0, 10) <= dateTo) {
        lastMovementPerProduct[m.product_id] = m.runningQty;
      }
    });
    return Object.values(lastMovementPerProduct).reduce((acc, curr) => acc + curr, 0);
  }, [products, processedData, dateTo]);

  const totalUninvoicedQty = React.useMemo(() => {
    return filteredUninvoicedReceipts.reduce((acc, curr) => acc + curr.remaining_quantity, 0);
  }, [filteredUninvoicedReceipts]);

  const totalPhysicalQty = finalInvoicedQty + totalUninvoicedQty;

  // Apply filters
  const filteredData = React.useMemo(() => {
    return processedData.filter(m => {
      // 1. Date filter
      const mDate = m.date?.slice(0, 10);
      if (dateFrom && mDate < dateFrom) return false;
      if (dateTo && mDate > dateTo) return false;

      // 2. Warehouse filter
      if (selectedWarehouseId && m.warehouse_id !== selectedWarehouseId) return false;

      // 3. Item Group filter
      if (filterItemGroupId && m.product.item_group_id !== filterItemGroupId) return false;

      // 4. Item Type filter
      if (filterItemType && m.product.type !== filterItemType) return false;

      // 5. Movement Type filter
      if (filterMovementType && m.movement_type !== filterMovementType) return false;

      // 6. Search keyword
      if (searchKeyword) {
        const kw = searchKeyword.toLowerCase();
        const codeMatch = (m.product.code || '').toLowerCase().includes(kw);
        const nameMatch = (m.product.name || '').toLowerCase().includes(kw);
        const refMatch = (m.reference_number || '').toLowerCase().includes(kw);
        const jeMatch = (m.entry_number || '').toLowerCase().includes(kw);
        const partnerMatch = (m.partner || '').toLowerCase().includes(kw);
        const descMatch = (m.description || '').toLowerCase().includes(kw);

        if (!codeMatch && !nameMatch && !refMatch && !jeMatch && !partnerMatch && !descMatch) {
          return false;
        }
      }

      return true;
    });
  }, [processedData, dateFrom, dateTo, selectedWarehouseId, filterItemGroupId, filterItemType, filterMovementType, searchKeyword]);

  // Sort data
  const sortedData = React.useMemo(() => {
    const list = [...filteredData];
    list.sort((a, b) => {
      let valA: any = a[sortBy];
      let valB: any = b[sortBy];

      // Handle nested values
      if (sortBy === 'code') {
        valA = a.product.code || '';
        valB = b.product.code || '';
      } else if (sortBy === 'name') {
        valA = a.product.name || '';
        valB = b.product.name || '';
      } else if (sortBy === 'qtyIn') {
        valA = a.qtyIn;
        valB = b.qtyIn;
      } else if (sortBy === 'qtyOut') {
        valA = a.qtyOut;
        valB = b.qtyOut;
      } else if (sortBy === 'debitVal') {
        valA = a.debitVal;
        valB = b.debitVal;
      } else if (sortBy === 'creditVal') {
        valA = a.creditVal;
        valB = b.creditVal;
      } else if (sortBy === 'runningValue') {
        valA = a.runningValue;
        valB = b.runningValue;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredData, sortBy, sortOrder]);

  // Group data
  const groupedData = React.useMemo(() => {
    if (groupBy === 'all') {
      return [{ id: 'all', name: '', items: sortedData }];
    }

    const groups: Record<string, { id: string; name: string; items: any[] }> = {};

    sortedData.forEach(item => {
      let key = '';
      let name = '';

      if (groupBy === 'group') {
        key = item.product.item_group_id || 'unassigned';
        name = item.product.item_group_name || (language === 'ar' ? 'أصناف غير مبوبة' : 'Uncategorized');
      } else {
        key = item.product.type || 'unassigned';
        name = getProductTypeLabel(item.product.type);
      }

      if (!groups[key]) {
        groups[key] = { id: key, name, items: [] };
      }
      groups[key].items.push(item);
    });

    return Object.values(groups);
  }, [sortedData, groupBy, language]);

  // Totals calculations helper
  const getTotals = (itemsList: any[]) => {
    let qtyIn = 0;
    let qtyOut = 0;
    let debitVal = 0;
    let creditVal = 0;

    itemsList.forEach(i => {
      qtyIn += i.qtyIn || 0;
      qtyOut += i.qtyOut || 0;
      debitVal += i.debitVal || 0;
      creditVal += i.creditVal || 0;
    });

    return { qtyIn, qtyOut, debitVal, creditVal };
  };

  const grandTotals = React.useMemo(() => {
    return getTotals(filteredData);
  }, [filteredData]);

  // Print & PDF exports
  const handlePrint = () => {
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        body * { visibility: hidden !important; }
        #movements-printable, #movements-printable * { visibility: visible !important; }
        #movements-printable {
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

  const handleExportPDF = async () => {
    if (printableAreaRef.current) {
      await exportToPDF(printableAreaRef.current, {
        filename: `General_Stock_Movements_${dateFrom}_to_${dateTo}`,
        reportTitle: (() => {
          if (language === 'ar') {
            const startStr = dateFrom ? ` من ${formatDate(dateFrom)}` : '';
            const endStr = dateTo ? ` إلى ${formatDate(dateTo)}` : '';
            return `تقرير حركة المخزن العامة${startStr}${endStr}`;
          } else {
            const startStr = dateFrom ? ` from ${formatDate(dateFrom)}` : '';
            const endStr = dateTo ? ` to ${formatDate(dateTo)}` : '';
            return `General Stock Movements Report${startStr}${endStr}`;
          }
        })()
      });
    }
  };

  // Excel export
  const handleExportExcel = () => {
    interface ColDef {
      h1: string;
      h2: string;
      val: (item: any) => any;
    }

    const cols: ColDef[] = [
      { h1: language === 'ar' ? 'كود الصنف' : 'Item Code', h2: '', val: (item) => item.product?.code || '' },
      { h1: language === 'ar' ? 'الصنف' : 'Item Name', h2: '', val: (item) => item.product?.name || '' },
      { h1: language === 'ar' ? 'التاريخ' : 'Date', h2: '', val: (item) => formatDate(item.date) },
      { h1: language === 'ar' ? 'رقم الحركة' : 'Movement No.', h2: '', val: (item) => item.reference_number || '-' },
      { h1: language === 'ar' ? 'رقم القيد' : 'Entry No.', h2: '', val: (item) => item.entry_number || '-' },
      { h1: language === 'ar' ? 'نوع الحركة' : 'Movement Type', h2: '', val: (item) => getMovementTypeLabel(item.movement_type) },
      { h1: language === 'ar' ? 'المخزن' : 'Warehouse', h2: '', val: (item) => item.warehouseName },
      { h1: language === 'ar' ? 'العميل / المورد' : 'Customer/Supplier', h2: '', val: (item) => item.partner },
      { h1: language === 'ar' ? 'الوصف / شرح الحركة' : 'Description', h2: '', val: (item) => item.description },
      { h1: language === 'ar' ? 'الكمية' : 'Quantity', h2: language === 'ar' ? 'وارد (+)' : 'In (+)', val: (item) => item.qtyIn },
      { h1: '', h2: language === 'ar' ? 'منصرف (-)' : 'Out (-)', val: (item) => item.qtyOut },
      { h1: language === 'ar' ? 'سياسة التكلفة' : 'Cost Policy', h2: '', val: (item) => getCostMethodLabel(item.product?.inventory_cost_method) },
      { h1: language === 'ar' ? 'سعر التكلفة' : 'Unit Cost', h2: '', val: (item) => item.unit_cost },
      { h1: language === 'ar' ? 'القيم المالية للمخزون' : 'Financial Values', h2: language === 'ar' ? 'قيمة مدين (+)' : 'Debit (+)', val: (item) => item.debitVal },
      { h1: '', h2: language === 'ar' ? 'قيمة دائن (-)' : 'Credit (-)', val: (item) => item.creditVal },
      { h1: '', h2: language === 'ar' ? 'الرصيد' : 'Balance', val: (item) => item.runningValue }
    ];

    const headers1 = cols.map(c => c.h1);
    const headers2 = cols.map(c => c.h2);
    const mainRows: any[] = [headers1, headers2];

    groupedData.forEach(group => {
      if (groupBy !== 'all') {
        const groupTitleRow = new Array(cols.length).fill('');
        groupTitleRow[0] = group.name;
        mainRows.push(groupTitleRow);
      }

      group.items.forEach(item => {
        const itemRow = cols.map(c => c.val(item));
        mainRows.push(itemRow);
      });

      if (groupBy !== 'all' && group.items.length > 0) {
        const subTotals = getTotals(group.items);
        const subtotalRow = cols.map((c, index) => {
          if (index === 0) return language === 'ar' ? `إجمالي: ${group.name}` : `Total: ${group.name}`;
          if (index < 9) return '';
          if (index === 9) return subTotals.qtyIn;
          if (index === 10) return subTotals.qtyOut;
          if (index === 11 || index === 12) return '';
          if (index === 13) return subTotals.debitVal;
          if (index === 14) return subTotals.creditVal;
          if (index === 15) {
            return group.items[group.items.length - 1].runningValue;
          }
          return '';
        });
        mainRows.push(subtotalRow);
      }
    });

    // Grand totals
    const grandTotalRow = cols.map((c, index) => {
      if (index === 0) return language === 'ar' ? 'الإجمالي العام' : 'Grand Total';
      if (index < 9) return '';
      if (index === 9) return grandTotals.qtyIn;
      if (index === 10) return grandTotals.qtyOut;
      if (index === 11 || index === 12) return '';
      if (index === 13) return grandTotals.debitVal;
      if (index === 14) return grandTotals.creditVal;
      if (index === 15) return '-';
      return '';
    });
    mainRows.push(grandTotalRow);

    // Separator row
    const emptyRow = new Array(cols.length).fill('');

    // GRNI Section
    const grniTitleRow = new Array(cols.length).fill('');
    grniTitleRow[0] = language === 'ar' ? 'إيصالات استلام البضائع غير المفوترة (GRNI)' : 'Goods Receipts Not Invoiced (GRNI)';
    
    const grniHeaders = new Array(cols.length).fill('');
    grniHeaders[0] = language === 'ar' ? 'تاريخ الاستلام' : 'Receipt Date';
    grniHeaders[1] = language === 'ar' ? 'رقم الإذن' : 'Receipt No.';
    grniHeaders[2] = language === 'ar' ? 'المورد' : 'Supplier';
    grniHeaders[3] = language === 'ar' ? 'كود الصنف' : 'Item Code';
    grniHeaders[4] = language === 'ar' ? 'الصنف' : 'Item Name';
    grniHeaders[5] = language === 'ar' ? 'الكمية المستلمة' : 'Received Qty';
    grniHeaders[6] = language === 'ar' ? 'الكمية المفوترة' : 'Billed Qty';
    grniHeaders[7] = language === 'ar' ? 'الكمية المتبقية' : 'Remaining Qty';

    const grniRows = filteredUninvoicedReceipts.map(item => {
      const row = new Array(cols.length).fill('');
      row[0] = item.date?.slice(0, 10);
      row[1] = item.receipt_number;
      row[2] = item.supplier_name || '-';
      row[3] = item.product?.code || '';
      row[4] = item.product?.name || '';
      row[5] = item.quantity;
      row[6] = item.billed_quantity;
      row[7] = item.remaining_quantity;
      return row;
    });

    // Summary Section
    const summaryTitleRow = new Array(cols.length).fill('');
    summaryTitleRow[0] = language === 'ar' ? 'ملخص الرصيد النهائي للمخزون' : 'Final Stock Balance Summary';
    
    const summaryHeaders = new Array(cols.length).fill('');
    summaryHeaders[0] = language === 'ar' ? 'الرصيد المفوتر (المنتهي)' : 'Invoiced Balance';
    summaryHeaders[1] = language === 'ar' ? 'استلامات غير مفوترة' : 'Uninvoiced Receipts';
    summaryHeaders[2] = language === 'ar' ? 'إجمالي الرصيد الفعلي' : 'Total Actual Balance';

    const summaryRow = new Array(cols.length).fill('');
    summaryRow[0] = finalInvoicedQty;
    summaryRow[1] = totalUninvoicedQty;
    summaryRow[2] = totalPhysicalQty;

    const allData = [
      ...mainRows,
      emptyRow,
      grniTitleRow,
      grniHeaders,
      ...grniRows,
      emptyRow,
      summaryTitleRow,
      summaryHeaders,
      summaryRow
    ];

    exportToExcel(allData, {
      filename: `General_Stock_Movements_Report_${dateFrom}_to_${dateTo}`,
      sheetName: language === 'ar' ? 'حركات المخزن' : 'Stock Movements'
    });
  };

  return (
    <div className="space-y-8" dir={dir}>
      {/* Title block */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
            <History size={28} />
          </div>
          <div className="text-right">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-1">
              {language === 'ar' ? 'تقرير حركة المخزن العامة' : 'General Stock Movements Ledger'}
            </h1>
            <p className="text-slate-400 text-sm font-bold">
              {language === 'ar'
                ? 'استعراض حركة وتكلفة كافة الأصناف في المخازن مع خيارات التصفية والفرز والبحث المتقدم'
                : 'Track inventory movements and valuation ledger across all products and warehouses'}
            </p>
          </div>
        </div>
      </div>

      {/* Filters block */}
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
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-sm text-slate-800"
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
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-sm text-slate-800"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          {/* Warehouse */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest px-1">
              {language === 'ar' ? 'المخزن / المستودع' : 'Warehouse'}
            </label>
            <div className="relative">
              <Home className="absolute left-3 top-3.5 text-slate-400" size={16} />
              <select
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-sm text-slate-800 appearance-none"
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

          {/* Item Group */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest px-1">
              {language === 'ar' ? 'مجموعة الأصناف' : 'Item Group'}
            </label>
            <div className="relative">
              <Folder className="absolute left-3 top-3.5 text-slate-400" size={16} />
              <select
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-sm text-slate-800 appearance-none"
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
          {/* Item Type */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest px-1">
              {language === 'ar' ? 'نوع الصنف' : 'Item Type'}
            </label>
            <div className="relative">
              <Layers className="absolute left-3 top-3.5 text-slate-400" size={16} />
              <select
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-sm text-slate-800 appearance-none"
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

          {/* Movement Type */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest px-1">
              {language === 'ar' ? 'نوع الحركة' : 'Movement Type'}
            </label>
            <div className="relative">
              <Sliders className="absolute left-3 top-3.5 text-slate-400" size={16} />
              <select
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-sm text-slate-800 appearance-none"
                value={filterMovementType}
                onChange={(e) => setFilterMovementType(e.target.value)}
              >
                <option value="">{language === 'ar' ? 'جميع الحركات' : 'All Movements'}</option>
                <option value="purchase">{language === 'ar' ? 'فواتير شراء' : 'Purchases'}</option>
                <option value="sale">{language === 'ar' ? 'فواتير بيع' : 'Sales'}</option>
                <option value="sales_return">{language === 'ar' ? 'مردود مبيعات' : 'Sales Returns'}</option>
                <option value="purchase_return">{language === 'ar' ? 'مردود مشتريات' : 'Purchase Returns'}</option>
                <option value="adjustment">{language === 'ar' ? 'تسويات مخزنية' : 'Stock Adjustments'}</option>
                <option value="transfer">{language === 'ar' ? 'تحويلات مخزنية' : 'Warehouse Transfers'}</option>
              </select>
            </div>
          </div>

          {/* Search keyword */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest px-1">
              {language === 'ar' ? 'البحث العام (اسم، كود، مستند)' : 'Search keyword (code, name, ref)'}
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-3.5 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder={language === 'ar' ? 'اكتب للبحث في الأصناف والحركات...' : 'Type to search...'}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-sm text-slate-800 text-right"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Grouping & Printing */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-slate-50 px-6 py-4 rounded-2xl border border-slate-100 flex-wrap gap-4 text-right">
          <div className="flex items-center gap-6 flex-wrap">
            {/* Grouping select */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400">{language === 'ar' ? 'تجميع حسب: ' : 'Group by: '}</span>
              <select
                className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as any)}
              >
                <option value="all">{language === 'ar' ? 'بدون تجميع (مسطح)' : 'No Grouping'}</option>
                <option value="group">{language === 'ar' ? 'مجموعة الأصناف' : 'Item Group'}</option>
                <option value="type">{language === 'ar' ? 'نوع الصنف' : 'Item Type'}</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end">
            <button 
              onClick={loadReportData}
              disabled={loading}
              className="p-2.5 bg-white border border-slate-200 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all flex items-center gap-2 text-xs font-bold shadow-sm"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              <span>{language === 'ar' ? 'تحديث' : 'Refresh'}</span>
            </button>

            <button 
              onClick={handlePrint}
              className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2 text-xs font-bold shadow-sm"
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

      {/* Report Table Display */}
      <div id="movements-printable" ref={printableAreaRef} className="border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm bg-white p-6 md:p-8 space-y-8">
        <div className="text-center mb-8 border-b border-slate-50 pb-6">
          <h2 className="text-2xl font-black text-slate-900 mb-2">
            {language === 'ar' ? 'كارت حركة وتكلفة الأصناف (كل الأصناف)' : 'All Products Movements & Valuation Ledger'}
          </h2>
          <div className="flex justify-center flex-wrap gap-8 text-xs text-slate-400 mt-2 font-bold">
            <p>{language === 'ar' ? 'المخزن:' : 'Warehouse:'} <span className="text-slate-800 font-extrabold">{warehouses.find(w => w.id === selectedWarehouseId)?.name || (language === 'ar' ? 'جميع المخازن' : 'All Warehouses')}</span></p>
            <p>{language === 'ar' ? 'الفترة:' : 'Period:'} <span className="text-slate-800 font-extrabold">{dateFrom || (language === 'ar' ? 'البداية' : 'Start')}</span> {language === 'ar' ? 'إلى' : 'to'} <span className="text-slate-800 font-extrabold">{dateTo}</span></p>
            <p>{language === 'ar' ? 'عدد الحركات:' : 'Movements Count:'} <span className="text-slate-800 font-extrabold">{filteredData.length}</span></p>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="p-16 text-center border-2 border-dashed border-slate-100 rounded-[2.5rem] bg-slate-50/20">
            <Package className="w-14 h-14 text-slate-300 mx-auto mb-4 animate-pulse" />
            <p className="text-slate-400 font-extrabold text-lg">{language === 'ar' ? 'لا توجد حركات مخزنية تطابق الفلاتر المحددة' : 'No movements match the selected filters'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table ref={reportTableRef} className="w-full min-w-[1800px] border-collapse bg-white text-center text-[11px] font-bold">
              <thead className="bg-slate-50 text-[10px] uppercase font-black tracking-wider text-slate-400 border-b border-slate-200">
                {/* Double-header - Row 1 */}
                <tr>
                  <th colSpan={2} className="px-4 py-3 border-r border-slate-200 text-slate-500 font-black">{language === 'ar' ? 'تفاصيل الصنف' : 'Item Details'}</th>
                  <th colSpan={7} className="px-4 py-3 border-r border-slate-200 text-slate-500 font-bold">{language === 'ar' ? 'بيانات الحركة' : 'Movement Details'}</th>
                  <th colSpan={2} className="px-4 py-3 border-r border-slate-200 bg-emerald-50/10 text-emerald-800 font-bold">{language === 'ar' ? 'الكمية' : 'Quantity'}</th>
                  <th colSpan={2} className="px-4 py-3 border-r border-slate-200 text-slate-500 font-bold">{language === 'ar' ? 'سياسة وتكلفة الصنف' : 'Cost Valuation'}</th>
                  <th colSpan={3} className="px-4 py-3 bg-indigo-50/10 text-indigo-800 font-black">{language === 'ar' ? 'القيم المالية للمخزون' : 'Financial Ledger'}</th>
                </tr>
                {/* Double-header - Row 2 */}
                <tr className="border-b border-slate-200 bg-slate-50/30">
                  {/* Item Details */}
                  <th className="px-4 py-2 border-r border-slate-200 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('code')}>
                    {language === 'ar' ? 'كود الصنف' : 'Item Code'} {sortBy === 'code' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="px-5 py-2 border-r border-slate-200 cursor-pointer hover:bg-slate-100 text-right" onClick={() => handleSort('name')}>
                    {language === 'ar' ? 'الصنف' : 'Item Name'} {sortBy === 'name' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  
                  {/* Movement Details */}
                  <th className="px-3 py-2 border-r border-slate-200 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('date')}>
                    {language === 'ar' ? 'التاريخ' : 'Date'} {sortBy === 'date' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="px-4 py-2 border-r border-slate-200">{language === 'ar' ? 'رقم الحركة' : 'Ref Number'}</th>
                  <th className="px-4 py-2 border-r border-slate-200">{language === 'ar' ? 'رقم القيد' : 'Entry No.'}</th>
                  <th className="px-3 py-2 border-r border-slate-200">{language === 'ar' ? 'نوع الحركة' : 'Type'}</th>
                  <th className="px-3 py-2 border-r border-slate-200">{language === 'ar' ? 'المخزن' : 'Warehouse'}</th>
                  <th className="px-4 py-2 border-r border-slate-200 text-right">{language === 'ar' ? 'العميل / المورد' : 'Customer/Supplier'}</th>
                  <th className="px-5 py-2 border-r border-slate-200 text-right">{language === 'ar' ? 'الوصف / شرح الحركة' : 'Description'}</th>
                  
                  {/* Quantity */}
                  <th className="px-3 py-2 border-r border-slate-200 bg-emerald-50/5 text-emerald-600 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('qtyIn')}>
                    {language === 'ar' ? 'وارد (+)' : 'In (+)'} {sortBy === 'qtyIn' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="px-3 py-2 border-r border-slate-200 bg-emerald-50/5 text-rose-600 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('qtyOut')}>
                    {language === 'ar' ? 'منصرف (-)' : 'Out (-)'} {sortBy === 'qtyOut' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  
                  {/* Policy & Valuation */}
                  <th className="px-3 py-2 border-r border-slate-200">{language === 'ar' ? 'سياسة التكلفة' : 'Cost Policy'}</th>
                  <th className="px-3 py-2 border-r border-slate-200">{language === 'ar' ? 'سعر التكلفة' : 'Unit Cost'}</th>

                  {/* Financial Values */}
                  <th className="px-3 py-2 border-r border-slate-200 bg-indigo-50/5 text-indigo-600 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('debitVal')}>
                    {language === 'ar' ? 'قيمة مدين (+)' : 'Debit (+)'} {sortBy === 'debitVal' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="px-3 py-2 border-r border-slate-200 bg-indigo-50/5 text-rose-600 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('creditVal')}>
                    {language === 'ar' ? 'قيمة دائن (-)' : 'Credit (-)'} {sortBy === 'creditVal' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="px-3 py-2 bg-indigo-50/10 text-indigo-900 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('runningValue')}>
                    {language === 'ar' ? 'الرصيد' : 'Value Balance'} {sortBy === 'runningValue' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {groupedData.map(group => (
                  <React.Fragment key={group.id}>
                    {/* Render Group Header */}
                    {groupBy !== 'all' && (
                      <tr className="bg-slate-50/80 font-black text-slate-900 text-right">
                        <td colSpan={16} className="px-6 py-3 font-extrabold text-sm border-y border-slate-200 text-indigo-900">
                          {groupBy === 'group' ? (language === 'ar' ? 'مجموعة: ' : 'Group: ') : (language === 'ar' ? 'نوع: ' : 'Type: ')}
                          {group.name}
                        </td>
                      </tr>
                    )}

                    {/* Render Group Items */}
                    {group.items.map((item: any, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-50/30 transition-colors">
                        {/* Item details */}
                        <td 
                          className="px-4 py-3.5 border-r border-slate-200 font-mono text-[10px] whitespace-nowrap text-indigo-600 hover:text-indigo-900 cursor-pointer hover:underline"
                          onClick={() => handleProductCodeClick(item.product.id)}
                          title={language === 'ar' ? 'عرض كارت كرت الصنف' : 'View stock card'}
                        >
                          {item.product.code}
                        </td>
                        <td className="px-5 py-3.5 border-r border-slate-200 text-slate-900 font-bold text-right whitespace-nowrap">{item.product.name}</td>
                        
                        {/* Movement details */}
                        <td className="px-3 py-3.5 border-r border-slate-200 font-mono text-[10px] text-slate-500 whitespace-nowrap">{formatDate(item.date)}</td>
                        <td 
                          className="px-4 py-3.5 border-r border-slate-200 font-mono text-[10px] text-indigo-600 hover:text-indigo-900 cursor-pointer hover:underline whitespace-nowrap"
                          onClick={() => handleMovementClick(item)}
                          title={language === 'ar' ? 'انتقال وتفاصيل مستند الحركة' : 'Click to view transaction'}
                        >
                          {item.reference_number || '-'}
                        </td>
                        <td 
                          className="px-4 py-3.5 border-r border-slate-200 font-mono text-[10px] text-indigo-600 hover:text-indigo-900 cursor-pointer hover:underline whitespace-nowrap"
                          onClick={() => handleJournalEntryClick(item.entry_number)}
                          title={language === 'ar' ? 'انتقال وتفاصيل قيد اليومية' : 'Click to view journal entry'}
                        >
                          {item.entry_number || '-'}
                        </td>
                        <td className="px-3 py-3.5 border-r border-slate-200 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${getMovementTypePillColor(item.movement_type)}`}>
                            {getMovementTypeLabel(item.movement_type)}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 border-r border-slate-200 whitespace-nowrap">{item.warehouseName}</td>
                        <td className="px-4 py-3.5 border-r border-slate-200 text-right whitespace-nowrap">{item.partner}</td>
                        <td className="px-5 py-3.5 border-r border-slate-200 text-right text-[10px] text-slate-500 whitespace-normal min-w-[150px] max-w-[250px]">{item.description}</td>
                        
                        {/* Quantity */}
                        <td className="px-3 py-3.5 border-r border-slate-200 bg-emerald-50/5 font-mono text-emerald-700">{item.qtyIn !== 0 ? formatNumber(item.qtyIn) : '-'}</td>
                        <td className="px-3 py-3.5 border-r border-slate-200 bg-emerald-50/5 font-mono text-rose-600">{item.qtyOut !== 0 ? formatNumber(item.qtyOut) : '-'}</td>

                        {/* Valuation */}
                        <td className="px-3 py-3.5 border-r border-slate-200 text-[10px] text-slate-500 whitespace-nowrap">{getCostMethodLabel(item.product?.inventory_cost_method)}</td>
                        <td className="px-3 py-3.5 border-r border-slate-200 font-mono text-slate-600">{item.unit_cost !== 0 ? formatNumber(item.unit_cost) : '-'}</td>

                        {/* Financial Ledger */}
                        <td className="px-3 py-3.5 border-r border-slate-200 bg-indigo-50/5 font-mono text-slate-800">{item.debitVal !== 0 ? formatNumber(item.debitVal) : '-'}</td>
                        <td className="px-3 py-3.5 border-r border-slate-200 bg-indigo-50/5 font-mono text-rose-600">{item.creditVal !== 0 ? formatNumber(item.creditVal) : '-'}</td>
                        <td className="px-3 py-3.5 bg-indigo-50/20 font-mono text-indigo-900 font-black">{formatNumber(item.runningValue)}</td>
                      </tr>
                    ))}

                    {/* Render Group Subtotals */}
                    {groupBy !== 'all' && group.items.length > 0 && (() => {
                      const subTotals = getTotals(group.items);
                      return (
                        <tr className="bg-slate-100/50 font-black text-slate-900 text-xs border-t border-slate-200">
                          <td colSpan={9} className="px-6 py-3 font-extrabold text-indigo-950 text-right">
                            {language === 'ar' ? `إجمالي: ${group.name}` : `Total: ${group.name}`}
                          </td>
                          <td className="px-3 py-3 font-mono text-emerald-700">{subTotals.qtyIn !== 0 ? formatNumber(subTotals.qtyIn) : '-'}</td>
                          <td className="px-3 py-3 font-mono text-rose-600">{subTotals.qtyOut !== 0 ? formatNumber(subTotals.qtyOut) : '-'}</td>
                          <td colSpan={2} className="border-r border-slate-200"></td>
                          <td className="px-3 py-3 font-mono text-indigo-800">{subTotals.debitVal !== 0 ? formatNumber(subTotals.debitVal) : '-'}</td>
                          <td className="px-3 py-3 font-mono text-rose-600">{subTotals.creditVal !== 0 ? formatNumber(subTotals.creditVal) : '-'}</td>
                          <td className="px-3 py-3 font-mono text-indigo-900 bg-indigo-50/20 font-black">
                            {formatNumber(group.items[group.items.length - 1].runningValue)}
                          </td>
                        </tr>
                      );
                    })()}
                  </React.Fragment>
                ))}

                {/* Grand Total Footer */}
                <tr className="bg-zinc-900 text-white font-black text-xs border-t-2 border-zinc-950">
                  <td colSpan={9} className="px-6 py-4 text-right text-sm">
                    {language === 'ar' ? 'الإجمالي العام للمخزن' : 'Stock Grand Total'}
                  </td>
                  <td className="px-3 py-4 font-mono text-emerald-400">{grandTotals.qtyIn !== 0 ? formatNumber(grandTotals.qtyIn) : '-'}</td>
                  <td className="px-3 py-4 font-mono text-rose-400">{grandTotals.qtyOut !== 0 ? formatNumber(grandTotals.qtyOut) : '-'}</td>
                  <td colSpan={2} className="border-r border-zinc-800"></td>
                  <td className="px-3 py-4 font-mono text-indigo-300">{grandTotals.debitVal !== 0 ? formatNumber(grandTotals.debitVal) : '-'}</td>
                  <td className="px-3 py-4 font-mono text-rose-300">{grandTotals.creditVal !== 0 ? formatNumber(grandTotals.creditVal) : '-'}</td>
                  <td className="px-3 py-4 font-mono bg-zinc-800 text-zinc-100 font-extrabold">-</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Table 2: Goods Receipts Not Invoiced (GRNI) */}
        {!loading && filteredData.length > 0 && (
          <div className="pt-6 border-t border-slate-100">
            <div className="text-right mb-4">
              <h4 className="text-lg font-black text-slate-800">
                {language === 'ar' ? 'إيصالات استلام البضائع غير المفوترة (GRNI)' : 'Goods Receipts Not Invoiced (GRNI)'}
              </h4>
              <p className="text-slate-400 text-xs font-bold mt-1">
                {language === 'ar' 
                  ? 'الاستلامات المخزنية الموثقة لكافة الأصناف التي لم تصدر لها فواتير شراء بعد (أو المتبقي منها)' 
                  : 'Posted goods receipts for all products that have not been fully invoiced yet'}
              </p>
            </div>

            {filteredUninvoicedReceipts.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-100 rounded-2xl bg-slate-50/20">
                <p className="text-slate-400 font-bold text-xs">
                  {language === 'ar' ? 'لا توجد إيصالات استلام غير مفوترة تطابق الفلاتر المحددة' : 'No uninvoiced goods receipts match the selected filters'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full min-w-[1200px] border-collapse bg-white text-center text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase font-black tracking-widest text-slate-400 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 border-r border-slate-200 whitespace-nowrap">{language === 'ar' ? 'تاريخ الاستلام' : 'Receipt Date'}</th>
                      <th className="px-4 py-3 border-r border-slate-200 whitespace-nowrap">{language === 'ar' ? 'رقم الإذن' : 'Receipt No.'}</th>
                      <th className="px-5 py-3 border-r border-slate-200 whitespace-nowrap">{language === 'ar' ? 'المورد' : 'Supplier'}</th>
                      <th className="px-4 py-3 border-r border-slate-200 whitespace-nowrap">{language === 'ar' ? 'كود الصنف' : 'Item Code'}</th>
                      <th className="px-5 py-3 border-r border-slate-200 text-right">{language === 'ar' ? 'الصنف' : 'Item Name'}</th>
                      <th className="px-3 py-3 border-r border-slate-200 bg-emerald-50/20 text-emerald-800 font-bold whitespace-nowrap">{language === 'ar' ? 'الكمية المستلمة' : 'Received Qty'}</th>
                      <th className="px-3 py-3 border-r border-slate-200 bg-blue-50/20 text-blue-800 font-bold whitespace-nowrap">{language === 'ar' ? 'الكمية المفوترة' : 'Billed Qty'}</th>
                      <th className="px-3 py-3 bg-amber-50/20 text-amber-800 font-black whitespace-nowrap">{language === 'ar' ? 'الكمية المتبقية' : 'Remaining Qty'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-bold">
                    {filteredUninvoicedReceipts.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-4 border-r border-slate-200 font-mono whitespace-nowrap">{item.date?.slice(0, 10)}</td>
                        <td className="px-4 py-4 border-r border-slate-200 font-mono text-slate-500 whitespace-nowrap">{item.receipt_number}</td>
                        <td className="px-5 py-4 border-r border-slate-200 text-slate-800 font-black whitespace-nowrap">{item.supplier_name || '-'}</td>
                        <td className="px-4 py-4 border-r border-slate-200 font-mono text-indigo-600 cursor-pointer hover:underline" onClick={() => handleProductCodeClick(item.product.id)}>{item.product?.code}</td>
                        <td className="px-5 py-4 border-r border-slate-200 text-right text-slate-900 font-bold whitespace-nowrap">{item.product?.name}</td>
                        <td className="px-3 py-4 border-r border-slate-200 bg-emerald-50/5 font-mono text-slate-800">{formatNumber(item.quantity)}</td>
                        <td className="px-3 py-4 border-r border-slate-200 bg-blue-50/5 font-mono text-slate-800">{formatNumber(item.billed_quantity)}</td>
                        <td className="px-3 py-4 bg-amber-50/10 font-black font-mono text-amber-700">{formatNumber(item.remaining_quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Section 3: Final Inventory Balance (الرصيد النهائي) */}
        {!loading && filteredData.length > 0 && (
          <div className="pt-6 border-t border-slate-100">
            <div className="text-right mb-4">
              <h4 className="text-lg font-black text-slate-800">
                {language === 'ar' ? 'ملخص الرصيد النهائي للمخزون' : 'Final Stock Balance Summary'}
              </h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-3xl border border-slate-100">
              {/* 1. Invoiced stock */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm text-right space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400">{language === 'ar' ? 'الرصيد المفوتر (المنتهي)' : 'Invoiced Balance'}</span>
                  <span className="w-2.5 h-2.5 bg-blue-500 rounded-full"></span>
                </div>
                <div className="text-2xl font-black text-slate-800 font-mono">
                  {formatNumber(finalInvoicedQty)} <span className="text-xs text-slate-400 font-bold">{language === 'ar' ? 'وحدة' : 'units'}</span>
                </div>
              </div>

              {/* 2. Uninvoiced stock */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm text-right space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400">{language === 'ar' ? 'استلامات غير مفوترة' : 'Uninvoiced Receipts'}</span>
                  <span className="w-2.5 h-2.5 bg-amber-500 rounded-full"></span>
                </div>
                <div className="text-2xl font-black text-slate-800 font-mono">
                  {formatNumber(totalUninvoicedQty)} <span className="text-xs text-slate-400 font-bold">{language === 'ar' ? 'وحدة' : 'units'}</span>
                </div>
              </div>

              {/* 3. Net Physical stock */}
              <div className="bg-emerald-600 p-5 rounded-2xl shadow-sm text-right text-white space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-emerald-100">{language === 'ar' ? 'إجمالي الرصيد الفعلي' : 'Total Actual Balance'}</span>
                  <span className="w-2.5 h-2.5 bg-white rounded-full"></span>
                </div>
                <div className="text-2xl font-black font-mono">
                  {formatNumber(totalPhysicalQty)} <span className="text-xs text-emerald-100 font-bold">{language === 'ar' ? 'وحدة' : 'units'}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
