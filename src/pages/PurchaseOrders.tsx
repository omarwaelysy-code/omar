import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { PurchaseOrder, Supplier, Product, PurchaseOrderItem, Warehouse } from '../types';
import { 
  Search, Plus, Trash2, X, Eye, Sparkles, FileText, Pencil, Printer, 
  ChevronLeft, ChevronRight, Hash, Calendar, Package, Tag, ArrowUpRight, 
  Lock, LayoutGrid, List
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Barcode from 'react-barcode';
import { dbService } from '../services/dbService';
import { PaginationControls } from '../components/PaginationControls';
import { usePermissions } from '../hooks/usePermissions';
import { formatMoney, formatDate } from '../utils/formatUtils';
import { useLanguage } from '../contexts/LanguageContext';
import { useViewPreference } from '../hooks/useViewPreference';
import { CompanyInvoiceHeader } from '../components/CompanyInvoiceHeader';
import { useNavigation } from '../contexts/NavigationContext';

export const PurchaseOrders: React.FC = () => {
  const { t, dir, language } = useLanguage();
  const { user } = useAuth();
  const { canView, canCreate, canEdit, canDelete } = usePermissions('purchase_orders');
  const { showNotification } = useNotification();
  const { openTab, setPendingViewDoc } = useNavigation();

  // Local translations helper for Purchase Orders
  const ot = (key: string): string => {
    const translations: Record<string, { ar: string; en: string }> = {
      title: { ar: 'أوامر الشراء', en: 'Purchase Orders' },
      subtitle: { ar: 'إنشاء وإدارة أوامر الشراء للموردين ومتابعة تحويلها إلى فواتير مشتريات.', en: 'Create and manage purchase orders for suppliers and track their conversion to purchase invoices.' },
      add_order: { ar: 'إضافة أمر شراء', en: 'Add Purchase Order' },
      edit_order: { ar: 'تعديل أمر شراء', en: 'Edit Purchase Order' },
      search_placeholder: { ar: 'البحث عن أمر شراء برقم الأمر أو اسم المورد...', en: 'Search purchase orders by number or supplier...' },
      column_number: { ar: 'رقم الأمر', en: 'Order No' },
      column_supplier: { ar: 'المورد', en: 'Supplier' },
      column_date: { ar: 'التاريخ', en: 'Date' },
      column_delivery_date: { ar: 'تاريخ التسليم', en: 'Delivery Date' },
      column_amount: { ar: 'الإجمالي', en: 'Total Amount' },
      column_status: { ar: 'الحالة', en: 'Status' },
      status_pending: { ar: 'معلق', en: 'Pending' },
      status_converted: { ar: 'تم التحويل', en: 'Converted' },
      converted_to: { ar: 'فاتورة رقم', en: 'Invoice No' },
      convert_to_invoice: { ar: 'تحويل إلى فاتورة', en: 'Convert to Invoice' },
      form_supplier: { ar: 'المورد', en: 'Supplier' },
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
      view_order: { ar: 'تفاصيل أمر الشراء', en: 'Purchase Order Details' },
      order: { ar: 'أمر شراء', en: 'Purchase Order' },
      order_to: { ar: 'أمر شراء إلى', en: 'Order To' },
      order_saved: { ar: 'تم حفظ أمر الشراء بنجاح', en: 'Purchase Order saved successfully' },
      order_updated: { ar: 'تم تعديل أمر الشراء بنجاح', en: 'Purchase Order updated successfully' },
      order_deleted: { ar: 'تم حذف أمر الشراء بنجاح', en: 'Purchase Order deleted successfully' },
      delete_order: { ar: 'حذف أمر الشراء', en: 'Delete Purchase Order' },
      delete_confirm: { ar: 'هل أنت متأكد من رغبتك في حذف هذا الأمر نهائياً؟ لا يمكن التراجع عن هذا الإجراء.', en: 'Are you sure you want to permanently delete this order? This action cannot be undone.' },
      lock_error_edit: { ar: 'لا يمكن تعديل هذا الأمر لأنه تم تحويله بالفعل إلى فاتورة مشتريات', en: 'This order cannot be edited because it has already been converted to a purchase invoice.' },
      lock_error_delete: { ar: 'لا يمكن حذف هذا الأمر لأنه تم تحويله بالفعل إلى فاتورة مشتريات', en: 'This order cannot be deleted because it has already been converted to a purchase invoice.' }
    };
    return translations[key]?.[language as 'ar' | 'en'] || key;
  };

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [totalRecords, setTotalRecords] = useState(0);
  const [serverSummary, setServerSummary] = useState<any>({});

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [viewOrder, setViewOrder] = useState<PurchaseOrder | null>(null);
  const [view, setView] = useViewPreference('purchase_orders', 'table');

  // Form State
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [description, setDescription] = useState<string>('');
  const [orderNumber, setOrderNumber] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);

  const orderRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      const unsubOrders = dbService.subscribePaginated<PurchaseOrder>('purchase_orders', {
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

      const unsubSuppliers = dbService.subscribe<Supplier>('suppliers', user.company_id, setSuppliers);
      const unsubProducts = dbService.subscribe<Product>('products', user.company_id, setProducts);
      const unsubWarehouses = dbService.subscribe<any>('warehouses', user.company_id, setWarehouses);

      return () => {
        unsubOrders();
        unsubSuppliers();
        unsubProducts();
        unsubWarehouses();
      };
    }
  }, [user, page, limit, sortBy, sortOrder, searchTerm]);

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
      const next = await dbService.getNextSequence('purchase_orders', dateStr);
      return next;
    } catch (err) {
      console.error(err);
      return 'PO-' + dateStr.slice(0, 7) + '-000001';
    }
  };

  const openModal = async () => {
    setEditingOrder(null);
    setSelectedSupplierId('');
    setSelectedWarehouseId('');
    const newDate = new Date().toISOString().slice(0, 10);
    setDate(newDate);
    setDeliveryDate(newDate);
    const num = await generateOrderNumber(newDate);
    setOrderNumber(num);
    setItems([]);
    setDiscount(0);
    setDescription('');
    setIsModalOpen(true);
    setIsFullScreen(false);
  };

  const openEditModal = async (order: PurchaseOrder) => {
    if (order.status === 'converted') {
      showNotification(`${ot('lock_error_edit')} ${order.invoice_number || ''}`, 'error');
      return;
    }
    try {
      const fullData = await dbService.get<PurchaseOrder>('purchase_orders', order.id);
      if (!fullData) throw new Error('Could not fetch purchase order details');
      
      setEditingOrder(fullData);
      setSelectedSupplierId(fullData.supplier_id);
      setSelectedWarehouseId(fullData.warehouse_id || '');
      setDate(fullData.date);
      setDeliveryDate(fullData.delivery_date || fullData.date);
      setOrderNumber(fullData.order_number);
      setItems(fullData.items || []);
      setDiscount(fullData.discount_amount || 0);
      setDescription(fullData.description || '');
      setIsModalOpen(true);
      setIsFullScreen(false);
    } catch (e: any) {
      console.error(e);
      showNotification(e.message || 'Error loading order', 'error');
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, order: PurchaseOrder) => {
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
      await dbService.delete('purchase_orders', orderToDelete);
      await dbService.logActivity(user.id, user.username, user.company_id, ot('delete_order'), `${ot('order_deleted')}: ${orderToDelete}`, 'purchase_orders', orderToDelete);
      showNotification(ot('order_deleted'), 'success');
      setIsDeleteModalOpen(false);
      setOrderToDelete(null);
    } catch (e: any) {
      console.error(e);
      showNotification(e.message || t('common.delete_error'), 'error');
    }
  };

  const handlePrint = () => {
    const printContent = orderRef.current?.innerHTML;
    if (!printContent) return;

    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        body {
          direction: ${dir};
          padding: 20px;
          background: white;
          color: black;
          font-family: system-ui, -apple-system, sans-serif;
        }
        .no-print {
          display: none !important;
        }
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
    setTimeout(() => document.head.removeChild(style), 1000);
  };

  const handleConvertToInvoice = (e: React.MouseEvent, order: PurchaseOrder) => {
    e.stopPropagation();
    setPendingViewDoc({ type: 'convert_purchase_order', idOrNumber: order.id });
    openTab('purchase_invoices', t('nav.purchase_invoices'));
    showNotification(language === 'ar' ? 'تم تجهيز أمر الشراء للتحويل، يرجى حفظ الفاتورة' : 'Purchase order prepped for conversion, please save invoice', 'info');
  };

  const handleAddItem = () => {
    setItems([...items, { product_id: '', quantity: 1, unit_price: 0, total: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof PurchaseOrderItem, value: any) => {
    const updated = [...items];
    const item = { ...updated[index] };

    if (field === 'product_id') {
      const prod = products.find(p => p.id === value);
      item.product_id = value;
      item.product_name = prod?.name || '';
      item.product_code = prod?.code || '';
      item.product_image_url = prod?.image_url || '';
      item.barcode = prod?.barcode || '';
      item.unit_price = prod?.cost_price || 0; // Purchase uses cost price
    } else if (field === 'quantity') {
      item.quantity = Number(value) || 0;
    } else if (field === 'unit_price') {
      item.unit_price = Number(value) || 0;
    }

    item.total = Number((item.quantity * item.unit_price).toFixed(2));
    updated[index] = item;
    setItems(updated);
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + (item.total || 0), 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal() - (Number(discount) || 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!selectedSupplierId) {
      showNotification(language === 'ar' ? 'يرجى اختيار المورد' : 'Please select a supplier', 'error');
      return;
    }

    const validItems = items.filter(item => item.product_id);
    if (validItems.length === 0) {
      showNotification(language === 'ar' ? 'يرجى إضافة أصناف' : 'Please add items', 'error');
      return;
    }

    try {
      const subtotal = calculateSubtotal();
      const discount_amount = Number(discount) || 0;
      const total_amount = calculateTotal();
      const supplier = suppliers.find(s => s.id === selectedSupplierId);

      const orderData = {
        order_number: orderNumber,
        supplier_id: selectedSupplierId,
        supplier_name: supplier?.name || '',
        warehouse_id: selectedWarehouseId || null,
        date,
        delivery_date: deliveryDate,
        description,
        notes: description,
        items: validItems,
        subtotal,
        discount_amount,
        total_amount,
        company_id: user.company_id,
        created_by: user.id
      };

      if (editingOrder) {
        await dbService.update('purchase_orders', editingOrder.id, orderData);
        await dbService.logActivity(user.id, user.username, user.company_id, ot('edit_order'), `${ot('order_updated')}: ${orderNumber}`, 'purchase_orders', editingOrder.id);
        showNotification(ot('order_updated'), 'success');
      } else {
        await dbService.add('purchase_orders', orderData);
        await dbService.logActivity(user.id, user.username, user.company_id, ot('add_order'), `${ot('order_saved')}: ${orderNumber}`, 'purchase_orders');
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
    (o.supplier_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

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
                      <th className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'} cursor-pointer`} onClick={() => handleSort('supplier_name')}>{ot('column_supplier')}</th>
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
                        <td className={`px-6 py-4 font-bold text-slate-900 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{ord.supplier_name}</td>
                        <td className={`px-6 py-4 text-slate-500 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{formatDate(ord.date)}</td>
                        <td className={`px-6 py-4 text-slate-500 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{ord.delivery_date ? formatDate(ord.delivery_date) : '-'}</td>
                        <td className={`px-6 py-4 text-slate-500 max-w-[200px] truncate ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{ord.description || '-'}</td>
                        <td className={`px-6 py-4 font-bold text-slate-900 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                          {formatMoney(ord.total_amount)} {t('invoices.currency')}
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
                    <h4 className="font-bold text-slate-900 text-lg mb-2">{ord.supplier_name}</h4>
                    <p className="text-slate-500 text-sm mb-4 line-clamp-2">{ord.description || '-'}</p>
                    <div className="flex justify-between items-center pt-4 border-t border-slate-200/60 text-xs text-slate-500">
                      <span>{formatDate(ord.date)}</span>
                      <span className="font-bold text-slate-950 text-sm">
                        {formatMoney(ord.total_amount)} {t('invoices.currency')}
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
              totalRecords={totalRecords}
              setPage={setPage}
              setLimit={setLimit}
            />
          </div>
        </>
      ) : (
        /* Create/Edit Order Form Mode */
        <form onSubmit={handleSubmit} className="space-y-6">
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

          <div className={`grid grid-cols-1 ${isFullScreen ? 'lg:grid-cols-1' : 'lg:grid-cols-3'} gap-6`}>
            <div className="lg:col-span-2 space-y-6">
              {/* Order Basic Details */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 tracking-tighter uppercase mb-2">{ot('form_supplier')}</label>
                    <select
                      value={selectedSupplierId}
                      onChange={(e) => setSelectedSupplierId(e.target.value)}
                      className="w-full bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500"
                      required
                    >
                      <option value="">{language === 'ar' ? 'اختر المورد...' : 'Select Supplier...'}</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 tracking-tighter uppercase mb-2">{ot('form_warehouse')}</label>
                    <select
                      value={selectedWarehouseId}
                      onChange={(e) => setSelectedWarehouseId(e.target.value)}
                      className="w-full bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">{language === 'ar' ? 'المخزن الرئيسي (تلقائي)' : 'Main Warehouse (Default)'}</option>
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 tracking-tighter uppercase mb-2">{ot('column_number')}</label>
                    <div className="relative">
                      <Hash className={`absolute ${dir === 'rtl' ? 'left-3' : 'right-3'} top-3 text-slate-400`} size={16} />
                      <input
                        type="text"
                        value={orderNumber}
                        readOnly
                        className={`w-full ${dir === 'rtl' ? 'pl-4 pr-10' : 'pr-4 pl-10'} py-2 bg-slate-100 border-none rounded-xl text-slate-500 font-mono text-sm`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 tracking-tighter uppercase mb-2">{ot('form_date')}</label>
                    <div className="relative">
                      <Calendar className={`absolute ${dir === 'rtl' ? 'left-3' : 'right-3'} top-3 text-slate-400`} size={16} />
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => {
                          setDate(e.target.value);
                          if (!editingOrder) {
                            generateOrderNumber(e.target.value).then(setOrderNumber);
                          }
                        }}
                        className={`w-full ${dir === 'rtl' ? 'pl-4 pr-10' : 'pr-4 pl-10'} py-2 bg-slate-50 border-none rounded-xl`}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 tracking-tighter uppercase mb-2">{ot('form_delivery_date')}</label>
                    <div className="relative">
                      <Calendar className={`absolute ${dir === 'rtl' ? 'left-3' : 'right-3'} top-3 text-slate-400`} size={16} />
                      <input
                        type="date"
                        value={deliveryDate}
                        onChange={(e) => setDeliveryDate(e.target.value)}
                        className={`w-full ${dir === 'rtl' ? 'pl-4 pr-10' : 'pr-4 pl-10'} py-2 bg-slate-50 border-none rounded-xl`}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 tracking-tighter uppercase mb-2">{ot('form_description')}</label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={language === 'ar' ? 'اكتب ملاحظات إضافية...' : 'Write notes here...'}
                    className="w-full bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Items List Card */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Package className="w-5 h-5 text-emerald-600" />
                    {ot('form_items')}
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-xl font-bold text-xs transition-all shadow-sm border border-slate-200/50"
                  >
                    <Plus size={14} />
                    {ot('add_item')}
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-400 text-xs font-bold border-b border-slate-100 pb-2">
                        <th className={`pb-2 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{ot('column_product')}</th>
                        <th className="pb-2 text-center w-24">{ot('column_quantity')}</th>
                        <th className="pb-2 text-center w-32">{ot('column_price')}</th>
                        <th className={`pb-2 ${dir === 'rtl' ? 'text-left' : 'text-right'} w-32`}>{ot('column_total')}</th>
                        <th className="pb-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((item, index) => (
                        <tr key={index} className="hover:bg-slate-50/50">
                          <td className="py-3">
                            <select
                              value={item.product_id}
                              onChange={(e) => handleItemChange(index, 'product_id', e.target.value)}
                              className="w-full bg-slate-50 border-none rounded-xl text-xs py-1.5 focus:ring-2 focus:ring-emerald-500"
                              required
                            >
                              <option value="">{language === 'ar' ? 'اختر صنفاً...' : 'Select Product...'}</option>
                              {products.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-3 text-center">
                            <input
                              type="number"
                              min="0.001"
                              step="any"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                              className="w-20 text-center bg-slate-50 border-none rounded-xl text-xs py-1.5 focus:ring-2 focus:ring-emerald-500"
                              required
                            />
                          </td>
                          <td className="py-3 text-center">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={item.unit_price}
                              onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                              className="w-28 text-center bg-slate-50 border-none rounded-xl text-xs py-1.5 focus:ring-2 focus:ring-emerald-500"
                              required
                            />
                          </td>
                          <td className={`py-3 ${dir === 'rtl' ? 'text-left' : 'text-right'} font-mono text-xs font-bold text-slate-800`}>
                            {formatMoney(item.total)} {t('invoices.currency')}
                          </td>
                          <td className="py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Calculations Card */}
            <div className="space-y-6">
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
                <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-600" />
                  {language === 'ar' ? 'ملخص الحسابات' : 'Calculations Summary'}
                </h3>
                <div className="divide-y divide-slate-100 text-xs">
                  <div className="py-3 flex justify-between">
                    <span className="text-slate-500">{ot('summary_subtotal')}</span>
                    <span className="font-bold text-slate-900">{formatMoney(calculateSubtotal())} {t('invoices.currency')}</span>
                  </div>
                  <div className="py-3 flex justify-between items-center">
                    <span className="text-slate-500 flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5 text-amber-500" />
                      {ot('summary_discount')}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={discount}
                      onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                      className="w-24 text-center bg-slate-50 border-none rounded-xl text-xs py-1 font-bold text-red-600"
                    />
                  </div>
                  <div className="py-4 flex justify-between items-center text-sm font-bold bg-emerald-50/50 -mx-6 px-6 rounded-b-2xl border-t border-emerald-100">
                    <span className="text-emerald-800">{ot('summary_total')}</span>
                    <span className="text-emerald-800 text-base">{formatMoney(calculateTotal())} {t('invoices.currency')}</span>
                  </div>
                </div>
              </div>
            </div>
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
              className="bg-slate-50 w-full max-w-4xl h-full flex flex-col shadow-2xl relative"
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
                </div>
              </div>

              {/* Printable Area */}
              <div ref={orderRef} className="flex-1 overflow-y-auto p-8 bg-white" id="order-print-area">
                <div className="max-w-3xl mx-auto space-y-8">
                  {/* Company Invoice Header Component */}
                  <CompanyInvoiceHeader documentTitle={ot('order')} />

                  <div className="grid grid-cols-2 gap-8 text-sm">
                    <div className="space-y-2">
                      <h4 className="text-slate-400 font-bold uppercase tracking-tight text-xs">{ot('order_to')}</h4>
                      <p className="font-bold text-slate-900 text-lg">{viewOrder.supplier_name}</p>
                      {viewOrder.supplier_id && (
                        <p className="text-xs text-slate-500 font-medium">{language === 'ar' ? 'كود المورد:' : 'Supplier Code:'} {viewOrder.supplier_id.slice(-6).toUpperCase()}</p>
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
                        <th className="pb-2 text-center w-24">{ot('column_quantity')}</th>
                        <th className="pb-2 text-center w-32">{ot('column_price')}</th>
                        <th className={`pb-2 ${dir === 'rtl' ? 'text-left' : 'text-right'} w-32`}>{ot('column_total')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(viewOrder.items || []).map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-4">
                            <p className="font-bold text-slate-900">{item.product_name}</p>
                            {item.product_code && <p className="text-xs text-slate-500 font-mono">{item.product_code}</p>}
                          </td>
                          <td className="py-4 text-center font-mono">{item.quantity}</td>
                          <td className="py-4 text-center font-mono">{formatMoney(item.unit_price)} {t('invoices.currency')}</td>
                          <td className={`py-4 ${dir === 'rtl' ? 'text-left' : 'text-right'} font-mono font-bold text-slate-900`}>
                            {formatMoney(item.total)} {t('invoices.currency')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Total Calculations */}
                  <div className="grid grid-cols-2 pt-6 border-t-2 border-slate-900">
                    <div>
                      {viewOrder.description && (
                        <div className="bg-slate-50 rounded-2xl p-4 text-xs text-slate-600 leading-relaxed border border-slate-100">
                          <h5 className="font-bold text-slate-900 mb-1">{language === 'ar' ? 'البيان / الشروط:' : 'Description / Terms:'}</h5>
                          <p>{viewOrder.description}</p>
                        </div>
                      )}
                    </div>
                    <div className="divide-y divide-slate-100 text-xs justify-self-end w-72">
                      <div className="py-3 flex justify-between">
                        <span className="text-slate-500">{ot('summary_subtotal')}</span>
                        <span className="font-bold text-slate-900 font-mono">{formatMoney(viewOrder.subtotal || 0)} {t('invoices.currency')}</span>
                      </div>
                      {viewOrder.discount_amount !== undefined && viewOrder.discount_amount > 0 && (
                        <div className="py-3 flex justify-between text-red-600">
                          <span>{ot('summary_discount')}</span>
                          <span className="font-bold font-mono">-{formatMoney(viewOrder.discount_amount)} {t('invoices.currency')}</span>
                        </div>
                      )}
                      <div className="py-4 flex justify-between text-sm font-bold text-emerald-800 bg-emerald-50 -mx-4 px-4 rounded-b-xl">
                        <span>{ot('summary_total')}</span>
                        <span className="font-mono">{formatMoney(viewOrder.total_amount)} {t('invoices.currency')}</span>
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
