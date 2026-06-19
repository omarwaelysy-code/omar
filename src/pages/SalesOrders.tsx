import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { SalesOrder, Customer, Product, SalesOrderItem, Warehouse, Company, Operation, Department, CostCenter, Currency, ExchangeRate, ActivityLog } from '../types';
import { 
  Search, Plus, Trash2, X, Eye, Sparkles, FileText, Pencil, Printer, 
  ChevronLeft, ChevronRight, Hash, Calendar, Package, Tag, ArrowUpRight, 
  Lock, LayoutGrid, List, FileCheck, Layers, ChevronUp, ChevronDown, CheckCheck, History, Download, ExternalLink, Coins, Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Barcode from 'react-barcode';
import { dbService, apiRequest } from '../services/dbService';
import { PaginationControls } from '../components/PaginationControls';
import { usePermissions } from '../hooks/usePermissions';
import { formatMoney, formatDate } from '../utils/formatUtils';
import { useLanguage } from '../contexts/LanguageContext';
import { useViewPreference } from '../hooks/useViewPreference';
import { CompanyInvoiceHeader } from '../components/CompanyInvoiceHeader';
import { useNavigation } from '../contexts/NavigationContext';
import { exportToPDF as exportToPDFUtil } from '../utils/pdfUtils';
import { TransactionSidePanel } from '../components/TransactionSidePanel';
import { InlineActivityLog } from '../components/InlineActivityLog';

export const SalesOrders: React.FC = () => {
  const { t, dir, language } = useLanguage();
  const { user } = useAuth();
  const { canView, canCreate, canEdit, canDelete } = usePermissions('sales_orders');
  const { showNotification } = useNotification();
  const { openTab, setPendingViewDoc } = useNavigation();

  // Local translations helper for Sales Orders
  const ot = (key: string): string => {
    const translations: Record<string, { ar: string; en: string }> = {
      title: { ar: 'أوامر البيع', en: 'Sales Orders' },
      subtitle: { ar: 'إنشاء وإدارة أوامر البيع للعملاء ومتابعة تحويلها إلى فواتير.', en: 'Create and manage sales orders and track their conversion to invoices.' },
      add_order: { ar: 'إضافة أمر بيع', en: 'Add Sales Order' },
      edit_order: { ar: 'تعديل أمر بيع', en: 'Edit Sales Order' },
      search_placeholder: { ar: 'البحث عن أمر بيع برقم الأمر أو اسم العميل...', en: 'Search sales orders by number or customer...' },
      column_number: { ar: 'رقم الأمر', en: 'Order No' },
      column_customer: { ar: 'العميل', en: 'Customer' },
      column_date: { ar: 'التاريخ', en: 'Date' },
      column_delivery_date: { ar: 'تاريخ التسليم', en: 'Delivery Date' },
      column_amount: { ar: 'الإجمالي', en: 'Total Amount' },
      column_status: { ar: 'الحالة', en: 'Status' },
      status_pending: { ar: 'معلق', en: 'Pending' },
      status_converted: { ar: 'تم التحويل', en: 'Converted' },
      converted_to: { ar: 'فاتورة رقم', en: 'Invoice No' },
      convert_to_invoice: { ar: 'تحويل إلى فاتورة', en: 'Convert to Invoice' },
      form_customer: { ar: 'العميل', en: 'Customer' },
      form_warehouse: { ar: 'المخزن الرئيسي', en: 'Warehouse' },
      form_date: { ar: 'تاريخ الأمر', en: 'Order Date' },
      form_delivery_date: { ar: 'تاريخ التسليم المتوقع', en: 'Expected Delivery' },
      form_description: { ar: 'البيان / ملاحظات إضافية', en: 'Description / Notes' },
      form_items: { ar: 'أصناف الأمر', en: 'Order Items' },
      add_item: { ar: 'إضافة صنف', en: 'Add Item' },
      column_product: { ar: 'الصنف', en: 'Product' },
      column_quantity: { ar: 'الكمية', en: 'Quantity' },
      column_price: { ar: 'سعر الوحدة', en: 'Unit Price' },
      column_total: { ar: 'الإجمالي', en: 'Total' },
      summary_subtotal: { ar: 'الإجمالي قبل الخصم', en: 'Subtotal' },
      summary_discount: { ar: 'الخصم', en: 'Discount' },
      summary_total: { ar: 'الإجمالي النهائي', en: 'Total Amount' },
      view_order: { ar: 'تفاصيل أمر البيع', en: 'Sales Order Details' },
      order: { ar: 'أمر بيع', en: 'Sales Order' },
      order_to: { ar: 'أمر بيع إلى', en: 'Order To' },
      order_saved: { ar: 'تم حفظ أمر البيع بنجاح', en: 'Sales Order saved successfully' },
      order_updated: { ar: 'تم تعديل أمر البيع بنجاح', en: 'Sales Order updated successfully' },
      order_deleted: { ar: 'تم حذف أمر البيع بنجاح', en: 'Sales Order deleted successfully' },
      delete_order: { ar: 'حذف أمر البيع', en: 'Delete Sales Order' },
      delete_confirm: { ar: 'هل أنت متأكد من رغبتك في حذف هذا الأمر نهائياً؟ لا يمكن التراجع عن هذا الإجراء.', en: 'Are you sure you want to permanently delete this order? This action cannot be undone.' },
      lock_error_edit: { ar: 'لا يمكن تعديل هذا الأمر لأنه تم تحويله بالفعل إلى فاتورة', en: 'This order cannot be edited because it has already been converted to an invoice.' },
      lock_error_delete: { ar: 'لا يمكن حذف هذا الأمر لأنه تم تحويله بالفعل إلى فاتورة', en: 'This order cannot be deleted because it has already been converted to an invoice.' },
      title_activity_log: { ar: 'سجل التعديلات والنشاط', en: 'Activity Log & Changes' },
      show_activity_log: { ar: 'عرض سجل التعديلات والقيد', en: 'Show Activity Log & Journal' },
      currency: { ar: 'العملة', en: 'Currency' },
      exchange_rate: { ar: 'سعر الصرف', en: 'Exchange Rate' },
      operation: { ar: 'العملية', en: 'Operation' },
      department: { ar: 'الإدارة', en: 'Department' },
      cost_center: { ar: 'مركز التكلفة', en: 'Cost Center' }
    };
    return translations[key]?.[language as 'ar' | 'en'] || key;
  };

  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [companyCurrencies, setCompanyCurrencies] = useState<Currency[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [totalRecords, setTotalRecords] = useState(0);
  const [serverSummary, setServerSummary] = useState<any>({});

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<SalesOrder | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [viewOrder, setViewOrder] = useState<SalesOrder | null>(null);
  const [view, setView] = useViewPreference('sales_orders', 'table');
  const [companyData, setCompanyData] = useState<Company | null>(null);

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [selectedOperationId, setSelectedOperationId] = useState<string>('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [selectedCostCenterId, setSelectedCostCenterId] = useState<string>('');
  const [selectedCurrencyId, setSelectedCurrencyId] = useState<string>('');
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [exchangeRateType, setExchangeRateType] = useState<'manual' | 'auto'>('manual');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<SalesOrderItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [description, setDescription] = useState<string>('');
  const [orderNumber, setOrderNumber] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Floating popover lookup search states
  const [activeSearch, setActiveSearch] = useState<{
    index: number;
    type: 'operation' | 'department' | 'cost_center';
    query: string;
  } | null>(null);

  const [popoverRect, setPopoverRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const [focusedPriceIndex, setFocusedPriceIndex] = useState<number | null>(null);
  const [tempPriceValue, setTempPriceValue] = useState<string>('');

  // Side/Bottom activity panel states
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  const [previewActivityLog, setPreviewActivityLog] = useState<Partial<ActivityLog> | null>(null);

  const orderRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const isVatEnabled = companyData?.settings?.vat_enabled || companyData?.vat_enabled || false;
  const isMultiCurrencyEnabled = companyData?.settings?.enable_multi_currency || (companyData as any)?.enable_multi_currency || false;

  const prevExchangeRateRef = useRef<number>(1);
  const isInitializingRef = useRef<boolean>(true);

  // Initialize refs when modal opens
  useEffect(() => {
    if (isModalOpen) {
      isInitializingRef.current = true;
      prevExchangeRateRef.current = exchangeRate || 1;
    }
  }, [isModalOpen]);

  // Recalculate item prices when exchange rate changes dynamically
  useEffect(() => {
    if (isModalOpen) {
      if (isInitializingRef.current) {
        isInitializingRef.current = false;
        prevExchangeRateRef.current = exchangeRate || 1;
        return;
      }

      const prevRate = prevExchangeRateRef.current;
      if (prevRate !== exchangeRate && exchangeRate > 0 && prevRate > 0) {
        setItems(prevItems => prevItems.map(item => {
          const currentPrice = Number(item.unit_price) || 0;
          const newPrice = Number((currentPrice * (prevRate / exchangeRate)).toFixed(4));
          const total = Number(((item.quantity || 0) * newPrice).toFixed(4));
          const vatRate = Number((item as any).vat_rate) || 0;
          const vatAmount = Number((total * (vatRate / 100)).toFixed(4));
          return {
            ...item,
            unit_price: newPrice,
            total: total,
            vat_amount: vatAmount
          } as any;
        }));
      }
      prevExchangeRateRef.current = exchangeRate;
    }
  }, [exchangeRate, isModalOpen]);

  // Subscriptions & catalogs loading
  useEffect(() => {
    if (user) {
      const unsubOrders = dbService.subscribePaginated<SalesOrder>('sales_orders', {
        company_id: user.company_id,
        _page: page,
        _limit: limit,
        _sortBy: sortBy,
        _sortOrder: sortOrder,
        _search: searchTerm
      }, (result) => {
        setOrders(result.data);
        setTotalRecords(result.total);
        setServerSummary(result.summary || {});
        setLoading(false);
      });

      const unsubCustomers = dbService.subscribe<Customer>('customers', user.company_id, setCustomers);
      const unsubProducts = dbService.subscribe<Product>('products', user.company_id, setProducts);
      const unsubWarehouses = dbService.subscribe<any>('warehouses', user.company_id, setWarehouses);
      const unsubOperations = dbService.subscribe<Operation>('operations', user.company_id, setOperations);
      const unsubDepartments = dbService.subscribe<Department>('departments', user.company_id, setDepartments);
      const unsubCostCenters = dbService.subscribe<CostCenter>('cost_centers', user.company_id, setCostCenters);
      const unsubCurrencies = dbService.subscribe<Currency>('currencies', user.company_id, setCompanyCurrencies);

      const loadCompanyData = async () => {
        try {
          const company = await dbService.get<Company>('companies', user.company_id);
          if (company) {
            setCompanyData(company);
          }
        } catch (error) {
          console.error('Failed to load company data:', error);
        }
      };
      loadCompanyData();

      return () => {
        unsubOrders();
        unsubCustomers();
        unsubProducts();
        unsubWarehouses();
        unsubOperations();
        unsubDepartments();
        unsubCostCenters();
        unsubCurrencies();
      };
    }
  }, [user, page, limit, sortBy, sortOrder, searchTerm]);

  // Real-time Preview Log Logic
  useEffect(() => {
    if (!isModalOpen || !user) {
      setPreviewActivityLog(null);
      return;
    }

    const generatePreview = () => {
      const subtotal = items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
      const vatTotal = isVatEnabled
        ? items.reduce((sum, item) => sum + (Number((item as any).vat_amount) || 0), 0)
        : 0;
      const total_amount = subtotal + vatTotal - Number(discount || 0);
      if (subtotal <= 0) {
        setPreviewActivityLog(null);
        return;
      }

      const customer = customers.find(c => c.id === selectedCustomerId);
      const order_number = editingOrder?.order_number || 'SO-PREVIEW';

      // Preview Activity Log
      setPreviewActivityLog({
        action: editingOrder ? ot('edit_order') : ot('add_order'),
        details: editingOrder 
          ? `${ot('edit_order')}: ${order_number} للعميل ${customer?.name || '...'}`
          : `${ot('add_order')} للعميل ${customer?.name || '...'} بمبلغ ${formatMoney(total_amount)}`,
        created_at: new Date().toISOString(),
        entity: 'sales_orders'
      });
    };

    generatePreview();
  }, [isModalOpen, user, items, discount, selectedCustomerId, editingOrder, isVatEnabled]);

  const handleCurrencyChange = async (currencyId: string) => {
    setSelectedCurrencyId(currencyId);
    if (!currencyId || !user?.company_id || !companyData) {
      setExchangeRate(1);
      return;
    }
    
    const currency = companyCurrencies.find(c => c.id === currencyId);
    if (!currency) {
      setExchangeRate(1);
      return;
    }
    
    const baseCurrency = companyData.settings?.currency || 'EGP';
    if (currency.code.toLowerCase() === baseCurrency.toLowerCase()) {
      setExchangeRate(1);
      setExchangeRateType('manual');
      return;
    }

    const updateMethod = companyData.settings?.exchange_rate_update_method || 'manual';
    setExchangeRateType(updateMethod);

    if (updateMethod === 'auto') {
      try {
        const latestAutoRates = await apiRequest<Array<{
          currency_id: string;
          rate: number | null;
          rate_date: string | null;
        }>>(`/currency-rates/latest?company_id=${user.company_id}`);
        const rateObj = latestAutoRates.find(r => r.currency_id === currencyId);
        if (rateObj && rateObj.rate !== null) {
          setExchangeRate(Number(rateObj.rate));
        } else {
          // fallback to manual rate
          const manualRates = await dbService.list<ExchangeRate>('exchange_rates', {
            currency_id: currencyId,
            company_id: user.company_id,
            _limit: 1,
            _sort: 'rate_date',
            _order: 'desc'
          });
          if (manualRates.length > 0) {
            setExchangeRate(Number(manualRates[0].exchange_rate));
          } else {
            setExchangeRate(1);
          }
        }
      } catch (error) {
        console.error('Error fetching auto rate:', error);
        setExchangeRate(1);
      }
    } else {
      // manual update method
      try {
        const manualRates = await dbService.list<ExchangeRate>('exchange_rates', {
          currency_id: currencyId,
          company_id: user.company_id,
          _limit: 1,
          _sort: 'rate_date',
          _order: 'desc'
        });
        if (manualRates.length > 0) {
          setExchangeRate(Number(manualRates[0].exchange_rate));
        } else {
          setExchangeRate(1);
        }
      } catch (error) {
        console.error('Error fetching manual rate:', error);
        setExchangeRate(1);
      }
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(field);
      setSortOrder('DESC');
    }
    setPage(1);
  };

  const generateOrderNumber = async (dateStr: string) => {
    try {
      const next = await dbService.getNextSequence('sales_orders', dateStr);
      return next;
    } catch (err) {
      console.error(err);
      return 'SO-' + dateStr.slice(0, 7) + '-000001';
    }
  };

  const openModal = async () => {
    setEditingOrder(null);
    setSelectedCustomerId('');
    setSelectedWarehouseId('');
    setSelectedOperationId('');
    setSelectedDepartmentId('');
    setSelectedCostCenterId('');
    setSelectedCurrencyId('');
    setExchangeRate(1);
    const newDate = new Date().toISOString().slice(0, 10);
    setDate(newDate);
    setDeliveryDate(newDate);
    const num = await generateOrderNumber(newDate);
    setOrderNumber(num);
    setItems([]);
    setDiscount(0);
    setDescription('');
    setShowSidePanel(false);
    setIsPanelExpanded(false);
    setIsModalOpen(true);
    setIsFullScreen(false);
  };

  const openEditModal = async (order: SalesOrder) => {
    if (order.status === 'converted') {
      showNotification(`${ot('lock_error_edit')} ${order.invoice_number || ''}`, 'error');
      return;
    }
    try {
      const fullData = await dbService.get<SalesOrder>('sales_orders', order.id);
      if (!fullData) throw new Error('Could not fetch sales order details');
      
      setEditingOrder(fullData);
      setSelectedCustomerId(fullData.customer_id);
      setSelectedWarehouseId(fullData.warehouse_id || '');
      setSelectedOperationId((fullData as any).operation_id || '');
      setSelectedDepartmentId((fullData as any).department_id || '');
      setSelectedCostCenterId((fullData as any).cost_center_id || '');
      setSelectedCurrencyId((fullData as any).currency_id || '');
      setExchangeRate((fullData as any).exchange_rate || 1);
      setDate(fullData.date);
      setDeliveryDate(fullData.delivery_date || fullData.date);
      setOrderNumber(fullData.order_number);
      setItems(fullData.items || []);
      setDiscount(fullData.discount_amount || 0);
      setDescription(fullData.description || '');
      setShowSidePanel(false);
      setIsPanelExpanded(false);
      setIsModalOpen(true);
      setIsFullScreen(false);
    } catch (e: any) {
      console.error(e);
      showNotification(e.message || 'Error loading order', 'error');
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, order: SalesOrder) => {
    e.stopPropagation();
    if (order.status === 'converted') {
      showNotification(`${ot('lock_error_delete')} ${order.invoice_number || ''}`, 'error');
      return;
    }
    setOrderToDelete(order.id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!orderToDelete || !user) return;
    try {
      await dbService.delete('sales_orders', orderToDelete);
      await dbService.logActivity(user.id, user.username, user.company_id, ot('delete_order'), `${ot('order_deleted')}: ${orderToDelete}`, 'sales_orders', orderToDelete);
      showNotification(ot('order_deleted'), 'success');
      setIsDeleteModalOpen(false);
      setOrderToDelete(null);
    } catch (e: any) {
      console.error(e);
      showNotification(e.message || t('common.delete_error'), 'error');
    }
  };

  const handlePrint = () => {
    // Add print-specific styles dynamically to ensure only the order content is printed
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        body * {
          visibility: hidden !important;
        }
        #order-capture-area, #order-capture-area * {
          visibility: visible !important;
        }
        #order-capture-area {
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
        /* Ensure images and barcodes are rendered */
        img {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        svg {
          max-width: 100% !important;
        }
      }
    `;
    document.head.appendChild(style);
    window.print();
    // Remove the style after printing (optional but cleaner)
    setTimeout(() => document.head.removeChild(style), 1000);
  };

  const handleExportOrderPDF = (order: SalesOrder) => {
    if (orderRef.current) {
      exportToPDFUtil(orderRef.current, {
        filename: `SalesOrder_${order.order_number}`,
        reportTitle: `${ot('order')} رقم ${order.order_number}`,
        orientation: 'portrait'
      });
    }
  };

  const handleConvertToInvoice = (e: React.MouseEvent, order: SalesOrder) => {
    e.stopPropagation();
    setPendingViewDoc({ type: 'convert_sales_order', idOrNumber: order.id });
    openTab('invoices', t('nav.invoices'));
    showNotification(language === 'ar' ? 'تم تجهيز أمر البيع للتحويل، يرجى حفظ الفاتورة' : 'Sales order prepped for conversion, please save invoice', 'info');
  };

  const handleAddItem = () => {
    setItems([...items, { product_id: '', quantity: 1, unit_price: 0, total: 0 }]);
  };

  const addEmptyRow = () => {
    setItems(prev => [...prev, { product_id: '', quantity: 1, unit_price: 0, total: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof SalesOrderItem | 'operation_id' | 'department_id' | 'cost_center_id' | 'description' | 'vat_rate' | 'vat_amount', value: any) => {
    setItems(prev => {
      const newItems = [...prev];
      const item = { ...newItems[index], [field]: value } as any;
      
      if (field === 'product_id') {
        const product = products.find(p => p.id === value);
        if (product) {
          const rate = Number(exchangeRate) || 1;
          const foreignPrice = Number((product.sale_price / rate).toFixed(4));
          item.product_name = product.name;
          item.product_image_url = product.image_url;
          item.unit_price = foreignPrice;
          item.vat_rate = product.vat_rate || 0;
          item.total = (item.quantity || 0) * foreignPrice;
          item.vat_amount = item.total * ((product.vat_rate || 0) / 100);
          item.barcode = product.barcode || '';
          item.image_url = product.image_url || '';
        } else {
          item.product_name = '';
          item.product_image_url = '';
          item.unit_price = 0;
          item.vat_rate = 0;
          item.total = 0;
          item.vat_amount = 0;
          item.barcode = '';
          item.image_url = '';
        }
      }

      if (field === 'operation_id') {
        const op = operations.find(o => o.id === value);
        if (op) {
          if (op.department_id) {
            item.department_id = op.department_id;
          }
          if (op.cost_center_id) {
            item.cost_center_id = op.cost_center_id;
          }
        }
      }
      
      if (field === 'quantity' || field === 'unit_price' || field === 'vat_rate') {
        item.total = (item.quantity || 0) * (item.unit_price || 0);
        item.vat_amount = item.total * ((item.vat_rate || 0) / 100);
      }
      
      newItems[index] = item;
      return newItems;
    });
  };

  const applyOperationToAllItems = () => {
    if (!selectedOperationId) return;
    setItems(prev => prev.map(item => ({ ...item, operation_id: selectedOperationId } as any)));
    showNotification(language === 'ar' ? 'تم تطبيق العملية على كافة الأصناف' : 'Operation applied to all items', 'success');
  };

  const applyDepartmentToAllItems = () => {
    if (!selectedDepartmentId) return;
    setItems(prev => prev.map(item => ({ ...item, department_id: selectedDepartmentId } as any)));
    showNotification(language === 'ar' ? 'تم تطبيق الإدارة على كافة الأصناف' : 'Department applied to all items', 'success');
  };

  const applyCostCenterToAllItems = () => {
    if (!selectedCostCenterId) return;
    setItems(prev => prev.map(item => ({ ...item, cost_center_id: selectedCostCenterId } as any)));
    showNotification(language === 'ar' ? 'تم تطبيق مركز التكلفة على كافة الأصناف' : 'Cost center applied to all items', 'success');
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + (item.total || 0), 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const vatTotal = isVatEnabled
      ? items.reduce((sum, item) => sum + (Number((item as any).vat_amount) || 0), 0)
      : 0;
    return subtotal + vatTotal - (Number(discount) || 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!selectedCustomerId) {
      showNotification(language === 'ar' ? 'يرجى اختيار العميل' : 'Please select a customer', 'error');
      return;
    }

    const validItems = items.filter(item => item.product_id);
    if (validItems.length === 0) {
      showNotification(language === 'ar' ? 'يرجى إضافة أصناف' : 'Please add items', 'error');
      return;
    }

    // sanitize items for save
    const sanitizedItems = validItems.map(item => ({
      product_id: item.product_id,
      product_name: item.product_name || '',
      product_code: item.product_code || '',
      product_image_url: item.product_image_url || item.image_url || '',
      quantity: Number(item.quantity) || 0,
      unit_price: Number(item.unit_price) || 0,
      vat_rate: Number((item as any).vat_rate) || 0,
      vat_amount: Number((item as any).vat_amount) || 0,
      total: Number(item.total) || 0,
      barcode: item.barcode || '',
      image_url: item.image_url || item.product_image_url || '',
      operation_id: (item as any).operation_id || null,
      department_id: (item as any).department_id || null,
      cost_center_id: (item as any).cost_center_id || null,
      description: (item as any).description || ''
    }));

    try {
      const subtotal = calculateSubtotal();
      const vatTotal = isVatEnabled
        ? Number(sanitizedItems.reduce((sum, item) => sum + (Number(item.vat_amount) || 0), 0).toFixed(2))
        : 0;
      const discount_amount = Number(discount) || 0;
      const total_amount = Number((subtotal + vatTotal - discount_amount).toFixed(2)) || 0;
      const customer = customers.find(c => c.id === selectedCustomerId);

      const orderData = {
        order_number: orderNumber,
        customer_id: selectedCustomerId,
        customer_name: customer?.name || '',
        warehouse_id: selectedWarehouseId || null,
        date,
        delivery_date: deliveryDate,
        description,
        notes: description,
        items: sanitizedItems,
        subtotal,
        tax_amount: vatTotal,
        discount_amount,
        total_amount,
        company_id: user.company_id,
        created_by: user.id,
        operation_id: selectedOperationId || null,
        department_id: selectedDepartmentId || null,
        cost_center_id: selectedCostCenterId || null,
        currency_id: selectedCurrencyId || null,
        exchange_rate: Number(exchangeRate) || 1
      };

      // Calculate changes if editing
      const changes: any[] = [];
      const detailsList: string[] = [];

      if (editingOrder) {
        // 1. Date
        if (editingOrder.date !== date) {
          const oldDateFormatted = formatDate(editingOrder.date);
          const newDateFormatted = formatDate(date);
          changes.push({
            field: language === 'ar' ? 'التاريخ' : 'Date',
            old_value: oldDateFormatted,
            new_value: newDateFormatted
          });
          detailsList.push(language === 'ar' ? `تغيير التاريخ من ${oldDateFormatted} إلى ${newDateFormatted}` : `Date changed from ${oldDateFormatted} to ${newDateFormatted}`);
        }

        // 2. Customer
        if (editingOrder.customer_id !== selectedCustomerId) {
          const oldCustomer = customers.find(c => c.id === editingOrder.customer_id)?.name || editingOrder.customer_name || editingOrder.customer_id;
          const newCustomer = customers.find(c => c.id === selectedCustomerId)?.name || selectedCustomerId;
          changes.push({
            field: language === 'ar' ? 'العميل' : 'Customer',
            old_value: oldCustomer,
            new_value: newCustomer
          });
          detailsList.push(language === 'ar' ? `تغيير العميل من ${oldCustomer} إلى ${newCustomer}` : `Customer changed from ${oldCustomer} to ${newCustomer}`);
        }

        // 3. Currency
        const oldCurrencyId = (editingOrder as any).currency_id || '';
        const newCurrencyId = selectedCurrencyId || '';
        if (oldCurrencyId !== newCurrencyId) {
          const oldCurr = companyCurrencies.find(c => c.id === oldCurrencyId)?.code || oldCurrencyId || 'EGP';
          const newCurr = companyCurrencies.find(c => c.id === newCurrencyId)?.code || newCurrencyId || 'EGP';
          changes.push({
            field: language === 'ar' ? 'العملة' : 'Currency',
            old_value: oldCurr,
            new_value: newCurr
          });
          detailsList.push(language === 'ar' ? `تغيير العملة من ${oldCurr} إلى ${newCurr}` : `Currency changed from ${oldCurr} to ${newCurr}`);
        }

        // 4. Exchange Rate
        const oldRate = Number((editingOrder as any).exchange_rate) || 1;
        const newRate = Number(exchangeRate) || 1;
        if (oldRate !== newRate) {
          changes.push({
            field: language === 'ar' ? 'سعر الصرف' : 'Exchange Rate',
            old_value: oldRate,
            new_value: newRate
          });
          detailsList.push(language === 'ar' ? `تغيير سعر الصرف من ${oldRate} إلى ${newRate}` : `Exchange rate changed from ${oldRate} to ${newRate}`);
        }

        // 5. Discount
        const oldDiscount = Number(editingOrder.discount_amount) || 0;
        const newDiscount = Number(discount_amount) || 0;
        if (oldDiscount !== newDiscount) {
          changes.push({
            field: language === 'ar' ? 'الخصم' : 'Discount',
            old_value: oldDiscount,
            new_value: newDiscount
          });
          detailsList.push(language === 'ar' ? `تغيير الخصم من ${oldDiscount} إلى ${newDiscount}` : `Discount changed from ${oldDiscount} to ${newDiscount}`);
        }

        // 6. Tax
        const oldTax = Number(editingOrder.tax_amount) || 0;
        const newTax = Number(vatTotal) || 0;
        if (oldTax !== newTax) {
          changes.push({
            field: language === 'ar' ? 'الضريبة' : 'Tax',
            old_value: oldTax,
            new_value: newTax
          });
          detailsList.push(language === 'ar' ? `تغيير قيمة الضريبة من ${oldTax} إلى ${newTax}` : `Tax amount changed from ${oldTax} to ${newTax}`);
        }

        // 7. Total Amount
        const oldTotal = Number(editingOrder.total_amount) || 0;
        const newTotal = Number(total_amount) || 0;
        if (oldTotal !== newTotal) {
          changes.push({
            field: language === 'ar' ? 'إجمالي الأمر' : 'Total Amount',
            old_value: oldTotal,
            new_value: newTotal
          });
          detailsList.push(language === 'ar' ? `تغيير الإجمالي من ${oldTotal} إلى ${newTotal}` : `Total amount changed from ${oldTotal} to ${newTotal}`);
        }

        // 8. Description
        const oldDesc = editingOrder.description || '';
        const newDesc = description || '';
        if (oldDesc !== newDesc) {
          changes.push({
            field: language === 'ar' ? 'الوصف' : 'Description',
            old_value: oldDesc || (language === 'ar' ? 'فارغ' : 'Empty'),
            new_value: newDesc || (language === 'ar' ? 'فارغ' : 'Empty')
          });
          detailsList.push(language === 'ar' ? `تعديل وصف الأمر` : `Description updated`);
        }

        // 9. Items Diff
        const oldItems = editingOrder.items || [];
        const newItems = sanitizedItems;

        // Check for deleted items
        oldItems.forEach(oldItem => {
          const stillExists = newItems.some(newItem => newItem.product_id === oldItem.product_id);
          if (!stillExists) {
            changes.push({
              field: language === 'ar' ? 'حذف صنف' : 'Delete Product',
              old_value: `${oldItem.product_name} (${oldItem.quantity} × ${oldItem.unit_price})`,
              new_value: language === 'ar' ? 'تم الحذف' : 'Deleted'
            });
            detailsList.push(language === 'ar' ? `حذف الصنف: ${oldItem.product_name}` : `Deleted product: ${oldItem.product_name}`);
          }
        });

        // Check for added items
        newItems.forEach(newItem => {
          const wasPresent = oldItems.some(oldItem => oldItem.product_id === newItem.product_id);
          if (!wasPresent) {
            changes.push({
              field: language === 'ar' ? 'إضافة صنف' : 'Add Product',
              old_value: language === 'ar' ? 'جديد' : 'New',
              new_value: `${newItem.product_name} (${newItem.quantity} × ${newItem.unit_price})`
            });
            detailsList.push(language === 'ar' ? `إضافة صنف جديد: ${newItem.product_name}` : `Added new product: ${newItem.product_name}`);
          }
        });

        // Check for modified items
        newItems.forEach(newItem => {
          const oldItem = oldItems.find(oi => oi.product_id === newItem.product_id);
          if (oldItem) {
            const qtyChanged = Number(oldItem.quantity) !== Number(newItem.quantity);
            const priceChanged = Number(oldItem.unit_price) !== Number(newItem.unit_price);
            const opChanged = (oldItem as any).operation_id !== newItem.operation_id;
            const ccChanged = (oldItem as any).cost_center_id !== newItem.cost_center_id;
            const deptChanged = (oldItem as any).department_id !== newItem.department_id;

            if (qtyChanged || priceChanged || opChanged || ccChanged || deptChanged) {
              const diffParts: string[] = [];
              if (qtyChanged) diffParts.push(language === 'ar' ? `الكمية من ${oldItem.quantity} إلى ${newItem.quantity}` : `Qty from ${oldItem.quantity} to ${newItem.quantity}`);
              if (priceChanged) diffParts.push(language === 'ar' ? `السعر من ${oldItem.unit_price} إلى ${newItem.unit_price}` : `Price from ${oldItem.unit_price} to ${newItem.unit_price}`);
              if (opChanged) {
                const oldOp = operations.find(o => o.id === (oldItem as any).operation_id)?.operation_number || '-';
                const newOp = operations.find(o => o.id === newItem.operation_id)?.operation_number || '-';
                diffParts.push(language === 'ar' ? `العملية من ${oldOp} إلى ${newOp}` : `Operation from ${oldOp} to ${newOp}`);
              }
              if (ccChanged) {
                const oldCc = costCenters.find(c => c.id === (oldItem as any).cost_center_id)?.name || '-';
                const newCc = costCenters.find(c => c.id === newItem.cost_center_id)?.name || '-';
                diffParts.push(language === 'ar' ? `مركز التكلفة من ${oldCc} إلى ${newCc}` : `Cost center from ${oldCc} to ${newCc}`);
              }
              if (deptChanged) {
                const oldDept = departments.find(d => d.id === (oldItem as any).department_id)?.name || '-';
                const newDept = departments.find(d => d.id === newItem.department_id)?.name || '-';
                diffParts.push(language === 'ar' ? `الإدارة من ${oldDept} إلى ${newDept}` : `Department from ${oldDept} to ${newDept}`);
              }
              
              changes.push({
                field: (language === 'ar' ? 'تعديل صنف: ' : 'Edit Product: ') + newItem.product_name,
                old_value: `${language === 'ar' ? 'الكمية:' : 'Qty:'} ${oldItem.quantity}، ${language === 'ar' ? 'السعر:' : 'Price:'} ${oldItem.unit_price}`,
                new_value: `${language === 'ar' ? 'الكمية:' : 'Qty:'} ${newItem.quantity}، ${language === 'ar' ? 'السعر:' : 'Price:'} ${newItem.unit_price} (${diffParts.join('، ')})`
              });
              detailsList.push(language === 'ar' ? `تعديل تفاصيل الصنف: ${newItem.product_name}` : `Updated details of product: ${newItem.product_name}`);
            }
          }
        });

        await dbService.update('sales_orders', editingOrder.id, orderData);
        if (changes.length > 0) {
          const logAction = language === 'ar' ? 'تعديل أمر بيع' : 'Update Sales Order';
          const logDetails = detailsList.join(' | ');
          await dbService.logActivity(
            user.id,
            user.username,
            user.company_id,
            logAction,
            logDetails || `${ot('order_updated')}: ${orderNumber}`,
            'sales_orders',
            editingOrder.id,
            changes
          );
        }
        showNotification(ot('order_updated'), 'success');
      } else {
        await dbService.add('sales_orders', orderData);
        await dbService.logActivity(user.id, user.username, user.company_id, ot('add_order'), `${ot('order_saved')}: ${orderNumber}`, 'sales_orders');
        showNotification(ot('order_saved'), 'success');
      }

      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      showNotification(err.message || 'Error saving order', 'error');
    }
  };

  const filteredOrders = orders.filter(o => 
    o.order_number.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (o.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentOrderCurrencyCode = selectedCurrencyId
    ? (companyCurrencies.find(c => c.id === selectedCurrencyId)?.code || '').toUpperCase()
    : (companyData?.settings?.currency || 'EGP').toUpperCase();

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500 gap-4">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
          <Lock size={40} />
        </div>
        <h3 className="text-xl font-bold">{language === 'ar' ? 'عذراً، ليس لديك صلاحية للوصول إلى هذه الصفحة' : 'Sorry, you do not have permission to view this page'}</h3>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir={dir}>
      {!isModalOpen ? (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 italic serif">{ot('title')}</h2>
              <p className="text-slate-500">{ot('subtitle')}</p>
              {serverSummary.total_amount !== undefined && (
                <div className="mt-2 flex items-center gap-4 text-sm">
                  <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100 font-bold">
                    {language === 'ar' ? 'إجمالي الأوامر:' : 'Total Orders:'} {formatMoney(serverSummary.total_amount)} {t('invoices.currency')}
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canCreate && (
                <button 
                  onClick={openModal}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
                >
                  <Plus size={20} />
                  {ot('add_order')}
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center gap-4">
              <div className="relative flex-1">
                <Search className={`absolute ${dir === 'rtl' ? 'left-3' : 'right-3'} top-3 text-slate-400`} size={18} />
                <input
                  type="text"
                  placeholder={ot('search_placeholder')}
                  className={`w-full ${dir === 'rtl' ? 'pl-10 pr-4' : 'pr-10 pl-4'} py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setView('table')}
                  className={`p-2 rounded-lg transition-all ${view === 'table' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <List size={18} />
                </button>
                <button
                  onClick={() => setView('card')}
                  className={`p-2 rounded-lg transition-all ${view === 'card' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <LayoutGrid size={18} />
                </button>
              </div>
            </div>

            {view === 'table' ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/50 text-slate-500 text-[10px] uppercase tracking-widest font-bold border-b border-slate-100">
                      <th className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'} cursor-pointer`} onClick={() => handleSort('order_number')}>{ot('column_number')}</th>
                      <th className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'} cursor-pointer`} onClick={() => handleSort('customer_name')}>{ot('column_customer')}</th>
                      <th className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'} cursor-pointer`} onClick={() => handleSort('date')}>{ot('column_date')}</th>
                      <th className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'} cursor-pointer`} onClick={() => handleSort('delivery_date')}>{ot('column_delivery_date')}</th>
                      <th className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{language === 'ar' ? 'البيان' : 'Description'}</th>
                      <th className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'} cursor-pointer`} onClick={() => handleSort('total_amount')}>{ot('column_amount')}</th>
                      <th className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{ot('column_status')}</th>
                      <th className={`px-6 py-4 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>{t('invoices.column_actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrders.map((ord) => (
                      <tr 
                        key={ord.id} 
                        className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                        onClick={() => canEdit && openEditModal(ord)}
                      >
                        <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                          <span className="font-mono text-xs bg-emerald-50 px-2 py-1 rounded text-emerald-700 font-bold border border-emerald-100">{ord.order_number}</span>
                        </td>
                        <td className={`px-6 py-4 font-bold text-slate-900 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{ord.customer_name}</td>
                        <td className={`px-6 py-4 text-slate-500 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{formatDate(ord.date)}</td>
                        <td className={`px-6 py-4 text-slate-500 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{ord.delivery_date ? formatDate(ord.delivery_date) : '-'}</td>
                        <td className={`px-6 py-4 text-slate-500 max-w-[200px] truncate ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{ord.description || '-'}</td>
                        <td className={`px-6 py-4 font-bold text-slate-900 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                          {formatMoney(ord.total_amount)} {((ord as any).currency_id ? (companyCurrencies.find(c => c.id === (ord as any).currency_id)?.code || '') : (companyData?.settings?.currency || 'EGP')).toUpperCase()}
                        </td>
                        <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                          {ord.status === 'converted' ? (
                            <span className="inline-flex flex-col">
                              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                                {ot('status_converted')}
                              </span>
                              <span className="text-[9px] text-emerald-600 font-mono mt-0.5">
                                {ord.invoice_number}
                              </span>
                            </span>
                          ) : (
                            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200">
                                {ot('status_pending')}
                            </span>
                          )}
                        </td>
                        <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>
                          <div className={`flex items-center ${dir === 'rtl' ? 'justify-start' : 'justify-end'} gap-2 opacity-0 group-hover:opacity-100 transition-opacity`}>
                            {ord.status !== 'converted' && (
                              <button 
                                onClick={(e) => handleConvertToInvoice(e, ord)}
                                className="p-2 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-all"
                                title={ot('convert_to_invoice')}
                              >
                                <ArrowUpRight size={18} />
                              </button>
                            )}
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewOrder(ord);
                              }}
                              className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                              title={language === 'ar' ? 'عرض' : 'View'}
                            >
                              <Eye size={18} />
                            </button>
                            {canEdit && ord.status !== 'converted' && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditModal(ord);
                                }}
                                className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                              >
                                <Pencil size={18} />
                              </button>
                            )}
                            {canDelete && ord.status !== 'converted' && (
                              <button 
                                onClick={(e) => handleDeleteClick(e, ord)}
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                              >
                                <Trash2 size={18} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                {filteredOrders.map((ord) => (
                  <div 
                    key={ord.id}
                    onClick={() => canEdit && openEditModal(ord)}
                    className="bg-slate-50 border border-slate-200 rounded-3xl p-6 hover:shadow-lg transition-all duration-300 hover:border-emerald-500/20 group cursor-pointer relative overflow-hidden"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <span className="font-mono text-xs bg-emerald-50 px-2 py-1 rounded text-emerald-700 font-bold border border-emerald-100">
                        {ord.order_number}
                      </span>
                      {ord.status === 'converted' ? (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                          {ot('status_converted')} ({ord.invoice_number})
                        </span>
                      ) : (
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                          {ot('status_pending')}
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-slate-900 text-lg mb-2">{ord.customer_name}</h4>
                    <p className="text-slate-500 text-sm mb-4 line-clamp-2">{ord.description || '-'}</p>
                    <div className="flex justify-between items-center pt-4 border-t border-slate-200/60 text-xs text-slate-500">
                      <span>{formatDate(ord.date)}</span>
                      <span className="font-bold text-slate-950 text-sm">
                        {formatMoney(ord.total_amount)} {((ord as any).currency_id ? (companyCurrencies.find(c => c.id === (ord as any).currency_id)?.code || '') : (companyData?.settings?.currency || 'EGP')).toUpperCase()}
                      </span>
                    </div>
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {ord.status !== 'converted' && (
                        <button 
                          onClick={(e) => handleConvertToInvoice(e, ord)}
                          className="bg-white p-1.5 rounded-lg shadow-sm border border-slate-100 hover:bg-emerald-50 text-emerald-600"
                        >
                          <ArrowUpRight size={14} />
                        </button>
                      )}
                      {canDelete && ord.status !== 'converted' && (
                        <button 
                          onClick={(e) => handleDeleteClick(e, ord)}
                          className="bg-white p-1.5 rounded-lg shadow-sm border border-slate-100 hover:bg-red-50 text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <PaginationControls
              page={page}
              limit={limit}
              total={totalRecords}
              onPageChange={setPage}
              onLimitChange={setLimit}
            />
          </div>
        </>
      ) : (
        /* Create/Edit Order Form Mode */
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-all"
              >
                <X size={20} />
              </button>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                {editingOrder ? ot('edit_order') : ot('add_order')}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-sm hidden md:inline-block"
              >
                {isFullScreen ? (language === 'ar' ? 'تصغير' : 'Minimize') : (language === 'ar' ? 'ملء الشاشة' : 'Full Screen')}
              </button>
              <button
                type="submit"
                className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
              >
                {language === 'ar' ? 'حفظ الحركات' : 'Save Order'}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {/* Combined Totals & Metadata Form single card layout */}
            <section className="bg-white p-2 md:p-2.5 rounded-xl border border-zinc-200 shadow-sm grid grid-cols-1 lg:grid-cols-4 gap-2 lg:gap-2.5 items-stretch">
              
              {/* Left: Summary Card Column */}
              <div className="flex flex-col justify-center space-y-1 p-0.5">
                <div className="flex items-center gap-1 mb-0.5 text-emerald-600">
                  <Layers className="w-3.5 h-3.5" />
                  <h2 className="font-semibold text-zinc-900 text-[10px]">{language === 'ar' ? 'ملخص الأمر' : 'Order Summary'}</h2>
                </div>

                <div className="bg-zinc-50 rounded-lg p-1.5 border border-zinc-100 space-y-0.5">
                  <div className="flex justify-between items-center text-zinc-650 text-[10px]">
                    <span className="font-medium">{ot('summary_subtotal')}</span>
                    <span className="font-bold text-[11px]">
                      {formatMoney(items.reduce((sum, i) => sum + (Number(i.total) || 0), 0))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-emerald-605 text-[10px]">
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{ot('summary_discount')}</span>
                      <input 
                        type="number" 
                        className="w-11 bg-white border border-zinc-200 rounded px-1 py-0.5 text-center font-bold text-emerald-600 focus:ring-1 focus:ring-emerald-500 outline-none text-[10px]"
                        value={Number(discount)}
                        onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <span className="font-bold text-[11px] text-red-500">-{formatMoney(discount)}</span>
                  </div>
                  {isVatEnabled && (
                    <div className="flex justify-between items-center text-zinc-650 text-[10px] pt-0.5 border-t border-dashed border-zinc-200">
                      <span className="font-medium">{language === 'ar' ? 'ضريبة القيمة المضافة' : 'VAT'}</span>
                      <span className="font-bold text-[11px]">
                        +{formatMoney(items.reduce((sum, i) => sum + (Number((i as any).vat_amount) || 0), 0))}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-emerald-600 text-[10px] pt-0.5 border-t border-zinc-200">
                    <span className="font-black text-[11px]">{ot('summary_total')}</span>
                    <div className="flex flex-col items-end">
                      <span className="font-black text-xs tracking-tighter text-left">
                        {formatMoney(
                          items.reduce((sum, i) => sum + (Number(i.total) || 0), 0) + 
                          (isVatEnabled ? items.reduce((sum, i) => sum + (Number((i as any).vat_amount) || 0), 0) : 0) - 
                          discount
                        )} {currentOrderCurrencyCode}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Unified Metadata & Settings Column */}
              <div className="lg:col-span-3 space-y-1 relative lg:border-s lg:border-zinc-150 lg:ps-2.5 flex flex-col justify-between">
                
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-1.5">
                  {/* 1. Date */}
                  <div>
                    <label className="block text-[9px] font-bold text-zinc-400 mb-0 px-0.5">{ot('column_date')}</label>
                    <input
                      required
                      type="date"
                      className="w-full px-1.5 py-0.5 rounded-md bg-zinc-50 border border-zinc-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 text-[11px]"
                      value={date}
                      onChange={(e) => {
                        setDate(e.target.value);
                        if (!editingOrder) {
                          generateOrderNumber(e.target.value).then(setOrderNumber);
                        }
                      }}
                    />
                  </div>

                  {/* 2. Expected Delivery Date */}
                  <div>
                    <label className="block text-[9px] font-bold text-zinc-400 mb-0 px-0.5">{ot('form_delivery_date')}</label>
                    <input
                      type="date"
                      className="w-full px-1.5 py-0.5 rounded-md bg-zinc-50 border border-zinc-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 text-[11px]"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                    />
                  </div>

                  {/* 3. Customer */}
                  <div className="col-span-1 md:col-span-2 lg:col-span-2">
                    <label className="block text-[9px] font-bold text-zinc-400 mb-0 px-0.5">{ot('form_customer')}</label>
                    <select 
                      required
                      className="w-full px-1.5 py-0.5 rounded-md bg-zinc-50 border border-zinc-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 text-[11px] cursor-pointer"
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                    >
                      <option value="">{language === 'ar' ? 'اختر العميل...' : 'Select Customer...'}</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  {/* 4. Warehouse */}
                  <div>
                    <label className="block text-[9px] font-bold text-zinc-400 mb-0 px-0.5">{language === 'ar' ? 'المخزن' : 'Warehouse'}</label>
                    <select 
                      className="w-full px-1.5 py-0.5 rounded-md bg-zinc-50 border border-zinc-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 text-[11px] cursor-pointer"
                      value={selectedWarehouseId}
                      onChange={(e) => setSelectedWarehouseId(e.target.value)}
                    >
                      <option value="">{language === 'ar' ? 'المخزن الرئيسي (تلقائي)' : 'Main Warehouse (Default)'}</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Second Row of metadata: Currency & Exchange Rate (if multi-currency is enabled) */}
                {isMultiCurrencyEnabled && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5 mt-1 pt-1 border-t border-zinc-100">
                    <div>
                      <label className="block text-[9px] font-bold text-zinc-400 mb-0 px-0.5 flex items-center gap-1">
                        <Coins size={10} className="text-amber-500" />
                        {language === 'ar' ? 'عملة الفاتورة' : 'Invoice Currency'}
                      </label>
                      <select 
                        className="w-full px-1.5 py-0.5 rounded-md border border-zinc-200 bg-zinc-50 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 text-[11px] cursor-pointer"
                        value={selectedCurrencyId}
                        onChange={(e) => handleCurrencyChange(e.target.value)}
                      >
                        {(() => {
                          const baseCode = (companyData?.settings?.currency || (companyData as any)?.currency || 'egp').toLowerCase();
                          const baseCurrInList = companyCurrencies.find(c => c.code.toLowerCase() === baseCode);
                          const baseCurrencyName = baseCurrInList 
                            ? (language === 'ar' ? baseCurrInList.name_ar : baseCurrInList.name_en) 
                            : (language === 'ar' ? 'العملة الأساسية' : 'Base Currency');
                          return (
                            <option value="">
                              {`${baseCurrencyName} (${(companyData?.settings?.currency || (companyData as any)?.currency || 'EGP').toUpperCase()})`}
                            </option>
                          );
                        })()}
                        {companyCurrencies.filter(c => (c.is_active || c.id === selectedCurrencyId) && c.code.toLowerCase() !== (companyData?.settings?.currency || (companyData as any)?.currency || 'egp').toLowerCase()).map(curr => (
                          <option key={curr.id} value={curr.id}>
                            {language === 'ar' ? `${curr.name_ar} (${curr.code})` : `${curr.name_en} (${curr.code})`}
                          </option>
                        ))}
                      </select>
                    </div>

                    {(() => {
                      const selectedCurr = companyCurrencies.find(c => c.id === selectedCurrencyId);
                      const baseCurrency = companyData?.settings?.currency || 'EGP';
                      const isForeign = selectedCurr && selectedCurr.code.toLowerCase() !== baseCurrency.toLowerCase();
                      
                      if (!isForeign) return null;

                      return (
                        <div>
                          <label className="block text-[9px] font-bold text-zinc-400 mb-0 px-0.5">
                            {language === 'ar' 
                              ? `سعر الصرف (${exchangeRateType === 'auto' ? 'تلقائي' : 'يدوي'})` 
                              : `Exchange Rate (${exchangeRateType === 'auto' ? 'Auto' : 'Manual'})`}
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0.000001"
                            className="w-full px-1.5 py-0.5 rounded-md border border-zinc-200 bg-zinc-50 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 text-[11px]"
                            value={exchangeRate}
                            onChange={(e) => {
                              setExchangeRate(Number(e.target.value) || 1);
                              setExchangeRateType('manual');
                            }}
                          />
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Third Row of metadata: Operation, Department, Cost Center */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5 mt-1 pt-1 border-t border-zinc-100">
                  {/* Operation input */}
                  <div>
                    <label className="block text-[9px] font-bold text-zinc-400 mb-0 px-0.5">{language === 'ar' ? 'العملية' : 'Operation'}</label>
                    <div className="flex items-center gap-1">
                      <div className="relative flex-1">
                        <input 
                          type="text" 
                          placeholder={language === 'ar' ? 'ابحث عن عملية...' : 'Search operation...'}
                          className="w-full px-1.5 py-0.5 rounded-md bg-zinc-50 border border-zinc-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 text-[11px]"
                          value={
                            activeSearch && activeSearch.index === -1 && activeSearch.type === 'operation'
                              ? activeSearch.query
                              : (operations.find(op => op.id === selectedOperationId)?.operation_number || '')
                          }
                          onChange={(e) => {
                            setActiveSearch(prev => prev ? { ...prev, query: e.target.value } : null);
                          }}
                          onFocus={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const dropdownWidth = 420;
                            let left = rect.left;
                            if (dir === 'rtl') {
                              left = rect.left + rect.width - dropdownWidth;
                            }
                            left = Math.max(10, Math.min(window.innerWidth - dropdownWidth - 10, left));
                            setActiveSearch({
                              index: -1,
                              type: 'operation',
                              query: operations.find(op => op.id === selectedOperationId)?.operation_number || ''
                            });
                            setPopoverRect({
                              top: rect.bottom,
                              left: left,
                              width: dropdownWidth
                            });
                          }}
                        />
                        {selectedOperationId && (
                          <button
                            type="button"
                            onClick={() => setSelectedOperationId('')}
                            className={`absolute ${dir === 'rtl' ? 'left-1.5' : 'right-1.5'} inset-y-0 flex items-center px-1 text-zinc-400 hover:text-red-500`}
                            title={language === 'ar' ? 'مسح' : 'Clear'}
                          >
                            <X size={10} />
                          </button>
                        )}
                      </div>
                      {selectedOperationId && (
                        <button
                          type="button"
                          onClick={() => applyOperationToAllItems()}
                          className="p-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded text-emerald-600 hover:text-emerald-700 transition-colors flex-shrink-0"
                          title={language === 'ar' ? 'تطبيق المختار على كافة الأصناف' : 'Apply to all items'}
                        >
                          <CheckCheck size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Department input */}
                  <div>
                    <label className="block text-[9px] font-bold text-zinc-400 mb-0 px-0.5">{language === 'ar' ? 'الإدارة' : 'Department'}</label>
                    <div className="flex items-center gap-1">
                      <div className="relative flex-1">
                        <input 
                          type="text" 
                          placeholder={language === 'ar' ? 'ابحث عن إدارة...' : 'Search department...'}
                          className="w-full px-1.5 py-0.5 rounded-md bg-zinc-50 border border-zinc-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 text-[11px]"
                          value={
                            activeSearch && activeSearch.index === -1 && activeSearch.type === 'department'
                              ? activeSearch.query
                              : (departments.find(d => d.id === selectedDepartmentId)?.name || '')
                          }
                          onChange={(e) => {
                            setActiveSearch(prev => prev ? { ...prev, query: e.target.value } : null);
                          }}
                          onFocus={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const dropdownWidth = 350;
                            let left = rect.left;
                            if (dir === 'rtl') {
                              left = rect.left + rect.width - dropdownWidth;
                            }
                            left = Math.max(10, Math.min(window.innerWidth - dropdownWidth - 10, left));
                            setActiveSearch({
                              index: -1,
                              type: 'department',
                              query: departments.find(d => d.id === selectedDepartmentId)?.name || ''
                            });
                            setPopoverRect({
                              top: rect.bottom,
                              left: left,
                              width: dropdownWidth
                            });
                          }}
                        />
                        {selectedDepartmentId && (
                          <button
                            type="button"
                            onClick={() => setSelectedDepartmentId('')}
                            className={`absolute ${dir === 'rtl' ? 'left-1.5' : 'right-1.5'} inset-y-0 flex items-center px-1 text-zinc-400 hover:text-red-500`}
                            title={language === 'ar' ? 'مسح' : 'Clear'}
                          >
                            <X size={10} />
                          </button>
                        )}
                      </div>
                      {selectedDepartmentId && (
                        <button
                          type="button"
                          onClick={() => applyDepartmentToAllItems()}
                          className="p-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded text-emerald-600 hover:text-emerald-700 transition-colors flex-shrink-0"
                          title={language === 'ar' ? 'تطبيق المختار على كافة الأصناف' : 'Apply to all items'}
                        >
                          <CheckCheck size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Cost Center input */}
                  <div>
                    <label className="block text-[9px] font-bold text-zinc-400 mb-0 px-0.5">{language === 'ar' ? 'مركز التكلفة' : 'Cost Center'}</label>
                    <div className="flex items-center gap-1">
                      <div className="relative flex-1">
                        <input 
                          type="text" 
                          placeholder={language === 'ar' ? 'ابحث عن مركز...' : 'Search cost center...'}
                          className="w-full px-1.5 py-0.5 rounded-md bg-zinc-50 border border-zinc-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 text-[11px]"
                          value={
                            activeSearch && activeSearch.index === -1 && activeSearch.type === 'cost_center'
                              ? activeSearch.query
                              : (costCenters.find(cc => cc.id === selectedCostCenterId)?.name || '')
                          }
                          onChange={(e) => {
                            setActiveSearch(prev => prev ? { ...prev, query: e.target.value } : null);
                          }}
                          onFocus={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const dropdownWidth = 350;
                            let left = rect.left;
                            if (dir === 'rtl') {
                              left = rect.left + rect.width - dropdownWidth;
                            }
                            left = Math.max(10, Math.min(window.innerWidth - dropdownWidth - 10, left));
                            setActiveSearch({
                              index: -1,
                              type: 'cost_center',
                              query: costCenters.find(cc => cc.id === selectedCostCenterId)?.name || ''
                            });
                            setPopoverRect({
                              top: rect.bottom,
                              left: left,
                              width: dropdownWidth
                            });
                          }}
                        />
                        {selectedCostCenterId && (
                          <button
                            type="button"
                            onClick={() => setSelectedCostCenterId('')}
                            className={`absolute ${dir === 'rtl' ? 'left-1.5' : 'right-1.5'} inset-y-0 flex items-center px-1 text-zinc-400 hover:text-red-500`}
                            title={language === 'ar' ? 'مسح' : 'Clear'}
                          >
                            <X size={10} />
                          </button>
                        )}
                      </div>
                      {selectedCostCenterId && (
                        <button
                          type="button"
                          onClick={() => applyCostCenterToAllItems()}
                          className="p-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded text-emerald-600 hover:text-emerald-700 transition-colors flex-shrink-0"
                          title={language === 'ar' ? 'تطبيق المختار على كافة الأصناف' : 'Apply to all items'}
                        >
                          <CheckCheck size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Description input */}
                <div className="pt-1 border-t border-zinc-100 mt-1">
                  <label className="block text-[9px] font-bold text-zinc-400 mb-0 px-0.5">{ot('form_description')}</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={language === 'ar' ? 'اكتب ملاحظات إضافية...' : 'Write notes here...'}
                    className="w-full px-3 py-0.5 rounded-md bg-zinc-50 border border-zinc-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-805 text-[11px]"
                  />
                </div>
              </div>
            </section>

            {/* Items Table Section */}
            <section className="bg-white p-2.5 rounded-xl border border-zinc-200 shadow-sm space-y-1.5">
              <div className="flex flex-row items-center justify-between gap-1.5 mb-1">
                <div className="flex items-center gap-1.5 text-emerald-600">
                  <Package className="w-3.5 h-3.5" />
                  <h2 className="font-semibold text-zinc-900 text-[11px]">{ot('form_items')}</h2>
                </div>

                <button 
                  type="button"
                  onClick={addEmptyRow}
                  className="px-2 py-0.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-all flex items-center gap-1 shadow-sm text-[10px]"
                >
                  <Plus size={10} />
                  {ot('add_item')}
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-zinc-200 overflow-hidden">
                <table className="w-full text-sm text-right border-collapse table-fixed min-w-[1300px]">
                  <thead>
                    <tr className="bg-zinc-100 border-b border-zinc-200 text-zinc-700 text-xs font-bold">
                      <th className="p-1 border-r border-zinc-200 text-right w-80 min-w-[320px]">{ot('column_product')}</th>
                      <th className="p-1 border-r border-zinc-200 text-center w-12">{language === 'ar' ? 'صورة' : 'Image'}</th>
                      <th className="p-1 border-r border-zinc-200 text-center w-24">{language === 'ar' ? 'باركود' : 'Barcode'}</th>
                      <th className="p-1 border-r border-zinc-200 text-center w-28">{language === 'ar' ? 'رقم عملية' : 'Operation No'}</th>
                      <th className="p-1 border-r border-zinc-200 text-center w-28">{language === 'ar' ? 'الإدارة' : 'Department'}</th>
                      <th className="p-1 border-r border-zinc-200 text-center w-28">{language === 'ar' ? 'مركز التكلفة' : 'Cost Center'}</th>
                      <th className="p-1 border-r border-zinc-200 text-center w-32">{language === 'ar' ? 'وصف الصنف' : 'Item Description'}</th>
                      <th className="p-1 border-r border-zinc-200 text-center w-16">{ot('column_quantity')}</th>
                      <th className="p-1 border-r border-zinc-200 text-center w-24">{ot('column_price')}</th>
                      {isVatEnabled && (
                        <th className="p-1 border-r border-zinc-200 text-center w-14">{language === 'ar' ? 'ض ق م' : 'VAT %'}</th>
                      )}
                      <th className="p-1 border-r border-zinc-200 text-center w-24">{ot('column_total')}</th>
                      <th className="p-1 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {items.map((item, index) => (
                      <tr key={index} className="group hover:bg-zinc-50 transition-colors">
                        <td className="p-0.5 border-b border-r border-zinc-200 w-80 min-w-[320px]">
                          <div className="relative">
                            <select 
                              className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-white rounded px-1.5 py-0.5 outline-none font-bold text-zinc-800 appearance-none transition-all text-xs"
                              value={item.product_id}
                              onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                            >
                              <option value="">{language === 'ar' ? 'اختر الصنف...' : 'Select Product...'}</option>
                              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-2' : 'right-2'} top-1.5 w-3.5 h-3.5 text-zinc-400 pointer-events-none`} />
                          </div>
                        </td>
                        <td className="p-0.5 border-b border-r border-zinc-200 w-12 text-center">
                          <div className="flex justify-center items-center">
                            {item.product_image_url || item.image_url ? (
                              <div className="relative group w-8 h-8">
                                <img src={item.product_image_url || item.image_url} alt="" className="w-full h-full object-cover rounded shadow-sm" referrerPolicy="no-referrer" />
                                <button 
                                  onClick={() => updateItem(index, 'image_url', '')}
                                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X size={8} />
                                </button>
                              </div>
                            ) : (
                              <label className="cursor-pointer p-1 bg-zinc-50 border border-zinc-200 border-dashed rounded hover:bg-zinc-100 transition-colors inline-block">
                                <ImageIcon size={14} className="text-zinc-400" />
                                <input 
                                  type="file" 
                                  className="hidden" 
                                  accept="image/*" 
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const reader = new FileReader();
                                      reader.onloadend = () => updateItem(index, 'image_url', reader.result as string);
                                      reader.readAsDataURL(file);
                                    }
                                  }} 
                                />
                              </label>
                            )}
                          </div>
                        </td>
                        <td className="p-0.5 border-b border-r border-zinc-200 w-24 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <input 
                              type="text" 
                              placeholder={language === 'ar' ? 'الباركود...' : 'Barcode...'}
                              className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-white rounded px-1.5 py-0.5 text-center font-bold text-xs text-zinc-800 outline-none transition-all font-mono"
                              value={item.barcode || ''}
                              onChange={(e) => updateItem(index, 'barcode', e.target.value)}
                            />
                            {item.barcode && (
                              <div className="bg-white p-0.5 rounded border border-zinc-100 shadow-sm scale-90">
                                <Barcode 
                                  value={item.barcode} 
                                  width={0.5} 
                                  height={10} 
                                  fontSize={4}
                                  margin={0}
                                />
                              </div>
                            )}
                          </div>
                        </td>
                        
                        {/* Operation No */}
                        <td className="p-0.5 border-b border-r border-zinc-200 w-28 text-center">
                          <div className="flex items-center gap-1 w-full relative">
                            <div className="relative flex-1">
                              <input 
                                type="text" 
                                placeholder={language === 'ar' ? 'ابحث عن عملية...' : 'Search operation...'}
                                className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-white rounded px-1.5 py-0.5 text-right font-bold text-xs text-zinc-800 outline-none transition-all"
                                value={
                                  activeSearch && activeSearch.index === index && activeSearch.type === 'operation'
                                    ? activeSearch.query
                                    : (operations.find(op => op.id === (item as any).operation_id)?.operation_number || '')
                                }
                                onChange={(e) => {
                                  setActiveSearch(prev => prev ? { ...prev, query: e.target.value } : null);
                                }}
                                onFocus={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const dropdownWidth = 420;
                                  let left = rect.left;
                                  if (dir === 'rtl') {
                                    left = rect.left + rect.width - dropdownWidth;
                                  }
                                  left = Math.max(10, Math.min(window.innerWidth - dropdownWidth - 10, left));
                                  setActiveSearch({
                                    index,
                                    type: 'operation',
                                    query: operations.find(op => op.id === (item as any).operation_id)?.operation_number || ''
                                  });
                                  setPopoverRect({
                                    top: rect.bottom,
                                    left: left,
                                    width: dropdownWidth
                                  });
                                }}
                              />
                              {(item as any).operation_id && (
                                <button
                                  type="button"
                                  onClick={() => updateItem(index, 'operation_id', '')}
                                  className={`absolute ${dir === 'rtl' ? 'left-1' : 'right-1'} inset-y-0 flex items-center px-1 text-zinc-400 hover:text-red-500`}
                                  title={language === 'ar' ? 'مسح' : 'Clear'}
                                >
                                  <X size={10} />
                                </button>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Department */}
                        <td className="p-0.5 border-b border-r border-zinc-200 w-28 text-center">
                          <div className="flex items-center gap-1 w-full relative">
                            <div className="relative flex-1">
                              <input 
                                type="text" 
                                placeholder={language === 'ar' ? 'ابحث عن إدارة...' : 'Search department...'}
                                className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-white rounded px-1.5 py-0.5 text-right font-bold text-xs text-zinc-800 outline-none transition-all"
                                value={
                                  activeSearch && activeSearch.index === index && activeSearch.type === 'department'
                                    ? activeSearch.query
                                    : (departments.find(d => d.id === (item as any).department_id)?.name || '')
                                }
                                onChange={(e) => {
                                  setActiveSearch(prev => prev ? { ...prev, query: e.target.value } : null);
                                }}
                                onFocus={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const dropdownWidth = 350;
                                  let left = rect.left;
                                  if (dir === 'rtl') {
                                    left = rect.left + rect.width - dropdownWidth;
                                  }
                                  left = Math.max(10, Math.min(window.innerWidth - dropdownWidth - 10, left));
                                  setActiveSearch({
                                    index,
                                    type: 'department',
                                    query: departments.find(d => d.id === (item as any).department_id)?.name || ''
                                  });
                                  setPopoverRect({
                                    top: rect.bottom,
                                    left: left,
                                    width: dropdownWidth
                                  });
                                }}
                              />
                              {(item as any).department_id && (
                                <button
                                  type="button"
                                  onClick={() => updateItem(index, 'department_id', '')}
                                  className={`absolute ${dir === 'rtl' ? 'left-1' : 'right-1'} inset-y-0 flex items-center px-1 text-zinc-400 hover:text-red-500`}
                                  title={language === 'ar' ? 'مسح' : 'Clear'}
                                >
                                  <X size={10} />
                                </button>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Cost Center */}
                        <td className="p-0.5 border-b border-r border-zinc-200 w-28 text-center">
                          <div className="flex items-center gap-1 w-full relative">
                            <div className="relative flex-1">
                              <input 
                                type="text" 
                                placeholder={language === 'ar' ? 'ابحث عن مركز...' : 'Search cost center...'}
                                className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-white rounded px-1.5 py-0.5 text-right font-bold text-xs text-zinc-800 outline-none transition-all"
                                value={
                                  activeSearch && activeSearch.index === index && activeSearch.type === 'cost_center'
                                    ? activeSearch.query
                                    : (costCenters.find(cc => cc.id === (item as any).cost_center_id)?.name || '')
                                }
                                onChange={(e) => {
                                  setActiveSearch(prev => prev ? { ...prev, query: e.target.value } : null);
                                }}
                                onFocus={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const dropdownWidth = 350;
                                  let left = rect.left;
                                  if (dir === 'rtl') {
                                    left = rect.left + rect.width - dropdownWidth;
                                  }
                                  left = Math.max(10, Math.min(window.innerWidth - dropdownWidth - 10, left));
                                  setActiveSearch({
                                    index,
                                    type: 'cost_center',
                                    query: costCenters.find(cc => cc.id === (item as any).cost_center_id)?.name || ''
                                  });
                                  setPopoverRect({
                                    top: rect.bottom,
                                    left: left,
                                    width: dropdownWidth
                                  });
                                }}
                              />
                              {(item as any).cost_center_id && (
                                <button
                                  type="button"
                                  onClick={() => updateItem(index, 'cost_center_id', '')}
                                  className={`absolute ${dir === 'rtl' ? 'left-1' : 'right-1'} inset-y-0 flex items-center px-1 text-zinc-400 hover:text-red-500`}
                                  title={language === 'ar' ? 'مسح' : 'Clear'}
                                >
                                  <X size={10} />
                                </button>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Item description */}
                        <td className="p-0.5 border-b border-r border-zinc-200 w-32 text-center">
                          <input 
                            type="text" 
                            placeholder={language === 'ar' ? 'وصف الصنف...' : 'Item description...'}
                            className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-white rounded px-1.5 py-0.5 text-right font-bold text-xs text-zinc-800 outline-none transition-all animate-none"
                            value={(item as any).description || ''}
                            onChange={(e) => updateItem(index, 'description', e.target.value)}
                          />
                        </td>

                        {/* Quantity */}
                        <td className="p-0.5 border-b border-r border-zinc-200 w-16">
                          <input 
                            type="number" 
                            className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-white rounded px-1.5 py-0.5 text-center font-black text-zinc-900 outline-none transition-all text-xs"
                            value={item.quantity !== undefined && item.quantity !== null ? Number(item.quantity) : ''}
                            onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                          />
                        </td>

                        {/* Unit Price */}
                        <td className="p-0.5 border-b border-r border-zinc-200 w-24">
                          <input 
                            type="text" 
                            className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-white rounded px-1.5 py-0.5 text-center font-bold text-zinc-800 outline-none transition-all text-xs font-mono font-bold"
                            value={focusedPriceIndex === index ? tempPriceValue : formatMoney(item.unit_price)}
                            onFocus={() => {
                              setFocusedPriceIndex(index);
                              setTempPriceValue(item.unit_price ? String(item.unit_price) : '');
                            }}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (/^\d*\.?\d*$/.test(val)) {
                                setTempPriceValue(val);
                                updateItem(index, 'unit_price', parseFloat(val) || 0);
                              }
                            }}
                            onBlur={() => {
                              setFocusedPriceIndex(null);
                            }}
                          />
                        </td>

                        {/* VAT% (optional) */}
                        {isVatEnabled && (
                          <td className="p-0.5 border-b border-r border-zinc-200 w-14">
                            <div className="flex items-center justify-center gap-0.5">
                              <input 
                                type="number" 
                                min={0}
                                max={100}
                                className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-white rounded px-1 py-0.5 text-center font-black text-zinc-900 outline-none transition-all text-xs"
                                value={(item as any).vat_rate !== undefined && (item as any).vat_rate !== null ? Number((item as any).vat_rate) : 0}
                                onChange={(e) => updateItem(index, 'vat_rate', parseFloat(e.target.value) || 0)}
                              />
                              <span className="text-sm text-zinc-900 font-black">%</span>
                            </div>
                          </td>
                        )}

                        {/* Total */}
                        <td className="p-0.5 border-b border-r border-zinc-200 w-24 text-center font-bold text-emerald-600 text-xs">
                          {formatMoney(item.total)}
                        </td>

                        {/* Delete Row button */}
                        <td className="p-0.5 border-b border-zinc-200 w-10 text-center">
                          <button 
                            type="button"
                            onClick={() => removeItem(index)}
                            className="p-1 text-zinc-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr>
                        <td colSpan={isVatEnabled ? 12 : 11} className="px-3 py-6 text-center text-zinc-400 italic text-xs">
                          {t('common.no_items')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Bottom Activity Logs Section */}
            {showSidePanel && (
              <div className="bg-white rounded-xl border border-zinc-200 mt-2 shadow-sm overflow-hidden animate-in slide-in-from-bottom-2 duration-300">
                <div className="p-2 border-b border-zinc-150 flex items-center justify-between bg-zinc-50/50">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setIsPanelExpanded(!isPanelExpanded); }}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-200/50"
                    >
                      {isPanelExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <History size={16} className="text-emerald-600 animate-pulse" />
                      <span>{ot('title_activity_log')}</span>
                    </h3>
                  </div>
                  <button 
                    type="button" 
                    onClick={(e) => { e.stopPropagation(); setShowSidePanel(false); }} 
                    className="p-1.5 text-slate-400 hover:text-slate-650 hover:bg-slate-200/50 rounded-lg transition-all"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isPanelExpanded ? 'max-h-[1200px] border-t border-zinc-200' : 'max-h-0'}`}>
                  <TransactionSidePanel 
                    documentId={editingOrder?.id || ''} 
                    category="sales_orders" 
                    previewActivityLog={previewActivityLog}
                    layout="bottom"
                    previewItems={items}
                    currencyCode={currentOrderCurrencyCode}
                    exchangeRate={Number(exchangeRate) || 1}
                  />
                </div>
              </div>
            )}

            {!showSidePanel && (
              <div className="mt-6 pt-4 border-t border-zinc-100 flex items-center justify-start">
                <button 
                  type="button"
                  onClick={() => { setShowSidePanel(true); setIsPanelExpanded(true); }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm bg-white text-slate-700 border-slate-200 hover:bg-zinc-50"
                >
                  <History size={14} />
                  <span>{ot('show_activity_log')}</span>
                </button>
              </div>
            )}

            {/* Floating Autocomplete Popover */}
            {activeSearch && popoverRect && (
              <>
                <div 
                  className="fixed inset-0 z-[100]" 
                  onClick={() => setActiveSearch(null)} 
                />
                <div 
                  className="fixed z-[110] bg-white rounded-xl border border-zinc-200 shadow-2xl overflow-y-auto text-xs text-right scrollbar-thin scrollbar-thumb-zinc-300"
                  style={{
                    top: popoverRect.top,
                    left: popoverRect.left,
                    width: popoverRect.width,
                    maxHeight: '260px',
                  }}
                >
                  {activeSearch.type === 'operation' && (() => {
                    const filtered = operations.filter(op => {
                      const q = activeSearch.query.toLowerCase().trim();
                      if (!q) return true;
                      return (
                        (op.operation_number || '').toLowerCase().includes(q) ||
                        (op.customer_name || '').toLowerCase().includes(q) ||
                        (op.description || '').toLowerCase().includes(q)
                      );
                    });
                    return (
                      <table className="w-full text-right border-collapse">
                        <thead>
                          <tr className="bg-zinc-100 border-b border-zinc-200 text-zinc-600 font-bold text-[10px] sticky top-0 z-10">
                            <th className="p-2 text-right">{language === 'ar' ? 'رقم العملية' : 'Op Number'}</th>
                            <th className="p-2 text-right">{language === 'ar' ? 'العميل' : 'Customer'}</th>
                            <th className="p-2 text-right">{language === 'ar' ? 'التفاصيل' : 'Details'}</th>
                            <th className="p-2 text-center">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                            <th className="p-2 text-center">{language === 'ar' ? 'الحالة' : 'Status'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {filtered.map(op => (
                            <tr 
                              key={op.id} 
                              onClick={() => {
                                if (activeSearch.index === -1) {
                                  setSelectedOperationId(op.id);
                                  if (op.department_id) {
                                    setSelectedDepartmentId(op.department_id);
                                  }
                                  if (op.cost_center_id) {
                                    setSelectedCostCenterId(op.cost_center_id);
                                  }
                                } else {
                                  updateItem(activeSearch.index, 'operation_id', op.id);
                                }
                                setActiveSearch(null);
                              }}
                              className="hover:bg-emerald-50 cursor-pointer transition-colors"
                            >
                              <td className="p-2 font-bold text-zinc-900">{op.operation_number || 'N/A'}</td>
                              <td className="p-2 text-zinc-650 font-bold">{op.customer_name || '-'}</td>
                              <td className="p-2 text-zinc-550 truncate max-w-[120px]" title={op.description}>{op.description || '-'}</td>
                              <td className="p-2 text-center text-zinc-500 font-mono">{op.operation_date || op.date || '-'}</td>
                              <td className="p-2 text-center">
                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${op.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                  {op.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {filtered.length === 0 && (
                            <tr>
                              <td colSpan={5} className="p-4 text-center text-zinc-400 italic">
                                {language === 'ar' ? 'لا توجد نتائج' : 'No results found'}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    );
                  })()}

                  {activeSearch.type === 'department' && (() => {
                    const filtered = departments.filter(d => {
                      const q = activeSearch.query.toLowerCase().trim();
                      if (!q) return true;
                      return (
                        (d.code || '').toLowerCase().includes(q) ||
                        (d.name || '').toLowerCase().includes(q) ||
                        (d.description || '').toLowerCase().includes(q)
                      );
                    });
                    return (
                      <table className="w-full text-right border-collapse">
                        <thead>
                          <tr className="bg-zinc-100 border-b border-zinc-200 text-zinc-600 font-bold text-[10px] sticky top-0 z-10">
                            <th className="p-2 text-right">{language === 'ar' ? 'الكود' : 'Code'}</th>
                            <th className="p-2 text-right">{language === 'ar' ? 'الاسم' : 'Name'}</th>
                            <th className="p-2 text-right">{language === 'ar' ? 'الوصف' : 'Description'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 font-mono">
                          {filtered.map(d => (
                            <tr 
                              key={d.id} 
                              onClick={() => {
                                if (activeSearch.index === -1) {
                                  setSelectedDepartmentId(d.id);
                                } else {
                                  updateItem(activeSearch.index, 'department_id', d.id);
                                }
                                setActiveSearch(null);
                              }}
                              className="hover:bg-emerald-50 cursor-pointer transition-colors"
                            >
                              <td className="p-2 font-bold text-zinc-900">{d.code || 'N/A'}</td>
                              <td className="p-2 text-zinc-700 font-bold">{d.name || '-'}</td>
                              <td className="p-2 text-zinc-550 truncate max-w-[120px]" title={d.description}>{d.description || '-'}</td>
                            </tr>
                          ))}
                          {filtered.length === 0 && (
                            <tr>
                              <td colSpan={3} className="p-4 text-center text-zinc-400 italic">
                                {language === 'ar' ? 'لا توجد نتائج' : 'No results found'}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    );
                  })()}

                  {activeSearch.type === 'cost_center' && (() => {
                    const filtered = costCenters.filter(cc => {
                      const q = activeSearch.query.toLowerCase().trim();
                      if (!q) return true;
                      return (
                        (cc.code || '').toLowerCase().includes(q) ||
                        (cc.name || '').toLowerCase().includes(q) ||
                        (cc.description || '').toLowerCase().includes(q)
                      );
                    });
                    return (
                      <table className="w-full text-right border-collapse">
                        <thead>
                          <tr className="bg-zinc-100 border-b border-zinc-200 text-zinc-600 font-bold text-[10px] sticky top-0 z-10">
                            <th className="p-2 text-right">{language === 'ar' ? 'الكود' : 'Code'}</th>
                            <th className="p-2 text-right">{language === 'ar' ? 'الاسم' : 'Name'}</th>
                            <th className="p-2 text-right">{language === 'ar' ? 'الوصف' : 'Description'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 font-mono">
                          {filtered.map(cc => (
                            <tr 
                              key={cc.id} 
                              onClick={() => {
                                if (activeSearch.index === -1) {
                                  setSelectedCostCenterId(cc.id);
                                } else {
                                  updateItem(activeSearch.index, 'cost_center_id', cc.id);
                                }
                                setActiveSearch(null);
                              }}
                              className="hover:bg-emerald-50 cursor-pointer transition-colors"
                            >
                              <td className="p-2 font-bold text-zinc-900">{cc.code || 'N/A'}</td>
                              <td className="p-2 text-zinc-700 font-bold">{cc.name || '-'}</td>
                              <td className="p-2 text-zinc-550 truncate max-w-[120px]" title={cc.description}>{cc.description || '-'}</td>
                            </tr>
                          ))}
                          {filtered.length === 0 && (
                            <tr>
                              <td colSpan={3} className="p-4 text-center text-zinc-400 italic">
                                {language === 'ar' ? 'لا توجد نتائج' : 'No results found'}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
              </>
            )}
          </div>
        </form>
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-6"
            >
              <div className="flex items-center gap-3 text-red-600">
                <Trash2 className="w-8 h-8" />
                <h3 className="text-xl font-bold">{ot('delete_order')}</h3>
              </div>
              <p className="text-slate-600 text-sm leading-relaxed">{ot('delete_confirm')}</p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-xs hover:bg-slate-50 transition-all text-slate-500"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-6 py-2 bg-red-600 text-white rounded-xl font-bold text-xs hover:bg-red-700 transition-all active:scale-95 shadow-md shadow-red-500/10"
                >
                  {language === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View Detail Drawer/Modal */}
      <AnimatePresence>
        {viewOrder && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-end">
            <motion.div
              initial={{ x: dir === 'rtl' ? -500 : 500 }}
              animate={{ x: 0 }}
              exit={{ x: dir === 'rtl' ? -500 : 500 }}
              transition={{ type: 'spring', damping: 25 }}
              className="bg-slate-50 w-full max-w-5xl h-full flex flex-col shadow-2xl relative"
            >
              {/* Drawer Header */}
              <div className="bg-white p-6 border-b border-slate-200 flex items-center justify-between no-print">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setViewOrder(null)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-all"
                  >
                    <X size={20} />
                  </button>
                  <h3 className="text-xl font-bold text-slate-900">{ot('view_order')}</h3>
                </div>
                <div className="flex gap-2">
                  {viewOrder.status !== 'converted' && (
                    <button
                      onClick={(e) => {
                        handleConvertToInvoice(e, viewOrder);
                        setViewOrder(null);
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700"
                    >
                      <ArrowUpRight size={16} />
                      {ot('convert_to_invoice')}
                    </button>
                  )}
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-200"
                  >
                    <Printer size={16} />
                    {language === 'ar' ? 'طباعة' : 'Print'}
                  </button>
                  <button
                    onClick={() => handleExportOrderPDF(viewOrder)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-200"
                  >
                    <Download size={16} />
                    PDF
                  </button>
                </div>
              </div>

              {/* Printable Area */}
              <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row h-full">
                <div ref={orderRef} id="order-capture-area" className="flex-1 p-8 bg-white overflow-y-auto" style={{ color: '#18181b' }}>
                  <div className="max-w-3xl mx-auto space-y-8">
                    {/* Company Invoice Header Component */}
                    <CompanyInvoiceHeader 
                      company={companyData} 
                      documentNumber={viewOrder.order_number}
                      documentDate={formatDate(viewOrder.date)}
                      title={ot('order')}
                    />

                    <div className="grid grid-cols-2 gap-8 text-sm">
                      <div className="space-y-2">
                        <h4 className="text-slate-400 font-bold uppercase tracking-tight text-xs">{ot('order_to')}</h4>
                        <p className="font-bold text-slate-900 text-lg">{viewOrder.customer_name}</p>
                        {viewOrder.customer_id && (
                          <p className="text-xs text-slate-500 font-medium">{language === 'ar' ? 'كود العميل:' : 'Customer Code:'} {viewOrder.customer_id.slice(-6).toUpperCase()}</p>
                        )}
                        {(viewOrder as any).currency_id && (
                          <p className="text-xs text-slate-500 font-medium">
                            {language === 'ar' ? 'العملة:' : 'Currency:'} <span className="text-emerald-600 font-bold">{companyCurrencies.find(c => c.id === (viewOrder as any).currency_id)?.code || (viewOrder as any).currency_id}</span>
                          </p>
                        )}
                      </div>
                      <div className="space-y-3 justify-self-end text-left">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-bold text-slate-900 font-mono">{viewOrder.order_number}</span>
                          <span className="text-slate-400 font-bold uppercase text-xs">{ot('column_number')}</span>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-slate-600">{formatDate(viewOrder.date)}</span>
                          <span className="text-slate-400 font-bold uppercase text-xs">{ot('column_date')}</span>
                        </div>
                        {viewOrder.delivery_date && (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-slate-600">{formatDate(viewOrder.delivery_date)}</span>
                            <span className="text-slate-400 font-bold uppercase text-xs">{ot('column_delivery_date')}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-end gap-2">
                          {viewOrder.status === 'converted' ? (
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              {ot('status_converted')} - {viewOrder.invoice_number}
                            </span>
                          ) : (
                            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              {ot('status_pending')}
                            </span>
                          )}
                          <span className="text-slate-400 font-bold uppercase text-xs">{ot('column_status')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Items List Table */}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-2 border-slate-900 text-slate-400 text-xs font-bold pb-2">
                          <th className={`pb-2 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{ot('column_product')}</th>
                          <th className="pb-2 text-center w-24">{language === 'ar' ? 'العملية' : 'Operation'}</th>
                          <th className="pb-2 text-center w-24">{language === 'ar' ? 'الإدارة' : 'Department'}</th>
                          <th className="pb-2 text-center w-24">{language === 'ar' ? 'مركز التكلفة' : 'Cost Center'}</th>
                          <th className="pb-2 text-center w-24 font-mono">{ot('column_quantity')}</th>
                          <th className="pb-2 text-center w-32">{ot('column_price')}</th>
                          {isVatEnabled && <th className="pb-2 text-center w-24">{language === 'ar' ? 'ضريبة' : 'VAT'}</th>}
                          <th className={`pb-2 ${dir === 'rtl' ? 'text-left' : 'text-right'} w-32`}>{ot('column_total')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(viewOrder.items || []).map((item, idx) => {
                          const opNumber = operations.find(o => o.id === (item as any).operation_id)?.operation_number || '-';
                          const deptName = departments.find(d => d.id === (item as any).department_id)?.name || '-';
                          const ccName = costCenters.find(c => c.id === (item as any).cost_center_id)?.name || '-';
                          const currencyCode = (viewOrder as any).currency_id
                            ? (companyCurrencies.find(c => c.id === (viewOrder as any).currency_id)?.code || '').toUpperCase()
                            : (companyData?.settings?.currency || 'EGP').toUpperCase();
                          return (
                            <tr key={idx}>
                              <td className="py-4">
                                <p className="font-bold text-slate-900">{item.product_name}</p>
                                {item.product_code && <p className="text-xs text-slate-500 font-mono">{item.product_code}</p>}
                                {(item as any).description && <p className="text-[10px] text-slate-450 italic">{(item as any).description}</p>}
                              </td>
                              <td className="py-4 text-center font-bold text-slate-700">{opNumber}</td>
                              <td className="py-4 text-center text-slate-600">{deptName}</td>
                              <td className="py-4 text-center text-slate-600">{ccName}</td>
                              <td className="py-4 text-center font-mono">{item.quantity}</td>
                              <td className="py-4 text-center font-mono">{formatMoney(item.unit_price)} {currencyCode}</td>
                              {isVatEnabled && (
                                <td className="py-4 text-center font-mono">
                                  {Number((item as any).vat_rate || 0)}% ({formatMoney((item as any).vat_amount || 0)})
                                </td>
                              )}
                              <td className={`py-4 ${dir === 'rtl' ? 'text-left' : 'text-right'} font-mono font-bold text-slate-900`}>
                                {formatMoney(item.total)} {currencyCode}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Total Calculations */}
                    <div className="grid grid-cols-2 pt-6 border-t-2 border-slate-900">
                      <div>
                        {viewOrder.description && (
                          <div className="bg-slate-50 rounded-2xl p-4 text-xs text-slate-650 leading-relaxed border border-slate-100">
                            <h5 className="font-bold text-slate-900 mb-1">{language === 'ar' ? 'البيان / الشروط:' : 'Description / Terms:'}</h5>
                            <p>{viewOrder.description}</p>
                          </div>
                        )}
                      </div>
                      <div className="divide-y divide-slate-100 text-xs justify-self-end w-72">
                        <div className="py-3 flex justify-between">
                          <span className="text-slate-500">{ot('summary_subtotal')}</span>
                          <span className="font-bold text-slate-900 font-mono">{formatMoney(viewOrder.subtotal || 0)} {((viewOrder as any).currency_id ? (companyCurrencies.find(c => c.id === (viewOrder as any).currency_id)?.code || '') : (companyData?.settings?.currency || 'EGP')).toUpperCase()}</span>
                        </div>
                        {isVatEnabled && viewOrder.tax_amount !== undefined && viewOrder.tax_amount > 0 && (
                          <div className="py-3 flex justify-between text-zinc-650">
                            <span>{language === 'ar' ? 'ضريبة القيمة المضافة' : 'VAT'}</span>
                            <span className="font-bold font-mono">+{formatMoney(viewOrder.tax_amount)} {((viewOrder as any).currency_id ? (companyCurrencies.find(c => c.id === (viewOrder as any).currency_id)?.code || '') : (companyData?.settings?.currency || 'EGP')).toUpperCase()}</span>
                          </div>
                        )}
                        {viewOrder.discount_amount !== undefined && viewOrder.discount_amount > 0 && (
                          <div className="py-3 flex justify-between text-red-650">
                            <span>{ot('summary_discount')}</span>
                            <span className="font-bold font-mono">-{formatMoney(viewOrder.discount_amount)} {((viewOrder as any).currency_id ? (companyCurrencies.find(c => c.id === (viewOrder as any).currency_id)?.code || '') : (companyData?.settings?.currency || 'EGP')).toUpperCase()}</span>
                          </div>
                        )}
                        <div className="py-4 flex justify-between text-sm font-bold text-emerald-800 bg-emerald-50 -mx-4 px-4 rounded-b-xl">
                          <span>{ot('summary_total')}</span>
                          <span className="font-mono">{formatMoney(viewOrder.total_amount)} {((viewOrder as any).currency_id ? (companyCurrencies.find(c => c.id === (viewOrder as any).currency_id)?.code || '') : (companyData?.settings?.currency || 'EGP')).toUpperCase()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Seal and Signature Block */}
                    <div className="pt-12 grid grid-cols-2 text-center text-xs font-bold text-slate-400">
                      <div>
                        <p className="mb-12">{language === 'ar' ? 'توقيع المستلم' : 'Receiver Signature'}</p>
                        <div className="border-b border-dashed border-slate-300 w-32 mx-auto"></div>
                      </div>
                      <div>
                        <p className="mb-12">{language === 'ar' ? 'توقيع المسؤول' : 'Authorized Signature'}</p>
                        <div className="border-b border-dashed border-slate-300 w-32 mx-auto"></div>
                      </div>
                    </div>

                    {/* Barcode representation */}
                    <div className="pt-8 flex flex-col items-center justify-center gap-1 border-t border-slate-100">
                      <Barcode
                        value={viewOrder.order_number}
                        width={1.2}
                        height={40}
                        displayValue={false}
                      />
                      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">{viewOrder.order_number}</span>
                    </div>
                  </div>
                </div>

                {/* Right Inline Activity Log Panel */}
                <div className="hidden lg:block w-80 border-r border-slate-100 bg-slate-50/30">
                  <InlineActivityLog category="sales_orders" documentId={viewOrder.id} />
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
