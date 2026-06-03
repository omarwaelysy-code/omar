import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Supplier, Product, PaymentMethod, JournalEntry, JournalEntryItem, Account, Company } from '../types';
import { Search, Plus, Trash2, X, RotateCcw, User, CreditCard, Calendar, Hash, Package, Save, Eye, Download, History, Printer, Edit, Phone, Mail, MapPin, Wallet, Box, Maximize2, Minimize2, ChevronRight, ChevronLeft, FileText, Layers, ChevronDown, LayoutGrid, List } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SmartAIInput } from '../components/SmartAIInput';
import { exportToPDF as exportToPDFUtil } from '../utils/pdfUtils';
import { exportToExcel, formatDataForExcel } from '../utils/excelUtils';
import { dbService } from '../services/dbService';
import { PageActivityLog } from '../components/PageActivityLog';
import { TransactionSidePanel } from '../components/TransactionSidePanel';
import { ExportButtons } from '../components/ExportButtons';
import { TransactionManager } from '../services/TransactionManager';
import { ReturnSchema, JournalEntrySchema } from '../lib/schemas';
import { ActivityLog } from '../types';
import { formatNumber, formatDate, formatMoney } from '../utils/formatUtils';
import { PaginationControls } from '../components/PaginationControls';
import { CompanyInvoiceHeader } from '../components/CompanyInvoiceHeader';
import { useNavigation } from '../contexts/NavigationContext';

