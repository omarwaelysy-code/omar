import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Plus, Trash2, X, Package, History, ChevronRight, ChevronLeft, 
  Wallet, Layers, Hash, User, Calendar, Paperclip, LayoutGrid, List,
  Lock, Camera, Printer, Download, FileText, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Barcode from 'react-barcode';
import { toast } from 'react-hot-toast';
import { dbService } from '../services/dbService';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { usePermissions } from '../hooks/usePermissions';
import { useViewPreference } from '../hooks/useViewPreference';
import { Product, Account, Company } from '../types';
import { PaginationControls } from '../components/PaginationControls';
import { ExportButtons } from '../components/ExportButtons';
import { PageActivityLog } from '../components/PageActivityLog';
import { InlineActivityLog } from '../components/InlineActivityLog';
import { exportToExcel, formatDataForExcel } from '../utils/excelUtils';
import { exportToPDF as exportToPDFUtil } from '../utils/pdfUtils';
import { formatNumber } from '../utils/formatUtils';

interface ItemGroup {
  id: string;
  company_id: string;
  name: string;
  code: string;
  type: string;
}

export const Products: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { showNotification } = useNotification();
  const { canView, canCreate, canDelete } = usePermissions('products');
  
  const [products, setProducts] = useState<Product[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [itemGroups, setItemGroups] = useState<ItemGroup[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [view, setView] = useViewPreference('products', 'table');
  const [isAutoCode, setIsAutoCode] = useState(true);
  
  // Stock Movement & Cost Ledger States
  const [movements, setMovements] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [docMap, setDocMap] = useState<Record<string, { partner: string, description: string }>>({});
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterRefNum, setFilterRefNum] = useState('');
  const [filterPartner, setFilterPartner] = useState('');
  
  const tableRef = useRef<HTMLTableElement>(null);
  const isVatEnabled = company?.settings?.vat_enabled || company?.vat_enabled || false;

  const [formData, setFormData] = useState({ 
    code: '', 
    name: '', 
    type: 'finished_good' as 'service' | 'finished_good' | 'raw_material' | 'commodity',
    category: '',
    unit: 'قطعة',
    sale_price: 0, 
    cost_price: 0, 
    description: '',
    image_url: '',
    barcode: '',
    stock: 0,
    min_stock: 0,
    revenue_account_id: '',
    cost_account_id: '',
    inventory_account_id: '',
    inventory_cost_method: 'wac',
    vat_account_id: '',
    vat_rate: 0,
    counter_account_id: '',
    item_group_id: ''
  });

  useEffect(() => {
    if (user) {
      const unsubscribe = dbService.subscribe<Product>('products', user.company_id, (data) => {
        setProducts(data);
        setLoading(false);
      });

      const unsubscribeAccounts = dbService.subscribe<Account>('accounts', user.company_id, (data) => {
        setAccounts(data);
      });

      const unsubscribeItemGroups = dbService.subscribe<ItemGroup>('item_groups', user.company_id, (data) => {
        setItemGroups(data || []);
      });

      const unsubscribeCompany = dbService.listen<Company>('companies', user.company_id, (compData) => {
        setCompany(compData);
      });

      return () => {
        unsubscribe();
        unsubscribeAccounts();
        unsubscribeItemGroups();
        unsubscribeCompany();
      };
    }
  }, [user]);

  useEffect(() => {
    if (!editingProduct && formData.type && isModalOpen && isAutoCode) {
      const prefixMap: Record<string, string> = {
        'service': 'SRV',
        'finished_good': 'FG',
        'raw_material': 'RM',
        'commodity': 'CMD'
      };
      
      const prefix = prefixMap[formData.type] || 'PRD';
      const typeProducts = products.filter(p => p.type === formData.type);
      
      let maxNum = 0;
      typeProducts.forEach(p => {
        const parts = p.code?.split('-');
        if (parts && parts.length > 1) {
          const num = parseInt(parts[1]);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        } else if (p.code?.startsWith(prefix)) {
          const numStr = p.code.substring(prefix.length);
          const num = parseInt(numStr);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      });
      
      const nextNum = (maxNum + 1).toString().padStart(4, '0');
      const newCode = `${prefix}-${nextNum}`;
      
      if (formData.code !== newCode) {
        setFormData(prev => ({ ...prev, code: newCode }));
      }
    }
  }, [formData.type, editingProduct, isModalOpen, products, isAutoCode]);

  // Dedicated Stock Card Report states
  const [reportProduct, setReportProduct] = useState<Product | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const reportTableRef = useRef<HTMLTableElement>(null);

  const loadMovementData = async () => {
    const targetProduct = reportProduct || editingProduct;
    if (!user || !targetProduct) return;
    setLoadingMovements(true);
    try {
      const whs = await dbService.list<any>('warehouses', { company_id: user.company_id });
      setWarehouses(whs || []);

      const mvs = await dbService.list<any>('inventory_movements', { 
        company_id: user.company_id,
        product_id: targetProduct.id 
      });

      const [invs, pinvs, rets, prets] = await Promise.all([
        dbService.list<any>('invoices', { company_id: user.company_id }),
        dbService.list<any>('purchase_invoices', { company_id: user.company_id }),
        dbService.list<any>('returns', { company_id: user.company_id }),
        dbService.list<any>('purchase_returns', { company_id: user.company_id })
      ]);

      const map: Record<string, { partner: string, description: string }> = {};
      (invs || []).forEach(x => {
        map[x.id] = { 
          partner: x.customer_name || t('common.customer') || 'عميل', 
          description: x.description || '' 
        };
      });
      (pinvs || []).forEach(x => {
        map[x.id] = { 
          partner: x.supplier_name || t('common.supplier') || 'مورد', 
          description: x.description || '' 
        };
      });
      (rets || []).forEach(x => {
        map[x.id] = { 
          partner: x.customer_name || t('common.customer') || 'عميل', 
          description: x.description || '' 
        };
      });
      (prets || []).forEach(x => {
        map[x.id] = { 
          partner: x.supplier_name || t('common.supplier') || 'مورد', 
          description: x.description || '' 
        };
      });

      setDocMap(map);
      setMovements(mvs || []);
    } catch (e) {
      console.error("Failed to load product movements", e);
    } finally {
      setLoadingMovements(false);
    }
  };

  useEffect(() => {
    if (user && (reportProduct || editingProduct)) {
      loadMovementData();
    } else {
      setMovements([]);
    }
  }, [user, reportProduct, editingProduct]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          if (width > height) {
            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
          } else {
            if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          setFormData({ ...formData, image_url: canvas.toDataURL('image/jpeg', 0.7) });
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      if (!formData.item_group_id) {
        toast.error(language === 'ar' ? 'الرجاء اختيار مجموعة للصنف' : 'Please select an item group for the product');
        return;
      }

      if (!formData.revenue_account_id || !formData.cost_account_id) {
        toast.error('يجب اختيار حساب الإيرادات وحساب التكلفة للصنف');
        return;
      }

      const isPhysicalProduct = ['finished_good', 'raw_material', 'commodity'].includes(formData.type);
      if (isPhysicalProduct && !formData.inventory_account_id) {
        toast.error(language === 'ar' ? 'الرجاء اختيار حساب المخزون للصنف' : 'Please select the inventory account for the product');
        return;
      }

      const revenueAccount = accounts.find(a => a.id === formData.revenue_account_id);
      const costAccount = accounts.find(a => a.id === formData.cost_account_id);
      const inventoryAccount = accounts.find(a => a.id === formData.inventory_account_id);
      const vatAccount = accounts.find(a => a.id === formData.vat_account_id);
      const itemGroupObj = itemGroups.find(g => g.id === formData.item_group_id);
      
      const dataToSave = {
        ...formData,
        item_group_name: itemGroupObj?.name || '',
        revenue_account_name: revenueAccount?.name || '',
        cost_account_name: costAccount?.name || '',
        inventory_account_name: inventoryAccount?.name || '',
        vat_account_name: vatAccount?.name || ''
      };

      if (editingProduct) {
        await dbService.update('products', editingProduct.id, dataToSave);
        toast.success(t('common.updated_successfully'));
      } else {
        await dbService.add('products', { ...dataToSave, company_id: user.company_id });
        toast.success(t('common.created_successfully'));
      }
      setIsModalOpen(false);
      resetForm();
    } catch (e) {
      toast.error('حدث خطأ أثناء حفظ البيانات');
    }
  };

  const resetForm = () => {
    setEditingProduct(null);
    setFormData({ 
      code: '', name: '', type: 'finished_good', category: '', unit: 'قطعة',
      sale_price: 0, cost_price: 0, description: '', image_url: '', 
      barcode: '', stock: 0, min_stock: 0, revenue_account_id: '', 
      cost_account_id: '', inventory_account_id: '', inventory_cost_method: 'wac', vat_account_id: '',
      vat_rate: 0, counter_account_id: '', item_group_id: ''
    });
    setDateFrom('');
    setDateTo('');
    setFilterType('');
    setFilterRefNum('');
    setFilterPartner('');
  };

  const openModal = (product: Product | null = null) => {
    if (product) {
      setEditingProduct(product);
      setIsAutoCode(false);
      setFormData({ 
        ...product,
        type: (product.type as any) === 'product' ? 'finished_good' : product.type,
        category: product.category || '',
        unit: product.unit || 'قطعة',
        description: product.description || '',
        image_url: product.image_url || '',
        barcode: product.barcode || '',
        revenue_account_id: product.revenue_account_id || '',
        cost_account_id: product.cost_account_id || '',
        inventory_account_id: product.inventory_account_id || '',
        inventory_cost_method: product.inventory_cost_method || 'wac',
        vat_account_id: product.vat_account_id || '',
        vat_rate: product.vat_rate || 0,
        counter_account_id: product.counter_account_id || '',
        item_group_id: product.item_group_id || ''
      } as any);
    } else {
      resetForm();
      setIsAutoCode(true);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleExportExcel = () => {
    const headers = { 'code': t('products.column_code'), 'name': t('products.column_name'), 'barcode': t('products.form_barcode'), 'sale_price': t('products.column_sale_price'), 'cost_price': t('products.column_cost_price') };
    exportToExcel(formatDataForExcel(products, headers), { filename: 'Products_Inventory', sheetName: t('products.title') });
  };

  const handleExportPDF = async () => { if (tableRef.current) await exportToPDFUtil(tableRef.current, { filename: 'Products_Inventory', reportTitle: t('products.list_title') }); };

  const handleExportStockCardExcel = () => {
    if (!reportProduct) return;
    const headers = language === 'ar' ? [
      'التاريخ', 'رقم الحركة', 'نوع الحركة', 'المخزن', 'العميل / المورد', 'الوصف', 
      'الوارد (+)', 'المصرف (-)', 'رصيد الكمية', 
      'سياسة التكلفة', 'تكلفة الوحدة', 
      'قيمة مدين (+)', 'قيمة دائن (-)', 'رصيد القيمة'
    ] : [
      'Date', 'Ref Number', 'Movement Type', 'Warehouse', 'Customer/Supplier', 'Description', 
      'In Quantity (+)', 'Out Quantity (-)', 'Running Qty', 
      'Cost Policy', 'Unit Cost', 
      'Debit Value (+)', 'Credit Value (-)', 'Running Balance Value'
    ];

    const data = filteredMovements.map(m => [
      m.date.slice(0, 10),
      m.reference_number || '',
      getMovementTypeLabel(m.movement_type),
      m.warehouseName || '',
      m.partner || '',
      m.description || '',
      m.qtyIn || 0,
      m.qtyOut || 0,
      m.runningQty || 0,
      getCostMethodLabel(reportProduct.inventory_cost_method || 'wac'),
      m.unit_cost || 0,
      m.debitVal || 0,
      m.creditVal || 0,
      m.runningValue || 0
    ]);

    exportToExcel([headers, ...data], { 
      filename: `Stock_Card_${reportProduct.name}_${new Date().toISOString().slice(0, 10)}`,
      sheetName: language === 'ar' ? 'كارت الصنف' : 'Stock Card' 
    });
  };

  const handleExportStockCardPDF = async () => {
    if (reportTableRef.current && reportProduct) {
      await exportToPDFUtil(reportTableRef.current, {
        filename: `Stock_Card_${reportProduct.name}`,
        reportTitle: language === 'ar' 
          ? `كارت حركة وتكلفة الصنف: ${reportProduct.name} (${reportProduct.code})` 
          : `Stock Card: ${reportProduct.name} (${reportProduct.code})`
      });
    }
  };

  const handlePrintStockCard = () => {
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        body * {
          visibility: hidden !important;
        }
        #stock-card-report-area, #stock-card-report-area * {
          visibility: visible !important;
        }
        #stock-card-report-area {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          padding: 0 !important;
          margin: 0 !important;
          box-shadow: none !important;
          border: none !important;
        }
        .no-print {
          display: none !important;
        }
      }
    `;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => document.head.removeChild(style), 1000);
  };

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
      default: return method?.toUpperCase();
    }
  };

  const sortedMovements = [...movements].sort((a, b) => {
    const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (dateDiff !== 0) return dateDiff;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  let runningQty = 0;
  let runningValue = 0;

  const movementsWithBalances = sortedMovements.map(m => {
    const qty = parseFloat(m.quantity || '0');
    const cost = parseFloat(m.unit_cost || '0');
    const totalCost = parseFloat(m.total_cost || '0');
    
    // Inflow is positive, Outflow is negative
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
      warehouseName: whName
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

  const filteredProducts = products.filter(p => (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (p.code || '').toLowerCase().includes(searchTerm.toLowerCase()));

  if (!canView) return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-zinc-500 gap-4">
      <Lock className="w-10 h-10" />
      <h3 className="text-xl font-bold">عذراً، ليس لديك صلاحية للوصول إلى هذه الصفحة</h3>
    </div>
  );

  return (
    <div className="h-full flex flex-col space-y-8 animate-in fade-in duration-700 overflow-hidden" dir={dir}>
      <AnimatePresence mode="wait">
        {!isModalOpen ? (
          <motion.div 
            key="list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex flex-col space-y-8 overflow-hidden max-w-7xl mx-auto w-full p-4"
          >
            {/* Header - Styled like Discount Settings */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 pb-6 border-b border-slate-100">
              <div className={dir === 'rtl' ? 'text-right' : 'text-left'}>
                <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter mb-3 leading-none italic serif">
                  {t('products.title')}
                </h1>
                <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-xs">
                  {t('products.subtitle') || 'إدارة المخزن والسلع والخدمات'}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <button onClick={() => setIsActivityLogOpen(true)} className="w-14 h-14 bg-white text-slate-400 border border-slate-100 rounded-2xl flex items-center justify-center shadow-sm hover:text-emerald-600 hover:border-emerald-100 transition-all active:scale-95">
                  <History size={24} />
                </button>
                <ExportButtons onExportExcel={handleExportExcel} onExportPDF={handleExportPDF} />
                {canCreate && (
                  <button 
                    onClick={() => openModal()}
                    className="group relative px-8 py-4 bg-zinc-900 text-white rounded-[1.5rem] shadow-xl overflow-hidden transition-all hover:bg-zinc-800 active:scale-95"
                  >
                    <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative z-10 flex items-center gap-3 font-black uppercase tracking-widest text-sm">
                      <Plus size={20} className="group-hover:rotate-90 transition-transform" />
                      {t('products.add')}
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* List Control */}
            <div className="flex-1 bg-white rounded-[3.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden flex flex-col transition-all duration-500">
              <div className="p-8 border-b border-slate-50 flex items-center gap-4 bg-slate-50/20">
                <div className="relative flex-1 group">
                  <Search className={`absolute ${dir === 'rtl' ? 'right-6' : 'left-6'} top-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors pointer-events-none`} size={24} />
                  <input
                    type="text"
                    placeholder={t('products.search_placeholder')}
                    className={`w-full ${dir === 'rtl' ? 'pr-16 pl-6' : 'pl-16 pr-6'} py-4 bg-white border border-slate-100 rounded-[2rem] outline-none font-bold text-slate-900 placeholder:text-slate-300 focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500/50 transition-all shadow-inner`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm">
                  <button onClick={() => setView('table')} className={`p-2.5 rounded-xl transition-all ${view === 'table' ? 'bg-zinc-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}><List size={22} /></button>
                  <button onClick={() => setView('card')} className={`p-2.5 rounded-xl transition-all ${view === 'card' ? 'bg-zinc-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}><LayoutGrid size={22} /></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {view === 'table' ? (
                  <div className="overflow-x-auto h-full p-8">
                    <table ref={tableRef} className="w-full">
                      <thead className="bg-slate-50/50 rounded-2xl">
                        <tr className="text-slate-400 text-[10px] uppercase font-black tracking-[0.2em]">
                          <th className={`px-8 py-6 rounded-s-2xl ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('products.column_code')}</th>
                          <th className={`px-8 py-6 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('products.column_name')}</th>
                          <th className={`px-8 py-6 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('products.column_sale_price')}</th>
                          <th className={`px-8 py-6 rounded-e-2xl ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>{t('invoices.column_actions')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {loading ? (
                          <tr><td colSpan={4} className="py-20 text-center"><div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div></td></tr>
                        ) : filteredProducts.map((product) => (
                          <tr 
                            key={product.id} 
                            onClick={() => openModal(product)}
                            className="hover:bg-slate-50 transition-all group cursor-pointer"
                          >
                            <td className={`px-8 py-5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                              <span className="font-mono text-[10px] bg-slate-100 px-3 py-1 rounded-lg text-slate-500 font-black border border-slate-200 group-hover:border-emerald-200 transition-all">{product.code}</span>
                            </td>
                            <td className={`px-8 py-5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                               <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center overflow-hidden border border-slate-200">
                                    {product.image_url ? <img src={product.image_url} alt="" className="w-full h-full object-cover" /> : <Package size={20} />}
                                  </div>
                                  <div className="flex flex-col">
                                     <span className="font-black text-slate-900 group-hover:text-emerald-700 transition-colors">{product.name}</span>
                                     <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{t(`products.type_${product.type}`)}</span>
                                  </div>
                               </div>
                            </td>
                            <td className={`px-8 py-5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                              <span className="font-black text-emerald-600 text-lg">{formatNumber(product.sale_price || 0)} <span className="text-[10px] text-slate-400 italic ms-1">{t('invoices.currency')}</span></span>
                            </td>
                            <td className={`px-8 py-5 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>
                               <div className={`flex items-center ${dir === 'rtl' ? 'justify-start' : 'justify-end'} gap-1 opacity-0 group-hover:opacity-100 transition-all`}>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setReportProduct(product);
                                      setIsReportOpen(true);
                                    }} 
                                    className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"
                                    title={language === 'ar' ? 'تقرير حركة وتكلفة الصنف (كارت الصنف)' : 'Product stock card report'}
                                  >
                                    <History size={18} />
                                  </button>
                                  {canDelete && (
                                    <button onClick={async (e) => { 
                                      e.stopPropagation(); 
                                      if (window.confirm(t('common.confirm_delete'))) {
                                        try {
                                          await dbService.delete('products', product.id);
                                          toast.success(t('common.deleted_successfully'));
                                        } catch (err: any) {
                                          toast.error(err.message || 'Error deleting');
                                        }
                                      }
                                    }} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={18} /></button>
                                  )}
                                  <div className="p-2 text-emerald-400 bg-white rounded-xl shadow-sm border border-slate-100">{dir === 'rtl' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}</div>
                               </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-10 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                    {filteredProducts.map((product) => (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ y: -5 }}
                        key={product.id} 
                        onClick={() => openModal(product)} 
                        className="p-8 space-y-6 rounded-[3rem] border bg-white border-slate-100 hover:border-emerald-200 hover:shadow-2xl transition-all cursor-pointer group relative overflow-hidden"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex flex-col gap-2 text-right">
                            <span className="font-mono text-[10px] bg-slate-50 px-3 py-1 rounded-lg text-slate-400 font-black w-fit border border-slate-100 uppercase tracking-widest">{product.code}</span>
                            <h4 className="font-black text-slate-900 group-hover:text-emerald-700 transition-colors text-2xl tracking-tighter leading-none italic serif">{product.name}</h4>
                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none">{t(`products.type_${product.type}`)}</span>
                          </div>
                          <div className="w-20 h-20 rounded-[2rem] bg-slate-50 text-slate-300 flex items-center justify-center overflow-hidden border border-slate-100 group-hover:scale-105 transition-all shadow-inner">
                             {product.image_url ? <img src={product.image_url} alt="" className="w-full h-full object-cover" /> : <Package size={32} />}
                          </div>
                        </div>
                        <div className="pt-6 border-t border-slate-50 flex justify-between items-end">
                          <div className="text-right">
                            <p className="text-slate-400 text-[10px] uppercase font-black tracking-[0.2em] mb-2">{t('products.column_sale_price')}</p>
                            <p className="font-black text-3xl tracking-tighter leading-none text-emerald-600">{formatNumber(product.sale_price || 0)} <span className="text-xs font-normal text-slate-300 italic serif">{t('invoices.currency')}</span></p>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setReportProduct(product);
                                setIsReportOpen(true);
                              }} 
                              className="p-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-400 hover:bg-emerald-50 hover:text-emerald-500 transition-all"
                              title={language === 'ar' ? 'تقرير حركة وتكلفة الصنف (كارت الصنف)' : 'Product stock card report'}
                            >
                              <History size={20} />
                            </button>
                            <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-300 group-hover:bg-emerald-600 group-hover:text-white transition-all">{dir === 'rtl' ? <ChevronLeft size={24} /> : <ChevronRight size={24} />}</div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-8 border-t border-slate-50 bg-white sticky bottom-0">
                <PaginationControls page={1} limit={100} total={filteredProducts.length} onPageChange={() => {}} onLimitChange={() => {}} />
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex flex-col space-y-8 overflow-hidden max-w-7xl mx-auto w-full p-4"
          >
            <div className="bg-white flex-1 rounded-[3.5rem] shadow-xl shadow-slate-200/40 flex flex-col md:flex-row overflow-hidden border border-slate-100 transition-all duration-500">
              <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
                {/* Header */}
                <div className="p-10 border-b border-slate-50 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-20">
                  <div className={`flex items-center gap-6 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                    <div className="w-16 h-16 bg-emerald-600 text-white rounded-[2rem] flex items-center justify-center shadow-xl shadow-emerald-500/20">
                       <Package size={32} />
                    </div>
                    <div className={dir === 'rtl' ? 'text-right' : 'text-left'}>
                       <h3 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-1 font-serif italic">
                         {editingProduct ? t('products.edit') : t('products.add')}
                       </h3>
                       <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] leading-none">{editingProduct?.code || 'SYSTEM FLOW : NEW'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <button type="submit" form="product-form" className="px-10 py-5 bg-zinc-900 text-white rounded-[1.5rem] font-black hover:bg-zinc-800 transition-all active:scale-95 shadow-xl">
                       {editingProduct ? t('common.save') : t('common.add')}
                    </button>
                    <button onClick={closeModal} className="w-14 h-14 flex items-center justify-center bg-slate-50 text-slate-400 rounded-[1.5rem] hover:bg-rose-50 hover:text-rose-500 transition-all">
                       <X size={28} />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-10 md:p-14">
                  <form id="product-form" onSubmit={handleSubmit} className="space-y-16" dir={dir}>
                     {/* Base Data Section */}
                     <div className="space-y-10">
                        <div className="flex items-center gap-4 border-b border-slate-50 pb-8">
                           <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
                              <Package size={24} />
                           </div>
                           <h2 className="text-2xl font-black text-slate-900 leading-none tracking-tight uppercase">
                              {language === 'ar' ? 'المعلومات الأساسية' : 'Primary Information'}
                           </h2>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-right">
                           <div className="md:col-span-2 space-y-4">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                                {language === 'ar' ? 'مجموعة الصنف *' : 'Item Group *'}
                              </label>
                              <div className="relative group mb-12">
                                <Layers className={`absolute ${dir === 'rtl' ? 'right-6' : 'left-6'} top-5 text-slate-300`} size={24} />
                                <select 
                                  required 
                                  className={`w-full ${dir === 'rtl' ? 'pr-16 pl-6' : 'pl-16 pr-6'} py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-xl font-black text-slate-900 appearance-none outline-none focus:bg-white focus:ring-8 focus:ring-emerald-500/5 transition-all shadow-inner`}
                                  value={formData.item_group_id} 
                                  onChange={(e) => setFormData({ ...formData, item_group_id: e.target.value })}
                                >
                                  <option value="">{language === 'ar' ? '-- الرجاء اختيار مجموعة الصنف --' : '-- Please select item group --'}</option>
                                  {itemGroups.map(group => (
                                    <option key={group.id} value={group.id}>
                                      {group.name} ({group.code})
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('products.form_name')}</label>
                              <input required type="text" placeholder="..." className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-xl font-black text-slate-900 outline-none focus:bg-white focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500/50 transition-all shadow-inner" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                           </div>
                           <div className="space-y-4">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('products.form_code')}</label>
                              <div className="relative group">
                                <Hash className={`absolute ${dir === 'rtl' ? 'right-6' : 'left-6'} top-5 text-slate-300`} size={24} />
                                <input required readOnly type="text" className="w-full pr-16 pl-6 py-5 bg-slate-100 border border-slate-200 rounded-[2rem] font-mono text-xl font-black text-slate-400 outline-none shadow-inner tracking-widest" value={formData.code} />
                              </div>
                           </div>
                           <div className="space-y-4">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('products.form_type')}</label>
                              <div className="relative group">
                                <LayoutGrid className={`absolute ${dir === 'rtl' ? 'right-6' : 'left-6'} top-5 text-slate-300`} size={24} />
                                <select required className="w-full pr-16 pl-6 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-xl font-black text-slate-900 appearance-none outline-none focus:bg-white focus:ring-8 focus:ring-emerald-500/5 transition-all shadow-inner" value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}>
                                  <option value="finished_good">{t('products.type_finished_good')}</option>
                                  <option value="service">{t('products.type_service')}</option>
                                  <option value="raw_material">{t('products.type_raw_material')}</option>
                                  <option value="commodity">{t('products.type_commodity')}</option>
                                </select>
                              </div>
                           </div>
                           <div className="space-y-4">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('products.form_category')}</label>
                              <input type="text" className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-xl font-black outline-none focus:bg-white focus:ring-8 focus:ring-emerald-500/5 transition-all shadow-inner" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} />
                           </div>
                           <div className="space-y-4">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('products.form_unit')}</label>
                              <select className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-xl font-black appearance-none outline-none focus:bg-white focus:ring-8 focus:ring-emerald-500/5 transition-all shadow-inner" value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })}>
                                <option value="قطعة">{t('products.unit_piece')}</option>
                                <option value="كيلو">{t('products.unit_kg')}</option>
                                <option value="متر">{t('products.unit_meter')}</option>
                                <option value="لتر">{t('products.unit_liter')}</option>
                              </select>
                           </div>
                        </div>
                     </div>

                     {/* Pricing Section */}
                     <div className="space-y-12">
                        <div className="flex items-center gap-4 border-b border-slate-50 pb-8">
                           <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
                              <Wallet size={24} />
                           </div>
                           <h2 className="text-2xl font-black text-slate-900 leading-none tracking-tight uppercase">
                              {language === 'ar' ? 'التسعير والمخزون' : 'Pricing & Inventory'}
                           </h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-right">
                           <div className="p-12 bg-slate-50/50 rounded-[3.5rem] border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-12 md:col-span-2 shadow-inner">
                              <div className="space-y-4">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('products.form_sale_price')}</label>
                                <div className="relative group">
                                  <Wallet className={`absolute ${dir === 'rtl' ? 'right-6' : 'left-6'} top-5 text-emerald-400`} size={24} />
                                  <input required type="number" step="0.01" className="w-full pr-16 pl-6 py-5 bg-white border border-emerald-100 rounded-[2.5rem] text-4xl font-black text-emerald-600 outline-none focus:ring-8 focus:ring-emerald-500/5 transition-all shadow-sm" value={formData.sale_price || ''} onChange={(e) => setFormData({ ...formData, sale_price: parseFloat(e.target.value) || 0 })} />
                                </div>
                              </div>
                              <div className="space-y-4">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('products.form_cost_price')}</label>
                                <div className="relative group">
                                  <Wallet className={`absolute ${dir === 'rtl' ? 'right-6' : 'left-6'} top-5 text-slate-300`} size={24} />
                                  <input required type="number" step="0.01" className="w-full pr-16 pl-6 py-5 bg-white border border-slate-200 rounded-[2.5rem] text-4xl font-black text-slate-900 outline-none focus:ring-8 focus:ring-slate-500/5 transition-all shadow-sm" value={formData.cost_price || ''} onChange={(e) => setFormData({ ...formData, cost_price: parseFloat(e.target.value) || 0 })} />
                                </div>
                              </div>
                           </div>
                           {formData.type !== 'service' && (
                             <>
                               <div className="space-y-4">
                                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('products.form_stock_quantity')}</label>
                                  <input disabled type="number" className="w-full px-8 py-5 bg-slate-100 border border-slate-100 rounded-[2rem] text-xl font-black outline-none transition-all shadow-inner opacity-60 cursor-not-allowed" value={formData.stock || ''} onChange={(e) => setFormData({ ...formData, stock: parseFloat(e.target.value) || 0 })} />
                               </div>
                               <div className="space-y-4">
                                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('products.form_min_stock')}</label>
                                  <input type="number" className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-xl font-black outline-none focus:bg-white focus:ring-8 focus:ring-rose-500/5 transition-all shadow-inner" value={formData.min_stock || ''} onChange={(e) => setFormData({ ...formData, min_stock: parseFloat(e.target.value) || 0 })} />
                               </div>
                             </>
                           )}
                        </div>
                     </div>

                      {/* Stock Ledger Report Section */}
                      {editingProduct && formData.type !== 'service' && (
                        <div className="space-y-12 pt-8 border-t border-slate-100">
                          <div className="flex items-center justify-between border-b border-slate-50 pb-8 flex-wrap gap-4 text-right">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
                                <History size={24} />
                              </div>
                              <div className="text-right">
                                <h2 className="text-2xl font-black text-slate-900 leading-none tracking-tight uppercase">
                                  {language === 'ar' ? 'تقرير حركة وتكلفة الصنف (كارت الصنف)' : 'Product Movement & Cost Report (Stock Card)'}
                                </h2>
                                <p className="text-slate-400 text-xs font-bold mt-1">
                                  {language === 'ar' ? 'تقرير تفصيلي بحركات المخزون والتقييم والسياسة المطبقة' : 'Detailed inventory movement, costing, and valuation ledger'}
                                </p>
                              </div>
                            </div>
                            <div className="flex bg-slate-100 px-5 py-2.5 rounded-2xl border border-slate-200 text-xs font-black text-slate-600">
                              <span>{language === 'ar' ? 'السياسة المطبقة: ' : 'Applied Policy: '}</span>
                              <span className="text-emerald-600 ml-1 mr-1">{getCostMethodLabel(formData.inventory_cost_method)}</span>
                            </div>
                          </div>

                          {/* Filters Area */}
                          <div className="p-8 bg-slate-50/50 rounded-[2.5rem] border border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 text-right">
                            {/* Date From */}
                            <div className="space-y-2 text-right">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                                {language === 'ar' ? 'من تاريخ' : 'Date From'}
                              </label>
                              <input 
                                type="date" 
                                className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all text-right"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                              />
                            </div>

                            {/* Date To */}
                            <div className="space-y-2 text-right">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                                {language === 'ar' ? 'إلى تاريخ' : 'Date To'}
                              </label>
                              <input 
                                type="date" 
                                className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all text-right"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                              />
                            </div>

                            {/* Movement Type filter */}
                            <div className="space-y-2 text-right bg-transparent relative">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                                {language === 'ar' ? 'نوع الحركة' : 'Movement Type'}
                              </label>
                              <select 
                                className="w-full px-5 py-3.5 bg-white border border-slate-200 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all text-right appearance-none"
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

                            {/* Movement Number Filter */}
                            <div className="space-y-2 text-right">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                                {language === 'ar' ? 'رقم الحركة' : 'Movement Number'}
                              </label>
                              <input 
                                type="text" 
                                placeholder={language === 'ar' ? 'البحث بالرقم...' : 'Search by number...'}
                                className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 placeholder:text-slate-300 outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all text-right"
                                value={filterRefNum}
                                onChange={(e) => setFilterRefNum(e.target.value)}
                              />
                            </div>

                            {/* Customer / Supplier Filter */}
                            <div className="space-y-2 text-right">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                                {language === 'ar' ? 'العميل / المورد' : 'Customer / Supplier'}
                              </label>
                              <input 
                                type="text" 
                                placeholder={language === 'ar' ? 'اسم العميل أو المورد...' : 'Partner name...'}
                                className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 placeholder:text-slate-300 outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all text-right"
                                value={filterPartner}
                                onChange={(e) => setFilterPartner(e.target.value)}
                              />
                            </div>
                          </div>

                          {/* Ledger Table */}
                          {loadingMovements ? (
                            <div className="py-20 text-center">
                              <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                            </div>
                          ) : filteredMovements.length === 0 ? (
                            <div className="p-16 text-center border-2 border-dashed border-slate-100 rounded-[2.5rem] bg-slate-50/20">
                              <p className="text-slate-400 font-bold">{language === 'ar' ? 'لا توجد حركات مسجلة لهذا الصنف تطابق الفلاتر المحددة' : 'No recorded movements matching the filters for this product'}</p>
                            </div>
                          ) : (
                            <div className="overflow-x-auto rounded-[2.5rem] border border-slate-200 shadow-md">
                              <table className="w-full min-w-[1250px] border-collapse bg-white">
                                <thead className="bg-slate-50 text-[10px] uppercase font-black tracking-widest text-slate-400 border-b border-slate-200 text-center">
                                  <tr>
                                    <th rowSpan={2} className="px-4 py-3 border-r border-slate-200 whitespace-nowrap">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                                    <th rowSpan={2} className="px-4 py-3 border-r border-slate-200 whitespace-nowrap">{language === 'ar' ? 'رقم الحركة' : 'Movement No.'}</th>
                                    <th rowSpan={2} className="px-4 py-3 border-r border-slate-200 whitespace-nowrap">{language === 'ar' ? 'نوع الحركة' : 'Movement Type'}</th>
                                    <th rowSpan={2} className="px-4 py-3 border-r border-slate-200 whitespace-nowrap">{language === 'ar' ? 'المخزن' : 'Warehouse'}</th>
                                    <th rowSpan={2} className="px-5 py-3 border-r border-slate-200 whitespace-nowrap">{language === 'ar' ? 'العميل / المورد' : 'Customer/Supplier'}</th>
                                    <th rowSpan={2} className="px-5 py-3 border-r border-slate-200 whitespace-nowrap">{language === 'ar' ? 'الوصف' : 'Description'}</th>
                                    <th colSpan={3} className="px-1.5 py-1.5 border-r border-b border-slate-200 bg-emerald-50/30 text-emerald-800 font-bold">{language === 'ar' ? 'الكمية' : 'Quantity'}</th>
                                    <th rowSpan={2} className="px-4 py-3 border-r border-slate-200 whitespace-nowrap">{language === 'ar' ? 'سياسة التكلفة' : 'Cost Policy'}</th>
                                    <th rowSpan={2} className="px-4 py-3 border-r border-slate-200 whitespace-nowrap">{language === 'ar' ? 'سعر التكلفة' : 'Unit Cost'}</th>
                                    <th colSpan={3} className="px-1.5 py-1.5 border-b border-slate-200 bg-sky-50/30 text-sky-800 font-bold">{language === 'ar' ? 'القيم المالية للمخزون' : 'Financial Value'}</th>
                                  </tr>
                                  <tr>
                                    {/* Quantities columns */}
                                    <th className="px-3 py-1.5 border-r border-slate-200 bg-emerald-50/10 text-emerald-600 font-bold whitespace-nowrap">{language === 'ar' ? 'الوارد (+)' : 'In (+)'}</th>
                                    <th className="px-3 py-1.5 border-r border-slate-200 bg-rose-50/10 text-rose-600 font-bold whitespace-nowrap">{language === 'ar' ? 'المصرف (-)' : 'Out (-)'}</th>
                                    <th className="px-3 py-1.5 border-r border-slate-200 bg-emerald-100/30 text-emerald-800 font-black whitespace-nowrap">{language === 'ar' ? 'الرصيد' : 'Balance'}</th>
                                    
                                    {/* Values columns */}
                                    <th className="px-3 py-1.5 border-r border-slate-200 bg-sky-50/10 text-sky-600 font-bold whitespace-nowrap">{language === 'ar' ? 'قيمة مدين (+)' : 'Debit Value'}</th>
                                    <th className="px-3 py-1.5 border-r border-slate-200 bg-rose-50/10 text-rose-600 font-bold whitespace-nowrap">{language === 'ar' ? 'قيمة دائن (-)' : 'Credit Value'}</th>
                                    <th className="px-4 py-1.5 bg-blue-100/30 text-blue-800 font-black whitespace-nowrap">{language === 'ar' ? 'الرصيد' : 'Balance Value'}</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700 text-center">
                                  {filteredMovements.map((m, index) => (
                                    <tr key={m.id || index} className="hover:bg-slate-50 transition-colors">
                                      <td className="px-4 py-4 border-r border-slate-200 font-mono whitespace-nowrap">{m.date.slice(0, 10)}</td>
                                      <td className="px-4 py-4 border-r border-slate-200 font-mono whitespace-nowrap text-slate-500">{m.reference_number}</td>
                                      <td className="px-4 py-4 border-r border-slate-200 whitespace-nowrap">
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                          m.movement_type === 'purchase' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                          m.movement_type === 'sale' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                                          m.movement_type === 'sales_return' ? 'bg-teal-50 text-teal-700 border border-teal-100' :
                                          'bg-amber-50 text-amber-700 border border-amber-100'
                                        }`}>
                                          {getMovementTypeLabel(m.movement_type)}
                                        </span>
                                      </td>
                                      <td className="px-4 py-4 border-r border-slate-200 whitespace-nowrap text-slate-600">{m.warehouseName}</td>
                                      <td className="px-5 py-4 border-r border-slate-200 whitespace-nowrap text-slate-800 font-black">{m.partner || '-'}</td>
                                      <td className="px-5 py-4 border-r border-slate-200 text-right text-slate-500 whitespace-normal max-w-[200px] truncate" title={m.description}>{m.description || '-'}</td>
                                      
                                      {/* Quantities */}
                                      <td className="px-3 py-4 border-r border-slate-200 bg-emerald-50/5 font-mono text-slate-800">{m.qtyIn > 0 ? formatNumber(m.qtyIn) : '-'}</td>
                                      <td className="px-3 py-4 border-r border-slate-200 bg-rose-50/5 font-mono text-slate-800">{m.qtyOut > 0 ? formatNumber(m.qtyOut) : '-'}</td>
                                      <td className="px-3 py-4 border-r border-slate-200 bg-emerald-50/20 font-black font-mono text-emerald-700">{formatNumber(m.runningQty)}</td>
                                      
                                      {/* Cost Policy & Cost Price */}
                                      <td className="px-4 py-4 border-r border-slate-200 text-[10px] font-bold text-zinc-500 whitespace-nowrap">{getCostMethodLabel(formData.inventory_cost_method)}</td>
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

                      {/* Attachment & Barcode */}
                     <div className="space-y-12">
                        <div className="flex items-center gap-4 border-b border-slate-50 pb-8">
                           <div className="w-12 h-12 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center shadow-inner">
                              <Camera size={24} />
                           </div>
                           <h2 className="text-2xl font-black text-slate-900 leading-none tracking-tight uppercase">
                              {language === 'ar' ? 'الوسائط والبيانات' : 'Media & Data'}
                           </h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-right">
                           <div>
                              <label className="block text-[10px] font-black text-slate-400 mb-6 uppercase tracking-widest px-1">{t('products.form_attachment')}</label>
                              <div className="relative group mb-8">
                                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" id="product-attachment" />
                                <label htmlFor="product-attachment" className="flex flex-col items-center justify-center gap-6 w-full p-16 bg-slate-50 border-[3px] border-dashed border-slate-100 rounded-[3.5rem] cursor-pointer hover:bg-slate-100 hover:border-emerald-200 transition-all shadow-inner">
                                  <div className="w-20 h-20 bg-white rounded-3xl shadow-sm flex items-center justify-center text-slate-300 group-hover:text-emerald-500 transition-all">
                                    <Camera size={32} />
                                  </div>
                                  <div className="text-center">
                                    <span className="text-sm font-black text-slate-500 block mb-1 uppercase tracking-widest">{formData.image_url ? t('common.edit') : 'اضغط لإضافة صورة'}</span>
                                    <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">JPG, PNG, WEBP (Max 2MB)</span>
                                  </div>
                                </label>
                              </div>
                              {formData.image_url && <img src={formData.image_url} alt="" className="max-h-48 mx-auto rounded-[2rem] shadow-2xl border-4 border-white" />}
                           </div>
                           <div className="space-y-8">
                              <div className="space-y-4">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('products.form_barcode')}</label>
                                <input type="text" className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-xl font-black outline-none focus:bg-white focus:ring-8 focus:ring-emerald-500/5 transition-all shadow-inner" value={formData.barcode} onChange={(e) => setFormData({ ...formData, barcode: e.target.value })} />
                              </div>
                              {formData.barcode && (
                                 <div className="p-10 bg-white border border-slate-100 rounded-[3.5rem] flex justify-center shadow-sm">
                                    <Barcode value={formData.barcode} width={2} height={80} fontSize={16} />
                                 </div>
                              )}
                           </div>
                        </div>
                     </div>

                     {/* Accounting Section */}
                     <div className="space-y-12 pb-8">
                        <div className="flex items-center gap-4 border-b border-slate-50 pb-8">
                           <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center shadow-inner">
                              <LayoutGrid size={24} />
                           </div>
                           <h2 className="text-2xl font-black text-slate-900 leading-none tracking-tight uppercase">
                              {language === 'ar' ? 'الإعدادات المحاسبية' : 'Accounting Setup'}
                           </h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-right">
                           <div className="space-y-4">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('products.form_revenue_account')}</label>
                              <select required className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-xl font-black appearance-none outline-none focus:bg-white focus:ring-8 focus:ring-emerald-500/5 transition-all shadow-inner" value={formData.revenue_account_id} onChange={(e) => setFormData({ ...formData, revenue_account_id: e.target.value })}>
                                <option value="">{t('common.select_category')}</option>
                                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>)}
                              </select>
                           </div>
                           <div className="space-y-4">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('products.form_cost_account')}</label>
                              <select required className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-xl font-black appearance-none outline-none focus:bg-white focus:ring-8 focus:ring-emerald-500/5 transition-all shadow-inner" value={formData.cost_account_id} onChange={(e) => setFormData({ ...formData, cost_account_id: e.target.value })}>
                                <option value="">{t('common.select_category')}</option>
                                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>)}
                              </select>
                           </div>

                           {/* Inventory Account (Mandatory for finished goods, raw materials, commodity) */}
                           {['finished_good', 'raw_material', 'commodity'].includes(formData.type) && (
                             <>
                               <div className={`space-y-4 ${company?.settings?.inventory_cost_method_level === 'item' ? 'md:col-span-1' : 'md:col-span-2'}`}>
                                 <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                                   {t('products.form_inventory_account')} <span className="text-rose-500 font-bold">*</span>
                                 </label>
                                 <select 
                                   required
                                   className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-xl font-black appearance-none outline-none focus:bg-white focus:ring-8 focus:ring-emerald-500/5 transition-all shadow-inner" 
                                   value={formData.inventory_account_id} 
                                   onChange={(e) => setFormData({ ...formData, inventory_account_id: e.target.value })}
                                 >
                                   <option value="">{t('common.select_account')}</option>
                                   {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>)}
                                 </select>
                               </div>

                               {company?.settings?.inventory_cost_method_level === 'item' && (
                                 <div className="space-y-4 md:col-span-1">
                                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                                     {t('company_settings.inventory_cost_method')}
                                   </label>
                                   <select 
                                     className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-xl font-black appearance-none outline-none focus:bg-white focus:ring-8 focus:ring-emerald-500/5 transition-all shadow-inner" 
                                     value={formData.inventory_cost_method || 'wac'} 
                                     onChange={(e) => setFormData({ ...formData, inventory_cost_method: e.target.value as any })}
                                   >
                                     <option value="wac">{t('company_settings.inventory_cost_method.wac')}</option>
                                     <option value="fifo">{t('company_settings.inventory_cost_method.fifo')}</option>
                                     <option value="lifo">{t('company_settings.inventory_cost_method.lifo')}</option>
                                   </select>
                                 </div>
                               )}
                             </>
                           )}

                           {/* VAT Fields if Company is VAT registered */}
                           {isVatEnabled && (
                             <>
                               <div className="space-y-4">
                                 <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                                   {t('products.form_vat_account')}
                                 </label>
                                 <select 
                                   className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-xl font-black appearance-none outline-none focus:bg-white focus:ring-8 focus:ring-emerald-500/5 transition-all shadow-inner" 
                                   value={formData.vat_account_id} 
                                   onChange={(e) => setFormData({ ...formData, vat_account_id: e.target.value })}
                                 >
                                   <option value="">{t('common.select_account')}</option>
                                   {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>)}
                                 </select>
                               </div>
                               <div className="space-y-4">
                                 <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                                   {t('products.form_vat_rate')}
                                 </label>
                                 <div className="relative">
                                   <input 
                                     type="number" 
                                     step="0.01" 
                                     min="0" 
                                     max="100" 
                                     placeholder="0" 
                                     className="w-full pl-8 pr-16 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-xl font-black outline-none focus:bg-white focus:ring-8 focus:ring-emerald-500/5 transition-all shadow-inner text-left" 
                                     value={formData.vat_rate || ''} 
                                     onChange={(e) => setFormData({ ...formData, vat_rate: parseFloat(e.target.value) || 0 })} 
                                   />
                                   <span className="absolute right-8 top-1/2 -translate-y-1/2 text-rose-500 font-extrabold text-2xl select-none pointer-events-none">
                                     %
                                   </span>
                                 </div>
                               </div>
                             </>
                           )}
                        </div>
                     </div>
                  </form>
                </div>
              </div>

              {/* Activity Side (Visible when editing) */}
              {editingProduct && (
                <div className="hidden lg:flex w-[400px] flex-col bg-slate-50 border-s border-slate-100 overflow-hidden shadow-inner">
                  <div className="p-10 border-b border-slate-100 bg-white/50 backdrop-blur-sm sticky top-0 z-10 text-right">
                     <div className="flex items-center gap-4">
                         <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-slate-400">
                           <History size={24} />
                         </div>
                         <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">النشاط الأخير</span>
                            <h3 className="font-black text-slate-900 text-lg">سجل التعديلات</h3>
                         </div>
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                     <InlineActivityLog category="products" documentId={editingProduct.id} />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Standalone Stock Card Report Dialog (خارج الشاشة) */}
      <AnimatePresence>
        {isReportOpen && reportProduct && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4 md:p-10"
            dir={dir}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-7xl h-[90vh] rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-100"
            >
              {/* Header */}
              <div className="p-8 md:p-10 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between bg-white relative gap-4">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-[2rem] flex items-center justify-center shadow-inner">
                    <History size={32} />
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs bg-slate-100 px-3 py-1 rounded-lg text-slate-500 font-black border border-slate-200">
                        {reportProduct.code}
                      </span>
                      <h2 className="text-3xl font-black text-slate-900 leading-none tracking-tight">
                        {language === 'ar' ? 'كارت حركة وتكلفة الصنف' : 'Product Stock Card'}
                      </h2>
                    </div>
                    <p className="text-slate-500 text-sm font-bold mt-2">
                      {language === 'ar' ? `الصنف: ${reportProduct.name}` : `Product: ${reportProduct.name}`}
                    </p>
                  </div>
                </div>

                {/* Actions Toolbar */}
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Refresh */}
                  <button 
                    onClick={loadMovementData} 
                    className="p-4 bg-slate-50 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-2xl shadow-sm border border-slate-100 transition-all flex items-center gap-2 font-black text-xs uppercase tracking-widest"
                    title={language === 'ar' ? 'تحديث' : 'Refresh'}
                  >
                    <RefreshCw size={18} className={loadingMovements ? "animate-spin" : ""} />
                    <span className="hidden sm:inline">{language === 'ar' ? 'تحديث' : 'Refresh'}</span>
                  </button>

                  {/* Print */}
                  <button 
                    onClick={handlePrintStockCard} 
                    className="p-4 bg-slate-50 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-100 rounded-2xl shadow-sm transition-all flex items-center gap-2 font-black text-xs uppercase tracking-widest"
                    title={language === 'ar' ? 'طباعة التقرير' : 'Print'}
                  >
                    <Printer size={18} />
                    <span className="hidden sm:inline">{language === 'ar' ? 'طباعة' : 'Print'}</span>
                  </button>

                  {/* PDF */}
                  <button 
                    onClick={handleExportStockCardPDF} 
                    className="p-4 bg-slate-50 text-slate-600 hover:text-rose-700 hover:bg-rose-50 border border-slate-100 rounded-2xl shadow-sm transition-all flex items-center gap-2 font-black text-xs uppercase tracking-widest"
                    title={language === 'ar' ? 'تحميل PDF' : 'Download PDF'}
                  >
                    <FileText size={18} />
                    <span className="hidden sm:inline">PDF</span>
                  </button>

                  {/* Excel */}
                  <button 
                    onClick={handleExportStockCardExcel} 
                    className="p-4 bg-slate-50 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-100 rounded-2xl shadow-sm transition-all flex items-center gap-2 font-black text-xs uppercase tracking-widest"
                    title={language === 'ar' ? 'تحميل اكسيل' : 'Download Excel'}
                  >
                    <Download size={18} />
                    <span className="hidden sm:inline">{language === 'ar' ? 'إكسيل' : 'Excel'}</span>
                  </button>

                  {/* Close button */}
                  <button 
                    onClick={() => {
                      setIsReportOpen(false);
                      setReportProduct(null);
                    }} 
                    className="w-14 h-14 bg-slate-50 hover:bg-rose-50 hover:text-rose-600 text-slate-400 border border-slate-200 rounded-[1.5rem] flex items-center justify-center transition-all shadow-sm"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="p-8 bg-slate-50 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 text-right">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                    {language === 'ar' ? 'من تاريخ' : 'Date From'}
                  </label>
                  <input 
                    type="date" 
                    className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all text-right shadow-sm"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                    {language === 'ar' ? 'إلى تاريخ' : 'Date To'}
                  </label>
                  <input 
                    type="date" 
                    className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all text-right shadow-sm"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
                <div className="space-y-2 relative">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                    {language === 'ar' ? 'نوع الحركة' : 'Movement Type'}
                  </label>
                  <select 
                    className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all text-right appearance-none shadow-sm"
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
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                    {language === 'ar' ? 'رقم الحركة' : 'Movement Number'}
                  </label>
                  <input 
                    type="text" 
                    placeholder={language === 'ar' ? 'البحث بالرقم...' : 'Search by number...'}
                    className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 placeholder:text-slate-300 outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all text-right shadow-sm"
                    value={filterRefNum}
                    onChange={(e) => setFilterRefNum(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                    {language === 'ar' ? 'العميل / المورد' : 'Customer / Supplier'}
                  </label>
                  <input 
                    type="text" 
                    placeholder={language === 'ar' ? 'اسم العميل أو المورد...' : 'Partner name...'}
                    className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 placeholder:text-slate-300 outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all text-right shadow-sm"
                    value={filterPartner}
                    onChange={(e) => setFilterPartner(e.target.value)}
                  />
                </div>
              </div>

              {/* Scrollable Document Area targeting ID for print */}
              <div id="stock-card-report-area" className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-zinc-50/50">
                {/* Print Title (Hidden in screen, visible in print) */}
                <div className="hidden print:block mb-8 text-center pb-6 border-b border-slate-200">
                  <h1 className="text-3xl font-black">{language === 'ar' ? 'تقرير حركة وتكلفة الصنف (كارت الصنف)' : 'Product Stock Card Report'}</h1>
                  <p className="text-slate-500 mt-2 font-black">{language === 'ar' ? `اسم الصنف: ${reportProduct.name} | الرمز: ${reportProduct.code}` : `Product: ${reportProduct.name} | Code: ${reportProduct.code}`}</p>
                  <p className="text-slate-400 text-xs mt-1">{language === 'ar' ? `تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}` : `Printed on: ${new Date().toLocaleDateString()}`}</p>
                </div>

                {loadingMovements ? (
                  <div className="py-20 text-center">
                    <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  </div>
                ) : filteredMovements.length === 0 ? (
                  <div className="p-16 text-center border-2 border-dashed border-slate-100 rounded-[2.5rem] bg-white shadow-sm">
                    <History className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-400 font-extrabold text-lg">{language === 'ar' ? 'لا توجد حركات مسجلة لهذا الصنف تطابق الفلاتر المحددة' : 'No recorded movements matching the filters for this product'}</p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-[2.5rem] border border-slate-200 shadow-md bg-white">
                    <table ref={reportTableRef} className="w-full min-w-[1250px] border-collapse bg-white">
                      <thead className="bg-slate-50 text-[10px] uppercase font-black tracking-widest text-slate-400 border-b border-slate-200 text-center select-none">
                        <tr>
                          <th rowSpan={2} className="px-4 py-3 border-r border-slate-200 whitespace-nowrap">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                          <th rowSpan={2} className="px-4 py-3 border-r border-slate-200 whitespace-nowrap">{language === 'ar' ? 'رقم الحركة' : 'Movement No.'}</th>
                          <th rowSpan={2} className="px-4 py-3 border-r border-slate-200 whitespace-nowrap">{language === 'ar' ? 'نوع الحركة' : 'Movement Type'}</th>
                          <th rowSpan={2} className="px-4 py-3 border-r border-slate-200 whitespace-nowrap">{language === 'ar' ? 'المخزن' : 'Warehouse'}</th>
                          <th rowSpan={2} className="px-5 py-3 border-r border-slate-200 whitespace-nowrap">{language === 'ar' ? 'العميل / المورد' : 'Customer/Supplier'}</th>
                          <th rowSpan={1} className="px-5 py-3 border-r border-slate-200 whitespace-nowrap">{language === 'ar' ? 'الوصف' : 'Description'}</th>
                          <th colSpan={3} className="px-1.5 py-1.5 border-r border-b border-slate-200 bg-emerald-50/30 text-emerald-800 font-bold">{language === 'ar' ? 'الكمية' : 'Quantity'}</th>
                          <th rowSpan={2} className="px-4 py-3 border-r border-slate-200 whitespace-nowrap">{language === 'ar' ? 'سياسة التكلفة' : 'Cost Policy'}</th>
                          <th rowSpan={2} className="px-4 py-3 border-r border-slate-200 whitespace-nowrap">{language === 'ar' ? 'سعر التكلفة' : 'Unit Cost'}</th>
                          <th colSpan={3} className="px-1.5 py-1.5 border-b border-slate-200 bg-sky-50/30 text-sky-800 font-bold">{language === 'ar' ? 'القيم المالية للمخزون' : 'Financial Value'}</th>
                        </tr>
                        <tr>
                          <th className="px-5 py-1.5 border-r border-slate-200 whitespace-nowrap text-slate-400 text-[10px]">{language === 'ar' ? 'شرح الحركة' : 'Remark'}</th>
                          {/* Quantities columns */}
                          <th className="px-3 py-1.5 border-r border-slate-200 bg-emerald-50/10 text-emerald-600 font-bold whitespace-nowrap">{language === 'ar' ? 'الوارد (+)' : 'In (+)'}</th>
                          <th className="px-3 py-1.5 border-r border-slate-200 bg-rose-50/10 text-rose-600 font-bold whitespace-nowrap">{language === 'ar' ? 'المصرف (-)' : 'Out (-)'}</th>
                          <th className="px-3 py-1.5 border-r border-slate-200 bg-emerald-100/30 text-emerald-800 font-black whitespace-nowrap">{language === 'ar' ? 'الرصيد' : 'Balance'}</th>
                          
                          {/* Values columns */}
                          <th className="px-3 py-1.5 border-r border-slate-200 bg-sky-50/10 text-sky-600 font-bold whitespace-nowrap">{language === 'ar' ? 'قيمة مدين (+)' : 'Debit Value'}</th>
                          <th className="px-3 py-1.5 border-r border-slate-200 bg-rose-50/10 text-rose-600 font-bold whitespace-nowrap">{language === 'ar' ? 'قيمة دائن (-)' : 'Credit Value'}</th>
                          <th className="px-4 py-1.5 bg-blue-100/30 text-blue-800 font-black whitespace-nowrap">{language === 'ar' ? 'الرصيد' : 'Balance Value'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700 text-center">
                        {filteredMovements.map((m, index) => (
                          <tr key={m.id || index} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-4 border-r border-slate-200 font-mono whitespace-nowrap">{m.date.slice(0, 10)}</td>
                            <td className="px-4 py-4 border-r border-slate-200 font-mono whitespace-nowrap text-slate-500">{m.reference_number}</td>
                            <td className="px-4 py-4 border-r border-slate-200 whitespace-nowrap">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                m.movement_type === 'purchase' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                m.movement_type === 'sale' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                                m.movement_type === 'sales_return' ? 'bg-teal-50 text-teal-700 border border-teal-100' :
                                'bg-amber-50 text-amber-700 border border-amber-100'
                              }`}>
                                {getMovementTypeLabel(m.movement_type)}
                              </span>
                            </td>
                            <td className="px-4 py-4 border-r border-slate-200 whitespace-nowrap text-slate-600">{m.warehouseName}</td>
                            <td className="px-5 py-4 border-r border-slate-200 whitespace-nowrap text-slate-800 font-black">{m.partner || '-'}</td>
                            <td className="px-5 py-4 border-r border-slate-200 text-right text-slate-500 whitespace-normal max-w-[200px] truncate" title={m.description}>{m.description || '-'}</td>
                            
                            {/* Quantities */}
                            <td className="px-3 py-4 border-r border-slate-200 bg-emerald-50/5 font-mono text-slate-800">{m.qtyIn > 0 ? formatNumber(m.qtyIn) : '-'}</td>
                            <td className="px-3 py-4 border-r border-slate-200 bg-rose-50/5 font-mono text-slate-800">{m.qtyOut > 0 ? formatNumber(m.qtyOut) : '-'}</td>
                            <td className="px-3 py-4 border-r border-slate-200 bg-emerald-50/20 font-black font-mono text-emerald-700">{formatNumber(m.runningQty)}</td>
                            
                            {/* Cost Policy & Cost Price */}
                            <td className="px-4 py-4 border-r border-slate-200 text-[10px] font-bold text-zinc-500 whitespace-nowrap">{getCostMethodLabel(reportProduct.inventory_cost_method || 'wac')}</td>
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <PageActivityLog category="products" isOpen={isActivityLogOpen} onClose={() => setIsActivityLogOpen(false)} />
    </div>
  );
};