export const PurchaseReturns: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { showNotification } = useNotification();
  const { pendingViewDoc, setPendingViewDoc, setCurrentPage } = useNavigation();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [purchaseReturns, setPurchaseReturns] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewReturn, setViewReturn] = useState<any | null>(null);
  const [view, setView] = useState<'table' | 'card'>('table');

  const [editingReturn, setEditingReturn] = useState<any | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [returnToDelete, setReturnToDelete] = useState<string | null>(null);
  const returnRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(field);
      setSortOrder('DESC');
    }
    setPage(1);
  };
  
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [totalRecords, setTotalRecords] = useState(0);
  const [serverSummary, setServerSummary] = useState<any>({});
  const [maxSeqGenerated, setMaxSeqGenerated] = useState<number>(0);
  const [returnNumber, setReturnNumber] = useState('');
  const [company, setCompany] = useState<Company | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    const fetchCompany = async () => {
      if (user?.company_id) {
        const companyData = await dbService.get<Company>('companies', user.company_id);
        setCompany(companyData);
      }
    };
    fetchCompany();
  }, [user?.company_id]);

  const generateReturnNumber = async (selectedDate: string) => {
    return await dbService.getNextSequence('purchase_returns', selectedDate);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingReturn(null);
    setReturnData({
      supplier_id: '',
      warehouse_id: '',
      date: new Date().toISOString().slice(0, 10),
      payment_type: 'credit',
      payment_method_id: '',
      notes: ''
    });
    setItems([{ product_id: '', quantity: 1, cost_price: 0 }]);
  };

  const handlePrevReturn = () => {
    if (!editingReturn) return;
    const currentIndex = purchaseReturns.findIndex(r => r.id === editingReturn.id);
    if (currentIndex > 0) {
      const prev = purchaseReturns[currentIndex - 1];
      handleEdit(prev);
    }
  };

  const handleNextReturn = () => {
    if (!editingReturn) return;
    const currentIndex = purchaseReturns.findIndex(r => r.id === editingReturn.id);
    if (currentIndex < purchaseReturns.length - 1) {
      const next = purchaseReturns[currentIndex + 1];
      handleEdit(next);
    }
  };
  
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [activityLogDocumentId, setActivityLogDocumentId] = useState<string | undefined>(undefined);
  const [previewJournalEntry, setPreviewJournalEntry] = useState<JournalEntry | null>(null);
  const [previewActivityLog, setPreviewActivityLog] = useState<Partial<ActivityLog> | null>(null);

  const [supplierFormData, setSupplierFormData] = useState({
    name: '',
    mobile: '',
    email: '',
    address: '',
    opening_balance: 0,
    opening_balance_date: new Date().toISOString().slice(0, 10),
    account_id: '',
    counter_account_id: ''
  });

  const [productFormData, setProductFormData] = useState({
    name: '',
    code: '',
    category: '',
    cost_price: 0,
    sale_price: 0,
    stock: 0,
    min_stock: 0,
    unit: 'قطعة'
  });

  const [paymentMethodFormData, setPaymentMethodFormData] = useState({
    name: '',
    type: 'cash' as 'cash' | 'bank',
    account_number: '',
    opening_balance: 0
  });

  const [returnData, setReturnData] = useState({
    supplier_id: '',
    warehouse_id: '',
    date: new Date().toISOString().slice(0, 10),
    payment_type: 'credit' as 'credit' | 'cash',
    payment_method_id: '',
    notes: ''
  });

  const [items, setItems] = useState<{ product_id: string; quantity: number; cost_price: number }[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      const unsubPR = dbService.subscribePaginated('purchase_returns', {
        company_id: user.company_id,
        _page: page,
        _limit: limit,
        _sortBy: sortBy,
        _sortOrder: sortOrder,
        _search: searchTerm
      }, (result: any) => {
        setPurchaseReturns(result.data);
        setTotalRecords(result.total);
        setServerSummary(result.summary);
      });
      const unsubSuppliers = dbService.subscribe<Supplier>('suppliers', user.company_id, setSuppliers);
      const unsubProducts = dbService.subscribe<Product>('products', user.company_id, setProducts);
      const unsubPM = dbService.subscribe<PaymentMethod>('payment_methods', user.company_id, setPaymentMethods);
      const unsubAccounts = dbService.subscribe<any>('accounts', user.company_id, setAccounts);
      const unsubWarehouses = dbService.subscribe<any>('warehouses', user.company_id, setWarehouses);
      
      setLoading(false);
      return () => {
        unsubPR();
        unsubSuppliers();
        unsubProducts();
        unsubPM();
        unsubAccounts();
        unsubWarehouses();
      };
    }
  }, [user, page, limit, sortBy, sortOrder, searchTerm]);

  // Real-time Preview Logic
  useEffect(() => {
    if (!isModalOpen || !user) {
      setPreviewJournalEntry(null);
      setPreviewActivityLog(null);
      return;
    }

    if (!editingReturn && isModalOpen) {
      const updateNum = async () => {
        const num = await generateReturnNumber(returnData.date);
        setReturnNumber(num);
      };
      updateNum();
    }

    const generatePreview = () => {
      const total_amount = (items || []).reduce((sum, item) => sum + (item.quantity * item.cost_price), 0);
      if (total_amount <= 0) {
        setPreviewJournalEntry(null);
        setPreviewActivityLog(null);
        return;
      }

      const supplier = suppliers.find(s => s.id === returnData.supplier_id);
      const return_number = 'PRET-PREVIEW';

      // Preview Activity Log
      setPreviewActivityLog({
        action: 'إضافة مرتجع مشتريات',
        details: `إضافة مرتجع مشتريات جديد للمورد ${supplier?.name || '...'} بمبلغ ${formatNumber(total_amount)}`,
        created_at: new Date().toISOString()
      });

      // Preview Journal Entry
      const journalItems: JournalEntryItem[] = [];

      // Debit: Supplier or Cash
      let debitAccountId = '';
      let debitAccountName = '';

      if (returnData.payment_type === 'cash' && returnData.payment_method_id) {
        const pm = paymentMethods.find(p => p.id === returnData.payment_method_id);
        debitAccountId = pm?.account_id || '';
        debitAccountName = pm?.account_name || '';
      } else {
        debitAccountId = supplier?.account_id || '';
        debitAccountName = supplier?.account_name || '';
        
        if (!debitAccountId) {
          const fallbackAccount = accounts.find(a => a.name.includes('موردين'));
          debitAccountId = fallbackAccount?.id || 'suppliers_account_default';
          debitAccountName = fallbackAccount?.name || 'حساب الموردين (افتراضي)';
        }
      }

      journalItems.push({
        account_id: debitAccountId,
        account_name: debitAccountName,
        debit: total_amount,
        credit: 0,
        description: `مرتجع مشتريات رقم ${return_number} - ${supplier?.name || '...'}`,
        supplier_id: returnData.payment_type === 'credit' ? returnData.supplier_id : undefined,
        supplier_name: returnData.payment_type === 'credit' ? supplier?.name : undefined
      });

      // Credit: Inventory/Cost Accounts (per product)
      (items || []).forEach(item => {
        const product = products.find(p => p.id === item.product_id);
        let creditAccountId = '';
        let creditAccountName = '';

        if (product && product.type !== 'service') {
          creditAccountId = product.inventory_account_id || product.cost_account_id || '';
          creditAccountName = product.inventory_account_name || product.cost_account_name || '';
        } else {
          creditAccountId = product?.cost_account_id || '';
          creditAccountName = product?.cost_account_name || '';
        }

        if (!creditAccountId) {
          const fallbackAccount = accounts.find(a => 
            a.name.includes('مخزون') || a.name.includes('مشتريات') || a.name.toLowerCase().includes('inventory')
          );
          creditAccountId = fallbackAccount?.id || 'inventory_account_default';
          creditAccountName = fallbackAccount?.name || 'حساب المخزون (افتراضي)';
        }

        journalItems.push({
          account_id: creditAccountId,
          account_name: creditAccountName,
          debit: 0,
          credit: item.quantity * item.cost_price,
          description: `مرتجع مشتريات صنف: ${product?.name || '...'} - مرتجع ${return_number}`
        });
      });

      setPreviewJournalEntry({
        id: 'preview',
        date: returnData.date,
        reference_number: return_number,
        reference_id: 'preview',
        reference_type: 'purchase_return',
        description: `قيد مرتجع مشتريات رقم ${return_number}`,
        items: journalItems,
        total_debit: total_amount,
        total_credit: total_amount,
        company_id: user.company_id,
        created_at: new Date().toISOString(),
        created_by: user.id
      });
    };

    generatePreview();
  }, [isModalOpen, items, returnData.supplier_id, returnData.date, user, suppliers, products, accounts]);

  const addItem = () => {
    setItems(prev => [...prev, { product_id: '', quantity: 1, cost_price: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: any) => {
    setItems(prev => {
      const newItems = [...prev];
      (newItems[index] as any)[field] = value;
      if (field === 'product_id') {
        const product = products.find(p => p.id === value);
        if (product) {
          newItems[index].cost_price = product.cost_price;
          (newItems[index] as any).product_name = product.name;
          (newItems[index] as any).product_code = product.code;
          (newItems[index] as any).product_image_url = product.image_url;
        }
      }
      return newItems;
    });
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.cost_price), 0);
  };

  const handleSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const code = `SUPP-${Date.now().toString().slice(-6)}`;
      const selectedAccount = accounts.find(a => a.id === supplierFormData.account_id);
      const newSupplier = {
        ...supplierFormData,
        code,
        account_name: selectedAccount?.name || '',
        company_id: user.company_id
      };
      const supplierId = await dbService.add('suppliers', newSupplier);

      // Create Journal Entry for Opening Balance if it's not zero
      if (supplierFormData.opening_balance !== 0 && supplierFormData.account_id && supplierFormData.counter_account_id) {
        const counterAccount = accounts.find(a => a.id === supplierFormData.counter_account_id);
        const journalItems: JournalEntryItem[] = [
          {
            account_id: supplierFormData.account_id,
            account_name: selectedAccount?.name || '',
            debit: supplierFormData.opening_balance < 0 ? Math.abs(supplierFormData.opening_balance) : 0,
            credit: supplierFormData.opening_balance > 0 ? supplierFormData.opening_balance : 0,
            description: `رصيد أول المدة - ${supplierFormData.name}`
          },
          {
            account_id: supplierFormData.counter_account_id,
            account_name: counterAccount?.name || '',
            debit: supplierFormData.opening_balance > 0 ? supplierFormData.opening_balance : 0,
            credit: supplierFormData.opening_balance < 0 ? Math.abs(supplierFormData.opening_balance) : 0,
            description: `رصيد أول المدة - ${supplierFormData.name}`
          }
        ];

        const journalEntry: Omit<JournalEntry, 'id'> = {
          date: supplierFormData.opening_balance_date,
          reference_number: `OB-${code}`,
          reference_id: supplierId,
          reference_type: 'opening_balance',
          description: `قيد رصيد أول المدة للمورد: ${supplierFormData.name}`,
          items: journalItems,
          total_debit: Math.abs(supplierFormData.opening_balance),
          total_credit: Math.abs(supplierFormData.opening_balance),
          company_id: user.company_id,
          created_at: new Date().toISOString(),
          created_by: user.id
        };
        await dbService.createJournalEntry(journalEntry);
      }

      await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة مورد', `إضافة مورد جديد من مرتجع المشتريات: ${supplierFormData.name}`, ['suppliers', 'purchase_returns']);
      
      setReturnData({ ...returnData, supplier_id: supplierId });
      setIsSupplierModalOpen(false);
      setSupplierFormData({
        name: '',
        mobile: '',
        email: '',
        address: '',
        opening_balance: 0,
        opening_balance_date: new Date().toISOString().slice(0, 10),
        account_id: '',
        counter_account_id: ''
      });
      showNotification('تم إضافة المورد بنجاح');
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء إضافة المورد', 'error');
    }
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const productId = await dbService.add('products', {
        ...productFormData,
        company_id: user.company_id
      });
      await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة صنف', `إضافة صنف جديد من مرتجع المشتريات: ${productFormData.name}`, ['products', 'purchase_returns']);
      
      setItems([...items, { product_id: productId, quantity: 1, cost_price: productFormData.cost_price }]);
      setIsProductModalOpen(false);
      setProductFormData({
        name: '',
        code: '',
        category: '',
        cost_price: 0,
        sale_price: 0,
        stock: 0,
        min_stock: 0,
        unit: 'قطعة'
      });
      showNotification('تم إضافة الصنف بنجاح');
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء إضافة الصنف', 'error');
    }
  };

  const handlePaymentMethodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const pmId = await dbService.add('payment_methods', {
        ...paymentMethodFormData,
        company_id: user.company_id
      });
      await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة طريقة دفع', `إضافة طريقة دفع جديدة من مرتجع المشتريات: ${paymentMethodFormData.name}`, ['payment_methods', 'purchase_returns']);
      
      setReturnData({ ...returnData, payment_method_id: pmId });
      setIsPaymentMethodModalOpen(false);
      setPaymentMethodFormData({
        name: '',
        type: 'cash',
        account_number: '',
        opening_balance: 0
      });
      showNotification('تم إضافة طريقة الدفع بنجاح');
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء إضافة طريقة الدفع', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const validItems = items.filter(item => item.product_id);
    if (!returnData.supplier_id || validItems.length === 0) {
      showNotification('يرجى اختيار المورد وإضافة أصناف مكتملة للمرتجع', 'error');
      return;
    }

    const hasPhysicalProduct = items.some(item => {
      const prod = products.find(p => p.id === item.product_id);
      return prod && prod.type !== 'service';
    });

    if (hasPhysicalProduct && !returnData.warehouse_id) {
      showNotification('يرجى اختيار المخزن', 'error');
      return;
    }

    try {
      const supplier = suppliers.find(s => s.id === returnData.supplier_id);
      const paymentMethod = paymentMethods.find(pm => pm.id === returnData.payment_method_id);
      const return_number = editingReturn ? editingReturn.return_number : returnNumber;
      
      const total_amount = Number(validItems.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.cost_price || 0)), 0)) || 0;

      const sanitizedItems = validItems.map(item => {
        const product = products.find(p => p.id === item.product_id);
        return {
          product_id: item.product_id,
          product_name: product?.name || '',
          quantity: Number(item.quantity) || 0,
          unit_price: Number(item.cost_price) || 0,
          total: Number(Number(item.quantity || 0) * Number(item.cost_price || 0)) || 0
        };
      });

      const data = {
        return_number,
        supplier_id: returnData.supplier_id,
        supplier_name: supplier?.name || '',
        warehouse_id: returnData.warehouse_id || null,
        date: returnData.date, 
        items: sanitizedItems,
        total_amount,
        payment_type: returnData.payment_type,
        payment_method_id: returnData.payment_type === 'cash' ? (returnData.payment_method_id || null) : null,
        payment_method_name: returnData.payment_type === 'cash' ? (paymentMethod?.name || '') : null,
        company_id: user.company_id,
        created_at: new Date().toISOString(),
        created_by: user.id
      };

      const journalItems: any[] = [];
      let supplierAccountId = supplier?.account_id || '';
      let supplierAccountName = supplier?.account_name || '';
      if (!supplierAccountId) {
        const fallback = accounts.find(a => a.name.includes('موردين'));
        supplierAccountId = fallback?.id || 'suppliers_account_default';
        supplierAccountName = fallback?.name || 'حساب الموردين (افتراضي)';
      }

      journalItems.push({
        account_id: supplierAccountId,
        account_name: supplierAccountName,
        debit: total_amount,
        credit: 0,
        description: `مرتجع مشتريات رقم ${return_number} - ${supplier?.name}`,
        supplier_id: returnData.supplier_id,
        supplier_name: supplier?.name
      });

      sanitizedItems.forEach(item => {
        const product = products.find(p => p.id === item.product_id);
        let creditAccountId = '';
        let creditAccountName = '';
        
        if (product && product.type !== 'service') {
          creditAccountId = product.inventory_account_id || product.cost_account_id || '';
          creditAccountName = product.inventory_account_name || product.cost_account_name || product.revenue_account_name || '';
        } else {
          creditAccountId = product?.cost_account_id || '';
          creditAccountName = product?.cost_account_name || product?.revenue_account_name || '';
        }

        if (!creditAccountId) {
          const fallback = accounts.find(a => a.name.includes('مخزون') || a.name.includes('مشتريات') || a.name.includes('تكلفة') || a.name.toLowerCase().includes('inventory'));
          creditAccountId = fallback?.id || 'purchase_account_default';
          creditAccountName = fallback?.name || 'حساب المشتريات (افتراضي)';
        }
        journalItems.push({
          account_id: creditAccountId,
          account_name: creditAccountName,
          debit: 0,
          credit: Number(Number(item.quantity || 0) * Number(item.unit_price || 0)) || 0,
          description: `مرتجع مشتريات صنف: ${item.product_name} - مرتجع ${return_number}`
        });
      });

      if (returnData.payment_type === 'cash' && returnData.payment_method_id) {
        const pm = paymentMethods.find(p => p.id === returnData.payment_method_id);
        let cashAccountId = pm?.account_id || '';
        let cashAccountName = pm?.account_name || '';
        if (!cashAccountId) {
          const fallback = accounts.find(a => a.name.includes('نقدية') || a.name.includes('خزينة') || a.name.includes('صندوق'));
          cashAccountId = fallback?.id || 'cash_account_default';
          cashAccountName = fallback?.name || 'حساب النقدية (افتراضي)';
        }
        journalItems.push({
          account_id: cashAccountId,
          account_name: cashAccountName,
          debit: total_amount,
          credit: 0,
          description: `استلام نقدية مقابل مرتجع مشتريات رقم ${return_number} - ${supplier?.name}`
        });
        journalItems.push({
          account_id: supplierAccountId,
          account_name: supplierAccountName,
          debit: 0,
          credit: total_amount,
          description: `تسوية نقدية لمرتجع مشتريات رقم ${return_number} - ${supplier?.name}`,
          supplier_id: returnData.supplier_id,
          supplier_name: supplier?.name
        });
      }

      const total_debit = Number(journalItems.reduce((sum, item) => sum + (Number(item.debit) || 0), 0)) || 0;
      const total_credit = Number(journalItems.reduce((sum, item) => sum + (Number(item.credit) || 0), 0)) || 0;

      const journalEntryData = {
        date: returnData.date,
        reference_number: return_number,
        reference_type: 'purchase_return',
        description: `قيد مرتجع مشتريات رقم ${return_number}`,
        items: journalItems,
        total_debit,
        total_credit,
        company_id: user.company_id,
        created_at: new Date().toISOString(),
        created_by: user.id
      };

      if (editingReturn) {
        await dbService.deleteJournalEntryByReference(editingReturn.id, user.company_id);
        await TransactionManager.updateWithAccounting(
          'purchase_returns',
          editingReturn.id,
          data,
          ReturnSchema,
          journalEntryData,
          JournalEntrySchema
        );
      } else {
        await TransactionManager.saveWithAccounting(
          'purchase_returns',
          data,
          ReturnSchema,
          journalEntryData,
          JournalEntrySchema
        );
      }

      showNotification(editingReturn ? 'تم تحديث مرتجع المشتريات بنجاح' : 'تم حفظ مرتجع المشتريات بنجاح', 'success');
      closeModal();
      setEditingReturn(null);

      if (!editingReturn) {
        dbService.logActivity(user.id, user.username, user.company_id, 'إضافة مرتجع مشتريات', `إضافة مرتجع مشتريات جديد رقم: ${return_number}`, 'purchase_returns');
      }

    } catch (e: any) {
      console.error('Save failed:', e);
      showNotification(e.message || 'حدث خطأ أثناء حفظ مرتجع المشتريات', 'error');
    }
  };

  const handleExportExcel = () => {
    const formattedData = formatDataForExcel(filteredReturns, {
      'return_number': 'رقم المرتجع',
      'supplier_name': 'المورد',
      'date': 'التاريخ',
      'total_amount': 'المبلغ الإجمالي'
    });
    exportToExcel(formattedData, { filename: 'PurchaseReturns_Report', sheetName: 'مرتجع مشتريات' });
  };

  const handleExportPDF = async () => {
    if (tableRef.current) {
      await exportToPDFUtil(tableRef.current, { 
        filename: 'PurchaseReturns_Report', 
        orientation: 'landscape',
        reportTitle: 'قائمة مرتجعات المشتريات'
      });
    }
  };

  const openModal = async () => {
    const newDate = new Date().toISOString().slice(0, 10);
    setReturnData({
      supplier_id: '',
      warehouse_id: '',
      date: newDate,
      payment_type: 'credit',
      payment_method_id: '',
      notes: ''
    });
    setItems([{ product_id: '', quantity: 1, cost_price: 0 }]);
    const num = await generateReturnNumber(newDate);
    setReturnNumber(num);
    setEditingReturn(null);
    setIsModalOpen(true);
  };

  const handleEdit = async (ret: any) => {
    console.log('[EDIT] Opening edit modal for purchase return ID:', ret.id);
    try {
      const fullData = await dbService.get<any>('purchase_returns', ret.id);
      console.log('[EDIT] Purchase return details from API:', fullData);
      
      if (!fullData) throw new Error('Return details not found');

      setEditingReturn(fullData);
      setReturnNumber(fullData.return_number);
      setReturnData({
        supplier_id: fullData.supplier_id,
        warehouse_id: fullData.warehouse_id || '',
        date: fullData.date ? fullData.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
        payment_type: fullData.payment_type || 'credit',
        payment_method_id: fullData.payment_method_id || '',
        notes: fullData.notes || ''
      });
      setItems((fullData.items || []).map((item: any) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        cost_price: item.unit_price || item.price || 0
      })));
      setIsModalOpen(true);
      console.log('[EDIT] Form updated with purchase return:', fullData.id);
    } catch (error: any) {
      console.error('[EDIT] Error loading purchase return:', error);
      showNotification('فشل تحميل بيانات المرتجع', 'error');
    }
  };

  useEffect(() => {
    if (pendingViewDoc && pendingViewDoc.type === 'purchase_return' && user) {
      const loadPendingDoc = async () => {
        try {
          const existing = purchaseReturns.find(r => r.return_number === pendingViewDoc.idOrNumber || r.id === pendingViewDoc.idOrNumber);
          if (existing) {
            handleEdit(existing);
            setPendingViewDoc(null);
            return;
          }
          const docs = await dbService.getDocsByFilter<any>('purchase_returns', user.company_id, [
            { field: 'return_number', operator: '==', value: pendingViewDoc.idOrNumber }
          ]);
          if (docs && docs.length > 0) {
            handleEdit(docs[0]);
          } else {
            const docById = await dbService.get<any>('purchase_returns', pendingViewDoc.idOrNumber);
            if (docById) {
              handleEdit(docById);
            }
          }
          setPendingViewDoc(null);
        } catch (err) {
          console.error("Error loading pending document", err);
          setPendingViewDoc(null);
        }
      };
      loadPendingDoc();
    }
  }, [pendingViewDoc, purchaseReturns, user, setPendingViewDoc]);

  const handleDelete = (id: string) => {
    setReturnToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!returnToDelete || !user) return;
    try {
      const ret = purchaseReturns.find(r => r.id === returnToDelete);
      
      // Delete associated journal entry
      await dbService.deleteJournalEntryByReference(returnToDelete, user.company_id);
      
      await dbService.delete('purchase_returns', returnToDelete);
      await dbService.logActivity(user.id, user.username, user.company_id, 'حذف مرتجع مشتريات', `حذف مرتجع مشتريات رقم: ${ret?.return_number}`, 'purchase_returns');
      showNotification(t('common.delete_success'), 'success');
      setIsDeleteModalOpen(false);
      setReturnToDelete(null);
    } catch (e: any) {
      console.error(e);
      showNotification(e.message || t('common.delete_error'), 'error');
    }
  };

  const handleViewReturn = async (id: string) => {
    const ret = purchaseReturns.find(r => r.id === id);
    if (ret) {
      setViewReturn(ret);
    }
  };

  const exportToPDF = async (ret: any) => {
    if (!returnRef.current) return;
    
    const element = returnRef.current;
    try {
      await exportToPDFUtil(element, {
        filename: `${ret.return_number}.pdf`,
        margin: 10,
        orientation: 'portrait',
        reportTitle: `مرتجع مشتريات رقم: ${ret.return_number}`
      });
    } catch (e) {
      console.error('PDF Export Error:', e);
      showNotification('حدث خطأ أثناء تصدير PDF', 'error');
    }
  };

  const filteredReturns = purchaseReturns.filter(r => 
    r.return_number.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const applyAiData = (data: any) => {
    if (data.supplierName) {
      const supplier = suppliers.find(s => s.name.toLowerCase().includes(data.supplierName.toLowerCase()));
      if (supplier) setReturnData(prev => ({ ...prev, supplier_id: supplier.id }));
    }
    if (data.date) setReturnData(prev => ({ ...prev, date: data.date }));
    if (data.items) {
      const newItems = data.items.map((item: any) => {
        const product = products.find(p => p.name.toLowerCase().includes(item.productName.toLowerCase()));
        return {
          product_id: product?.id || '',
          quantity: item.quantity || 1,
          cost_price: item.price || product?.cost_price || 0
        };
      });
      setItems(newItems);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">مرتجع المشتريات</h2>
          <p className="text-zinc-500">إدارة الأصناف المرتجعة للموردين.</p>
          {serverSummary.total_amount !== undefined && (
            <div className="mt-2 flex items-center gap-4 text-sm">
               <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100 font-bold">
                 إجمالي المرتجعات: {formatMoney(serverSummary.total_amount)} ج.م
               </span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => setIsActivityLogOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-zinc-600 border border-zinc-200 rounded-2xl font-bold hover:bg-zinc-50 transition-all active:scale-95 shadow-sm"
            title="سجل النشاط"
          >
            <History size={20} />
            <span className="hidden md:inline">سجل النشاط</span>
          </button>
          <ExportButtons 
            onExportExcel={handleExportExcel} 
            onExportPDF={handleExportPDF} 
          />
          <button 
            onClick={openModal}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-200"
          >
            <Plus size={20} />
            إضافة مرتجع
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-50 flex items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 text-zinc-400" size={18} />
            <input
              type="text"
              placeholder="البحث عن مرتجعات..."
              className="w-full pl-10 pr-4 py-2 bg-zinc-50 border-none rounded-xl focus:ring-2 focus:ring-red-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50 shadow-inner">
            <button
              onClick={() => setView('table')}
              className={`p-2 rounded-lg transition-all ${view === 'table' ? 'bg-white text-emerald-600 shadow-sm border border-slate-100/50' : 'text-zinc-500 hover:text-zinc-700'}`}
              title={language === 'ar' ? 'عرض الجدول' : 'Table View'}
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setView('card')}
              className={`p-2 rounded-lg transition-all ${view === 'card' ? 'bg-white text-emerald-600 shadow-sm border border-slate-100/50' : 'text-zinc-500 hover:text-zinc-700'}`}
              title={language === 'ar' ? 'عرض الكروت' : 'Card View'}
            >
              <LayoutGrid size={18} />
            </button>
          </div>
        </div>

        {view === 'table' ? (
          <div ref={tableRef} id="purchase-returns-list-table" className="hidden md:block overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="bg-zinc-50/50 text-zinc-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-bold cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('return_number')}>
                    <div className="flex items-center gap-1">
                      رقم المرتجع
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {sortBy === 'return_number' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className="px-6 py-4 font-bold cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('supplier_name')}>
                    <div className="flex items-center gap-1">
                      المورد
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {sortBy === 'supplier_name' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className="px-6 py-4 font-bold cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('date')}>
                    <div className="flex items-center gap-1">
                      التاريخ
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {sortBy === 'date' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className="px-6 py-4 font-bold cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('payment_type')}>
                    <div className="flex items-center gap-1">
                      النوع
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {sortBy === 'payment_type' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className="px-6 py-4 font-bold cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('total_amount')}>
                    <div className="flex items-center gap-1">
                      المبلغ
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {sortBy === 'total_amount' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className={`px-6 py-4 font-bold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                    {language === 'ar' ? 'رقم القيد' : 'Journal Entry'}
                  </th>
                  <th className="px-6 py-4 font-bold text-left">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filteredReturns.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-400 italic">لا توجد مرتجعات مشتريات حالياً</td>
                  </tr>
                ) : filteredReturns.map((ret) => (
                  <tr 
                    key={ret.id} 
                    className="hover:bg-zinc-50/50 transition-colors group cursor-pointer"
                    onClick={() => handleEdit(ret)}
                  >
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs bg-red-50 px-2 py-1 rounded text-red-700 font-bold">{ret.return_number}</span>
                    </td>
                    <td className="px-6 py-4 font-bold text-zinc-900">{ret.supplier_name}</td>
                    <td className="px-6 py-4 text-zinc-500">{formatDate(ret.date)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${ret.payment_type === 'cash' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                        {ret.payment_type === 'cash' ? 'نقدي' : 'آجل'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-zinc-900">{formatNumber(ret.total_amount)} ج.م</td>
                    <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                      {ret.entry_number ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingViewDoc({ type: 'journal', idOrNumber: ret.entry_number! });
                            setCurrentPage('journal_entries');
                          }}
                          className="text-emerald-600 hover:text-emerald-700 hover:underline font-mono text-xs font-bold bg-emerald-50 px-2 py-1 rounded border border-emerald-100/50 transition-all active:scale-95 animate-in fade-in"
                        >
                          {ret.entry_number}
                        </button>
                      ) : (
                        <span className="text-zinc-400 font-mono text-xs">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-left">
                      <div className="flex items-center justify-start gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActivityLogDocumentId(ret.id);
                            setIsActivityLogOpen(true);
                          }}
                          className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all no-pdf"
                          title="سجل النشاط"
                        >
                          <History size={18} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewReturn(ret.id);
                          }}
                          className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all no-pdf"
                        >
                          <Eye size={18} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(ret);
                          }}
                          className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all no-pdf"
                          title="تعديل"
                        >
                          <Edit size={18} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            exportToPDF(ret);
                          }}
                          className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all no-pdf"
                        >
                          <Download size={18} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(ret.id);
                          }}
                          className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all no-pdf"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationControls page={page} limit={limit} total={totalRecords} onPageChange={setPage} onLimitChange={setLimit} />
          </div>
        ) : (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredReturns.map((ret) => (
              <div 
                key={ret.id} 
                onClick={() => handleEdit(ret)}
                className="p-6 bg-zinc-50/50 rounded-3xl border border-zinc-100 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5 transition-all group relative overflow-hidden cursor-pointer flex flex-col justify-between"
              >
                <div className="absolute top-4 left-4 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewReturn(ret.id);
                    }}
                    className="p-2 bg-white text-emerald-500 rounded-xl border border-emerald-50 shadow-sm hover:bg-emerald-50 transition-all font-bold"
                  >
                    <Eye size={16} />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(ret);
                    }}
                    className="p-2 bg-white text-blue-500 rounded-xl border border-blue-50 shadow-sm hover:bg-blue-50 transition-all font-bold"
                  >
                    <Edit size={16} />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(ret.id);
                    }}
                    className="p-2 bg-white text-red-500 rounded-xl border border-red-50 shadow-sm hover:bg-red-50 transition-all font-bold"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                
                <div className="flex flex-col h-full justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-red-50 px-2 py-1 rounded text-red-700 font-bold">{ret.return_number}</span>
                        {ret.entry_number && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingViewDoc({ type: 'journal', idOrNumber: ret.entry_number! });
                              setCurrentPage('journal_entries');
                            }}
                            className="font-mono text-[9px] bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded text-emerald-700 font-bold border border-emerald-100/50 transition-all active:scale-95 z-10"
                          >
                            {ret.entry_number}
                          </button>
                        )}
                      </div>
                      <span className="text-xs text-zinc-400 font-medium">{formatDate(ret.date)}</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-zinc-900 group-hover:text-emerald-600 transition-colors">{ret.supplier_name}</h4>
                      <p className="text-xs text-zinc-400 mt-1">
                        {ret.payment_type === 'cash' ? 'نقدي' : 'آجل'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center justify-between">
                    <span className="text-zinc-500 text-xs font-bold">إجمالي المرتجع</span>
                    <span className="font-black text-emerald-600 text-lg">
                      {formatNumber(ret.total_amount)} ج.م
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {filteredReturns.length === 0 && !loading && (
              <div className="col-span-full py-12 text-center text-zinc-500 italic">لا توجد مرتجعات مشتريات حالياً</div>
            )}
            <div className="col-span-full">
              <PaginationControls page={page} limit={limit} total={totalRecords} onPageChange={setPage} onLimitChange={setLimit} />
            </div>
          </div>
        )}

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-zinc-100">
          {filteredReturns.length === 0 ? (
            <div className="px-6 py-12 text-center text-zinc-400 italic">لا توجد مرتجعات مشتريات حالياً</div>
          ) : (
            filteredReturns.map((ret) => (
              <div 
                key={ret.id} 
                onClick={() => handleEdit(ret)}
                className="p-4 space-y-3 hover:bg-zinc-50 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs bg-red-50 px-2 py-1 rounded text-red-700 font-bold">{ret.return_number}</span>
                    {ret.entry_number && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingViewDoc({ type: 'journal', idOrNumber: ret.entry_number! });
                          setCurrentPage('journal_entries');
                        }}
                        className="font-mono text-[9px] bg-emerald-50 px-2 py-1 rounded text-emerald-700 font-bold border border-emerald-100/50"
                      >
                        {ret.entry_number}
                      </button>
                    )}
                  </div>
                  <span className="text-xs text-zinc-500 flex items-center gap-1">
                    <Calendar size={12} />
                    {formatDate(ret.date)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-600 flex items-center justify-center">
                      <User size={14} />
                    </div>
                    <span className="font-bold text-zinc-900">{ret.supplier_name}</span>
                  </div>
                  <span className="font-bold text-red-600">{formatNumber(ret.total_amount)} ج.م</span>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                  <button 
                    onClick={() => {
                      setActivityLogDocumentId(ret.id);
                      setIsActivityLogOpen(true);
                    }}
                    className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all"
                    title="سجل النشاط"
                  >
                    <History size={16} />
                  </button>
                  <button 
                    onClick={() => handleViewReturn(ret.id)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 text-emerald-600 bg-emerald-50 rounded-xl font-bold text-sm"
                  >
                    <Eye size={16} />
                    عرض
                  </button>
                  <button 
                    onClick={() => handleEdit(ret)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 text-blue-600 bg-blue-50 rounded-xl font-bold text-sm"
                  >
                    <Edit size={16} />
                    تعديل
                  </button>
                  <button 
                    onClick={() => exportToPDF(ret)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 text-blue-600 bg-blue-50 rounded-xl font-bold text-sm"
                  >
                    <Download size={16} />
                    PDF
                  </button>
                  <button 
                    onClick={() => handleDelete(ret.id)}
                    className="p-2 text-red-600 bg-red-50 rounded-xl"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className={`fixed inset-0 bg-zinc-100 dark:bg-zinc-900 z-[100] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300 ${isFullScreen ? 'm-0 rounded-none' : 'md:m-4 md:rounded-[2.5rem] shadow-2xl border border-white/20'}`}>
          {/* Header Block */}
          <div className="p-4 md:p-6 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-[90]">
            <div className="flex items-center gap-3">
              <button 
                onClick={closeModal}
                className="p-3 hover:bg-zinc-100 rounded-2xl transition-all text-zinc-400 hover:text-zinc-900 group"
              >
                <div className="flex items-center gap-2">
                  <RotateCcw className={`w-5 h-5 transition-transform group-hover:-rotate-45`} />
                  <span className="text-sm font-bold">{t('common.back')}</span>
                </div>
              </button>
              <div className="w-px h-6 bg-zinc-200 mx-2" />
              <button
                type="button"
                onClick={() => setShowSidePanel(!showSidePanel)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                  showSidePanel 
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm' 
                    : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 border-transparent'
                } border`}
              >
                <History size={18} />
                <span>{language === 'ar' ? 'قيد اليومية \\ سجل التعديلات' : 'Journal Entry / Activity Log'}</span>
              </button>
            </div>

            <div className="flex items-center gap-4">
              {editingReturn && (
                <div className="hidden lg:flex items-center gap-2 bg-zinc-100 p-1.5 rounded-2xl">
                  <button 
                    type="button"
                    onClick={handlePrevReturn}
                    className="flex items-center gap-1 px-3 py-1.5 hover:bg-white rounded-xl transition-all text-zinc-600 disabled:opacity-30 text-xs font-black"
                    disabled={purchaseReturns.findIndex(r => r.id === editingReturn.id) === 0}
                  >
                    {dir === 'rtl' ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    {language === 'ar' ? 'السابق' : 'Prev'}
                  </button>
                  <button 
                    type="button"
                    onClick={handleNextReturn}
                    className="flex items-center gap-1 px-3 py-1.5 hover:bg-white rounded-xl transition-all text-zinc-600 disabled:opacity-30 text-xs font-black"
                    disabled={purchaseReturns.findIndex(r => r.id === editingReturn.id) === purchaseReturns.length - 1}
                  >
                    {language === 'ar' ? 'التالي' : 'Next'}
                    {dir === 'rtl' ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="p-2 text-zinc-400 hover:bg-zinc-100 rounded-xl transition-all hidden md:block"
                title={isFullScreen ? t('common.minimize') : t('common.maximize')}
              >
                {isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
              </button>
              <h3 className="text-xl md:text-2xl font-black text-zinc-900 tracking-tight">
                {editingReturn ? 'تعديل مرتجع مشتريات' : 'إضافة مرتجع مشتريات'}
              </h3>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row h-full relative">
            {/* Side Panel for Activity Log and Journal Entry */}
            <AnimatePresence>
              {showSidePanel && (
                <motion.div 
                  initial={{ x: '-100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '-100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  className="absolute inset-y-0 left-0 z-[80] w-full lg:w-96 shadow-2xl lg:shadow-none lg:relative lg:inset-auto"
                >
                  <div className="h-full bg-white border-r border-zinc-100 flex flex-col">
                    <div className="p-4 border-b border-zinc-100 flex items-center justify-between lg:hidden">
                      <h3 className="font-bold text-zinc-900">{t('common.activity_log')}</h3>
                      <button onClick={() => setShowSidePanel(false)} className="p-2 text-zinc-400 hover:text-zinc-600">
                        <X size={20} />
                      </button>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <TransactionSidePanel 
                        documentId={editingReturn?.id || ''}
                        category="purchase_returns" 
                        previewJournalEntry={previewJournalEntry}
                        previewActivityLog={previewActivityLog}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 pb-32 md:pb-8">
              <SmartAIInput transactionType="purchase_return" onDataExtracted={applyAiData} />
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-3 space-y-6">
                  {/* Card 1: Basic Info */}
                  <section className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm space-y-6 relative pt-12">
                    <div className="absolute top-4 right-4 flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                      <FileText className="w-4 h-4" />
                      <span className="text-xs font-bold">البيانات الأساسية</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div>
                        <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">رقم المرتجع</label>
                        <div className="relative">
                          <RotateCcw className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                          <input 
                            readOnly
                            type="text"
                            className={`w-full ${dir === 'rtl' ? 'ps-4 pe-12' : 'pe-4 ps-12'} py-3 bg-zinc-50 border border-zinc-200 rounded-2xl font-bold text-zinc-800 text-sm outline-none`}
                            value={returnNumber}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">المورد</label>
                        <div className="relative group">
                          <User className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                          <select 
                            required
                            className={`w-full ${dir === 'rtl' ? 'ps-10 pe-12' : 'pe-10 ps-12'} py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-zinc-800 appearance-none text-sm cursor-pointer`}
                            value={returnData.supplier_id}
                            onChange={(e) => {
                              if (e.target.value === 'new') {
                                setIsSupplierModalOpen(true);
                              } else {
                                setReturnData({...returnData, supplier_id: e.target.value});
                              }
                            }}
                          >
                            <option value="">اختر المورد...</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                            <option value="new" className="font-bold text-emerald-600">+ إضافة مورد جديد...</option>
                          </select>
                          <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">{language === 'ar' ? 'المخزن' : 'Warehouse'}</label>
                        <div className="relative group">
                          <Box className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                          <select 
                            required
                            className={`w-full ${dir === 'rtl' ? 'ps-10 pe-12' : 'pe-10 ps-12'} py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-zinc-800 appearance-none text-sm cursor-pointer`}
                            value={returnData.warehouse_id}
                            onChange={(e) => setReturnData({...returnData, warehouse_id: e.target.value})}
                          >
                            <option value="">{language === 'ar' ? 'اختر المخزن...' : 'Select Warehouse...'}</option>
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                          </select>
                          <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">تاريخ المرتجع</label>
                        <div className="relative">
                          <Calendar className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                          <input 
                            required
                            type="date"
                            className={`w-full ${dir === 'rtl' ? 'ps-4 pe-12' : 'pe-4 ps-12'} py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-zinc-800 text-sm`}
                            value={returnData.date}
                            onChange={(e) => setReturnData({...returnData, date: e.target.value})}
                          />
                        </div>
                      </div>

                      {editingReturn?.entry_number && (
                        <div>
                          <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">{language === 'ar' ? 'رقم القيد المرتبط' : 'Linked Journal Entry'}</label>
                          <div className="relative">
                            <Layers className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-emerald-500 pointer-events-none`} />
                            <input 
                              readOnly
                              type="text"
                              className={`w-full ${dir === 'rtl' ? 'ps-4 pe-12' : 'pe-4 ps-12'} py-3 bg-emerald-50 border border-emerald-200 rounded-2xl outline-none transition-all font-bold text-emerald-800 text-sm`}
                              value={editingReturn.entry_number}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Card 2: Payment settings */}
                  <section className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm space-y-6 relative pt-12">
                    <div className="absolute top-4 right-4 flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                      <Wallet className="w-4 h-4" />
                      <span className="text-xs font-bold">إعدادات الدفع</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">نوع المرتجع</label>
                        <div className="grid grid-cols-2 gap-3 p-1 bg-zinc-100 rounded-2xl">
                          <button
                            type="button"
                            onClick={() => setReturnData({ ...returnData, payment_type: 'cash' })}
                            className={`py-2 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm ${returnData.payment_type === 'cash' ? 'bg-white text-emerald-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                          >
                            <Wallet size={16} />
                            نقدي
                          </button>
                          <button
                            type="button"
                            onClick={() => setReturnData({ ...returnData, payment_type: 'credit' })}
                            className={`py-2 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm ${returnData.payment_type === 'credit' ? 'bg-white text-emerald-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                          >
                            <Layers size={16} />
                            آجل
                          </button>
                        </div>
                      </div>

                      {returnData.payment_type === 'cash' && (
                        <div className="animate-in slide-in-from-top-2 duration-200">
                          <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">طريقة استرداد المبلغ</label>
                          <div className="relative group">
                            <CreditCard className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                            <select 
                              required
                              className={`w-full ${dir === 'rtl' ? 'ps-10 pe-12' : 'pe-10 ps-12'} py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-zinc-800 appearance-none text-sm cursor-pointer`}
                              value={returnData.payment_method_id}
                              onChange={(e) => {
                                if (e.target.value === 'new') {
                                  setIsPaymentMethodModalOpen(true);
                                } else {
                                  setReturnData({...returnData, payment_method_id: e.target.value});
                                }
                              }}
                            >
                              <option value="">اختر الطريقة...</option>
                              {paymentMethods.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                              ))}
                              <option value="new" className="font-bold text-emerald-600">+ إضافة طريقة دفع...</option>
                            </select>
                            <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">ملاحظات</label>
                      <textarea 
                        rows={2}
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none text-sm font-bold text-zinc-800"
                        placeholder="سبب الارتجاع أو أي ملاحظات..."
                        value={returnData.notes}
                        onChange={(e) => setReturnData({...returnData, notes: e.target.value})}
                      />
                    </div>
                  </section>

                  {/* Card 3: Items */}
                  <section className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm space-y-6 relative pt-12">
                    <div className="absolute top-4 right-4 flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                      <Package className="w-4 h-4" />
                      <span className="text-xs font-bold">الأصناف المرتجعة</span>
                    </div>

                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsProductModalOpen(true);
                          }}
                          className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold border border-emerald-100 hover:bg-emerald-100 transition-all"
                        >
                          + إضافة صنف جديد
                        </button>
                        <button
                          type="button"
                          onClick={addItem}
                          className="px-4 py-2 bg-zinc-100 text-zinc-600 rounded-xl text-xs font-bold hover:bg-zinc-200 transition-all"
                        >
                          <Plus size={14} className="inline-block me-1" />
                          إضافة صف جديد
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
                      <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'} text-sm`}>
                        <thead className="bg-zinc-50 text-zinc-400 uppercase text-[10px] font-black tracking-widest border-b border-zinc-100">
                          <tr>
                            <th className="px-6 py-4 w-12 text-center">صورة</th>
                            <th className="px-6 py-4">الصنف</th>
                            <th className="px-6 py-4 w-28 text-center">الكمية</th>
                            <th className="px-6 py-4 w-32 text-center">سعر التكلفة</th>
                            <th className={`px-6 py-4 w-32 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>الإجمالي</th>
                            <th className="px-6 py-4 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50">
                          {items.map((item, index) => (
                            <tr key={index} className="hover:bg-zinc-50/50 transition-colors group">
                              <td className="px-6 py-3 text-center">
                                {(item as any).product_image_url ? (
                                  <img 
                                    src={(item as any).product_image_url} 
                                    alt="Product" 
                                    className="w-10 h-10 object-cover rounded-xl mx-auto border border-zinc-100 shadow-sm"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="w-10 h-10 bg-zinc-50 rounded-xl flex items-center justify-center mx-auto border border-zinc-100">
                                    <Box size={16} className="text-zinc-300" />
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-3">
                                <div className="relative">
                                  <select 
                                    className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2.5 outline-none font-bold text-zinc-800 appearance-none text-xs focus:ring-2 focus:ring-emerald-500 transition-all"
                                    value={item.product_id}
                                    onChange={(e) => {
                                      if (e.target.value === 'new_product') {
                                        setIsProductModalOpen(true);
                                      } else {
                                        updateItem(index, 'product_id', e.target.value);
                                      }
                                    }}
                                  >
                                    <option value="">اختر الصنف...</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                                    <option value="new_product" className="font-bold text-emerald-600">+ إضافة صنف جديد</option>
                                  </select>
                                  <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-3' : 'right-3'} top-3 w-4 h-4 text-zinc-400 pointer-events-none`} />
                                </div>
                              </td>
                              <td className="px-6 py-3">
                                <input 
                                  type="number"
                                  step="any"
                                  className="w-full bg-zinc-50 border border-transparent focus:bg-white focus:ring-2 focus:ring-emerald-500 rounded-xl px-4 py-2.5 text-xs outline-none text-center font-bold text-zinc-800 transition-all"
                                  value={item.quantity}
                                  onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                                />
                              </td>
                              <td className="px-6 py-3">
                                <input 
                                  type="number"
                                  step="any"
                                  className="w-full bg-zinc-50 border border-transparent focus:bg-white focus:ring-2 focus:ring-emerald-500 rounded-xl px-4 py-2.5 text-xs outline-none text-center font-bold text-zinc-800 transition-all"
                                  value={item.cost_price}
                                  onChange={(e) => updateItem(index, 'cost_price', Number(e.target.value))}
                                />
                              </td>
                              <td className={`px-6 py-3 font-bold text-zinc-900 text-sm ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>
                                {formatNumber(item.quantity * item.cost_price)}
                              </td>
                              <td className="px-6 py-3 text-center">
                                <button 
                                  type="button"
                                  onClick={() => removeItem(index)}
                                  className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Summary Section */}
                    <div className="mt-8 flex justify-end">
                      <div className="bg-zinc-900 text-white rounded-3xl p-8 min-w-[300px] space-y-4 shadow-xl">
                        <div className="flex justify-between items-center text-zinc-400 text-xs font-bold uppercase tracking-widest">
                          <span>إجمالي المرتجع</span>
                        </div>
                        <div className="flex justify-between items-baseline gap-4">
                          <span className="text-4xl font-black tracking-tighter text-emerald-400">
                            {formatNumber(calculateTotal())}
                          </span>
                          <span className="font-bold text-zinc-400">ج.م</span>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </div>

              {/* Action Footer */}
              <div className="flex gap-4 p-6 bg-zinc-50 border-t border-zinc-100 sticky bottom-0 z-[60] mt-auto">
                <button 
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-4 bg-white text-zinc-600 rounded-2xl font-bold border border-zinc-200 hover:bg-zinc-100 transition-all active:scale-95 shadow-sm"
                >
                  {t('common.cancel')}
                </button>
                <button 
                  type="submit"
                  disabled={items.length === 0 || returnData.supplier_id === ''}
                  className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-3"
                >
                  <Save className="w-6 h-6" />
                  {editingReturn ? 'حفظ التعديلات' : 'حفظ المرتجع'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* View Return Modal */}
      {viewReturn && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center md:p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div ref={returnRef} id="purchase-return-capture-area" className="bg-white w-full max-w-2xl md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 min-h-screen md:min-h-0 my-auto" style={{ backgroundColor: '#ffffff', color: '#18181b' }}>
            <div className="p-6 border-b border-zinc-50 flex items-center justify-between bg-zinc-50/50 sticky top-0 z-10" style={{ backgroundColor: '#f4f4f5' }}>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-zinc-900" style={{ color: '#18181b' }}>تفاصيل مرتجع المشتريات: {viewReturn.return_number}</h3>
                <button 
                  onClick={() => {
                    setActivityLogDocumentId(viewReturn.id);
                    setIsActivityLogOpen(true);
                  }}
                  className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all"
                  title="سجل النشاط"
                >
                  <History size={20} />
                </button>
              </div>
              <button onClick={() => setViewReturn(null)} className="text-zinc-400 hover:text-zinc-600 p-2 hover:bg-zinc-100 rounded-full transition-all">
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row h-full">
              {/* Side Panel for Activity Log and Journal Entry */}
              <TransactionSidePanel 
                documentId={viewReturn.id} 
                category="purchase_returns" 
              />

              <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8">
                <CompanyInvoiceHeader 
                  company={company} 
                  documentNumber={viewReturn.return_number}
                  documentDate={formatDate(viewReturn.date)}
                  title="مرتجع مشتريات"
                />

                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1" style={{ color: '#71717a' }}>المورد</p>
                    <p className="text-lg font-bold text-zinc-900" style={{ color: '#18181b' }}>{viewReturn.supplier_name}</p>
                    {viewReturn.warehouse_id && (
                      <p className="text-xs text-slate-500 font-medium mt-1">
                        {language === 'ar' ? 'المخزن:' : 'Warehouse:'} <span className="text-emerald-600 font-bold">{warehouses.find((w: any) => w.id?.toString() === viewReturn.warehouse_id?.toString())?.name || viewReturn.warehouse_id}</span>
                      </p>
                    )}
                    {viewReturn.entry_number && (
                      <p className="text-xs text-slate-500 font-medium mt-1">
                        {language === 'ar' ? 'رقم القيد:' : 'Journal Entry:'} <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewReturn(null);
                            setPendingViewDoc({ type: 'journal', idOrNumber: viewReturn.entry_number! });
                            setCurrentPage('journal_entries');
                          }}
                          className="text-emerald-600 hover:text-emerald-700 hover:underline font-mono font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100/50"
                        >
                          {viewReturn.entry_number}
                        </button>
                      </p>
                    )}
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1" style={{ color: '#71717a' }}>التاريخ</p>
                    <p className="text-lg font-bold text-zinc-900" style={{ color: '#18181b' }}>{formatDate(viewReturn.date)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1" style={{ color: '#71717a' }}>نوع المرتجع</p>
                    <p className="text-lg font-bold text-zinc-900" style={{ color: '#18181b' }}>{viewReturn.payment_type === 'cash' ? 'نقدي' : 'آجل'}</p>
                  </div>
                  {viewReturn.payment_type === 'cash' && (
                    <div className="text-left">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1" style={{ color: '#71717a' }}>طريقة الدفع</p>
                      <p className="text-lg font-bold text-zinc-900" style={{ color: '#18181b' }}>{viewReturn.payment_method_name}</p>
                    </div>
                  )}
                </div>

                <div className="border border-zinc-100 rounded-2xl overflow-hidden" style={{ borderColor: '#f4f4f5' }}>
                  <table className="w-full text-right text-sm border-collapse">
                    <thead className="bg-zinc-50 text-zinc-500 uppercase text-[10px] font-bold tracking-wider" style={{ backgroundColor: '#fafafa' }}>
                      <tr>
                        <th className="px-6 py-3 w-16 text-center" style={{ color: '#71717a' }}>صورة</th>
                        <th className="px-6 py-3" style={{ color: '#71717a' }}>الصنف</th>
                        <th className="px-6 py-3" style={{ color: '#71717a' }}>الكمية</th>
                        <th className="px-6 py-3 hidden md:table-cell" style={{ color: '#71717a' }}>السعر</th>
                        <th className="px-6 py-3" style={{ color: '#71717a' }}>الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50" style={{ borderColor: '#fafafa' }}>
                      {viewReturn.items?.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td className="px-6 py-4 text-center">
                            {item.product_image_url ? (
                              <img 
                                src={item.product_image_url} 
                                alt={item.product_name} 
                                className="w-10 h-10 object-cover rounded-lg mx-auto border border-[#f4f4f5]"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-[#fafafa] rounded-lg flex items-center justify-center mx-auto border border-[#f4f4f5]">
                                <Box size={16} className="text-[#a1a1aa]" />
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 font-bold text-zinc-900" style={{ color: '#18181b' }}>{item.product_name}</td>
                          <td className="px-6 py-4 text-zinc-500" style={{ color: '#71717a' }}>{item.quantity}</td>
                          <td className="px-6 py-4 text-zinc-500 hidden md:table-cell" style={{ color: '#71717a' }}>{formatNumber(item.price)}</td>
                          <td className="px-6 py-4 font-bold text-zinc-900" style={{ color: '#18181b' }}>{formatNumber(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50/50 font-bold border-t border-slate-100">
                      <tr className="bg-slate-900 text-white font-bold">
                        <td colSpan={4} className="px-6 py-5 text-right font-black text-lg uppercase tracking-tight">الإجمالي الكلي</td>
                        <td className="px-6 py-5 text-2xl font-black text-emerald-400">{formatNumber(viewReturn.total_amount)} ج.م</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="flex flex-col md:flex-row gap-3 pt-4 sticky bottom-0 bg-white p-4 md:p-0">
                  <button 
                    onClick={() => exportToPDF(viewReturn)}
                    className="flex-1 py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all flex items-center justify-center gap-2"
                  >
                    <Download size={20} />
                    تحميل PDF
                  </button>
                  <button 
                    onClick={() => setViewReturn(null)}
                    className="flex-1 py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Supplier Modal */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-4xl md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-4 md:p-6 border-b border-zinc-50 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg md:text-xl font-bold text-zinc-900">إضافة مورد جديد</h3>
              <button onClick={() => setIsSupplierModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 p-2 hover:bg-zinc-100 rounded-xl transition-all"><X size={24} /></button>
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              <form onSubmit={handleSupplierSubmit} className="p-4 md:p-8 space-y-5 flex-1 overflow-y-auto pb-32 md:pb-8">
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">اسم المورد</label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <input
                        required
                        type="text"
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={supplierFormData.name}
                        onChange={(e) => setSupplierFormData({ ...supplierFormData, name: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">رقم الهاتف</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <input
                        required
                        type="tel"
                        pattern="[0-9]{11,}"
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-left"
                        value={supplierFormData.mobile}
                        onChange={(e) => setSupplierFormData({ ...supplierFormData, mobile: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">البريد الإلكتروني</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <input
                        type="email"
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-left"
                        value={supplierFormData.email}
                        onChange={(e) => setSupplierFormData({ ...supplierFormData, email: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">العنوان</label>
                    <textarea
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      rows={2}
                      value={supplierFormData.address}
                      onChange={(e) => setSupplierFormData({ ...supplierFormData, address: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">رصيد أول</label>
                      <div className="relative">
                        <Wallet className="absolute left-3 top-3 text-zinc-400" size={18} />
                        <input 
                          type="number" 
                          className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          value={supplierFormData.opening_balance}
                          onChange={(e) => setSupplierFormData({ ...supplierFormData, opening_balance: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">تاريخ الرصيد</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-3 text-zinc-400" size={18} />
                        <input 
                          type="date" 
                          className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          value={supplierFormData.opening_balance_date}
                          onChange={(e) => setSupplierFormData({ ...supplierFormData, opening_balance_date: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">الحساب المحاسبي</label>
                    <select
                      required
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={supplierFormData.account_id}
                      onChange={(e) => setSupplierFormData({ ...supplierFormData, account_id: e.target.value })}
                    >
                      <option value="">اختر الحساب...</option>
                      {accounts.map(account => (
                        <option key={account.id} value={account.id}>
                          {account.code} - {account.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {supplierFormData.opening_balance !== 0 && (
                    <div className="animate-in slide-in-from-top-2 duration-200">
                      <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">حساب مقابل رصيد أول المدة</label>
                      <select
                        required
                        className="w-full px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={supplierFormData.counter_account_id}
                        onChange={(e) => setSupplierFormData({ ...supplierFormData, counter_account_id: e.target.value })}
                      >
                        <option value="">اختر الحساب المقابل...</option>
                        {accounts.map(account => (
                          <option key={account.id} value={account.id}>
                            {account.code} - {account.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-emerald-600 mt-1 font-medium">يستخدم هذا الحساب لإنشاء قيد رصيد أول المدة (مثلاً: رأس المال أو الأرباح المرحلة)</p>
                    </div>
                  )}
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                  >
                    حفظ المورد
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsSupplierModalOpen(false)}
                    className="px-8 py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all active:scale-95"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-2xl md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-4 md:p-6 border-b border-zinc-50 flex items-center justify-between bg-white z-10">
              <h3 className="text-lg md:text-xl font-bold text-zinc-900">إضافة صنف جديد</h3>
              <button onClick={() => setIsProductModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 p-2 hover:bg-zinc-100 rounded-xl transition-all"><X size={24} /></button>
            </div>
            <form onSubmit={handleProductSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="p-4 md:p-6 space-y-4 flex-1 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">اسم الصنف</label>
                    <input
                      required
                      type="text"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={productFormData.name}
                      onChange={(e) => setProductFormData({ ...productFormData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">الكود (SKU)</label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={productFormData.code}
                      onChange={(e) => setProductFormData({ ...productFormData, code: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">التصنيف</label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={productFormData.category}
                      onChange={(e) => setProductFormData({ ...productFormData, category: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">الوحدة</label>
                    <select
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={productFormData.unit}
                      onChange={(e) => setProductFormData({ ...productFormData, unit: e.target.value })}
                    >
                      <option value="قطعة">قطعة</option>
                      <option value="كيلو">كيلو</option>
                      <option value="متر">متر</option>
                      <option value="لتر">لتر</option>
                      <option value="علبة">علبة</option>
                      <option value="كرتونة">كرتونة</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">سعر الشراء</label>
                    <input
                      required
                      type="number"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={productFormData.cost_price}
                      onChange={(e) => setProductFormData({ ...productFormData, cost_price: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">سعر البيع</label>
                    <input
                      required
                      type="number"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={productFormData.sale_price}
                      onChange={(e) => setProductFormData({ ...productFormData, sale_price: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">الكمية الحالية</label>
                    <input
                      type="number"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={productFormData.stock}
                      onChange={(e) => setProductFormData({ ...productFormData, stock: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">حد الطلب</label>
                    <input
                      type="number"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={productFormData.min_stock}
                      onChange={(e) => setProductFormData({ ...productFormData, min_stock: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
              <div className="p-4 md:p-6 border-t border-zinc-50 bg-zinc-50/50 flex gap-3 sticky bottom-0">
                <button 
                  type="submit"
                  className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                >
                  حفظ الصنف
                </button>
                <button 
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-8 py-4 bg-zinc-200 text-zinc-700 rounded-2xl font-bold hover:bg-zinc-300 transition-all active:scale-95"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Payment Method Modal */}
      {isPaymentMethodModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full h-full md:h-auto md:max-w-md md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-4 md:p-6 border-b border-zinc-50 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg md:text-xl font-bold text-zinc-900">إضافة طريقة دفع جديدة</h3>
              <button onClick={() => setIsPaymentMethodModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 p-2 hover:bg-zinc-100 rounded-xl transition-all"><X size={24} /></button>
            </div>
            <form onSubmit={handlePaymentMethodSubmit} className="p-4 md:p-6 space-y-4 flex-1 overflow-y-auto pb-32 md:pb-6">
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">اسم الطريقة (خزينة/بنك)</label>
                <input
                  required
                  type="text"
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  value={paymentMethodFormData.name}
                  onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">النوع</label>
                <select
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  value={paymentMethodFormData.type}
                  onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, type: e.target.value as 'cash' | 'bank' })}
                >
                  <option value="cash">خزينة نقدي</option>
                  <option value="bank">حساب بنكي</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">رقم الحساب (اختياري)</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  value={paymentMethodFormData.account_number}
                  onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, account_number: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">رصيد أول</label>
                <input
                  type="number"
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  value={paymentMethodFormData.opening_balance}
                  onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, opening_balance: Number(e.target.value) })}
                />
              </div>
              <div className="pt-4 pb-8 md:pb-0">
                <button 
                  type="submit"
                  className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                >
                  حفظ طريقة الدفع
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-md rounded-3xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-zinc-900 mb-4">تأكيد الحذف</h3>
            <p className="text-zinc-500 mb-6">هل أنت متأكد من رغبتك في حذف هذا المرتجع؟ لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setReturnToDelete(null);
                }}
                className="flex-1 py-3 bg-zinc-100 text-zinc-600 rounded-xl font-bold hover:bg-zinc-200 transition-all"
              >
                إلغاء
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
              >
                حذف
              </button>
            </div>
          </div>
        </div>
      )}

      <PageActivityLog 
        isOpen={isActivityLogOpen}
        onClose={() => {
          setIsActivityLogOpen(false);
          setActivityLogDocumentId(undefined);
        }}
        category="purchase_returns"
        documentId={activityLogDocumentId}
      />
    </div>
  );
};
