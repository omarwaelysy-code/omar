import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { TransactionManager } from '../services/TransactionManager';
import { ReturnSchema, JournalEntrySchema } from '../lib/schemas';
import { Return, Customer, Product, ReturnItem, JournalEntry, JournalEntryItem, Account, PaymentMethod, Operation, Department, CostCenter } from '../types';
import { Search, Plus, Trash2, X, Eye, Download, FileText, RotateCcw, History, Printer, Phone, Mail, MapPin, Wallet, Calendar, Box, CreditCard, User, ChevronDown, Layers, Save, Package, ChevronRight, ChevronLeft, Maximize2, Minimize2, LayoutGrid, List, CheckCheck, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SmartAIInput } from '../components/SmartAIInput';
import { exportToPDF as exportToPDFUtil } from '../utils/pdfUtils';
import { exportToExcel, formatDataForExcel } from '../utils/excelUtils';
import { dbService } from '../services/dbService';
import { PageActivityLog } from '../components/PageActivityLog';
import { formatNumber, formatDate, formatMoney } from '../utils/formatUtils';
import { TransactionSidePanel } from '../components/TransactionSidePanel';
import { InlineActivityLog } from '../components/InlineActivityLog';
import { ExportButtons } from '../components/ExportButtons';
import { ActivityLog, Company } from '../types';
import { PaginationControls } from '../components/PaginationControls';
import { CompanyInvoiceHeader } from '../components/CompanyInvoiceHeader';
import { useNavigation } from '../contexts/NavigationContext';

export const Returns: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { showNotification } = useNotification();
  const { pendingViewDoc, setPendingViewDoc, setCurrentPage } = useNavigation();
  const [returns, setReturns] = useState<Return[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewReturn, setViewReturn] = useState<Return | null>(null);
  const [view, setView] = useState<'table' | 'card'>('table');

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [returnToDelete, setReturnToDelete] = useState<string | null>(null);
  const returnRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  const [activityLogDocumentId, setActivityLogDocumentId] = useState<string | undefined>(undefined);
  const [previewJournalEntry, setPreviewJournalEntry] = useState<JournalEntry | null>(null);
  const [previewActivityLog, setPreviewActivityLog] = useState<Partial<ActivityLog> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editingReturn, setEditingReturn] = useState<Return | null>(null);
  const [returnNumber, setReturnNumber] = useState('');
  const [company, setCompany] = useState<Company | null>(null);
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
    return await dbService.getNextSequence('returns', selectedDate);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingReturn(null);
    setSelectedCustomerId('');
    setSelectedWarehouseId('');
    setDate(new Date().toISOString().slice(0, 10));
    setPaymentType('credit');
    setPaymentMethodId('');
    setDiscount(0);
    setDescription('');
    setSelectedOperationId('');
    setSelectedDepartmentId('');
    setSelectedCostCenterId('');
    setItems([{ product_id: '', product_name: '', quantity: 1, unit_price: 0, total: 0 }]);
  };

  const handlePrevReturn = () => {
    if (!editingReturn) return;
    const currentIndex = returns.findIndex(r => r.id === editingReturn.id);
    if (currentIndex > 0) {
      openModal(returns[currentIndex - 1]);
    }
  };

  const handleNextReturn = () => {
    if (!editingReturn) return;
    const currentIndex = returns.findIndex(r => r.id === editingReturn.id);
    if (currentIndex < returns.length - 1) {
      openModal(returns[currentIndex + 1]);
    }
  };

  const [customerFormData, setCustomerFormData] = useState({
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

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentType, setPaymentType] = useState<'credit' | 'cash'>('credit');
  const [paymentMethodId, setPaymentMethodId] = useState<string>('');
  const [items, setItems] = useState<ReturnItem[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [description, setDescription] = useState<string>('');
  const [selectedOperationId, setSelectedOperationId] = useState<string>('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [selectedCostCenterId, setSelectedCostCenterId] = useState<string>('');
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    if (user) {
      const unsubItems = dbService.subscribePaginated('returns', {
        company_id: user.company_id,
        _page: page,
        _limit: limit,
        _sortBy: sortBy,
        _sortOrder: sortOrder,
        _search: searchTerm
      }, (result: any) => {
        setReturns(result.data);
        setTotalRecords(result.total);
        setServerSummary(result.summary);
      });
      const unsubCustomers = dbService.subscribe<Customer>('customers', user.company_id, setCustomers);
      const unsubProducts = dbService.subscribe<Product>('products', user.company_id, setProducts);
      const unsubAccounts = dbService.subscribe<Account>('accounts', user.company_id, setAccounts);
      const unsubPaymentMethods = dbService.subscribe<PaymentMethod>('payment_methods', user.company_id, setPaymentMethods);
      const unsubWarehouses = dbService.subscribe<any>('warehouses', user.company_id, setWarehouses);
      const unsubOperations = dbService.subscribe<Operation>('operations', user.company_id, setOperations);
      const unsubDepartments = dbService.subscribe<Department>('departments', user.company_id, setDepartments);
      const unsubCostCenters = dbService.subscribe<CostCenter>('cost_centers', user.company_id, setCostCenters);
      
      const fetchSettings = async () => {
        const docs = await dbService.getDocsByFilter<any>('settings', user.company_id, [
          { field: 'type', operator: '==', value: 'discount_settings' }
        ]);
        if (docs.length > 0) {
          setSettings(docs[0]);
        }
      };
      fetchSettings();

      setLoading(false);
      return () => {
        unsubItems();
        unsubCustomers();
        unsubProducts();
        unsubAccounts();
        unsubPaymentMethods();
        unsubWarehouses();
        unsubOperations();
        unsubDepartments();
        unsubCostCenters();
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
        const num = await generateReturnNumber(date);
        setReturnNumber(num);
      };
      updateNum();
    }

    const generatePreview = () => {
      const isVatEnabled = company?.settings?.vat_enabled || company?.vat_enabled || false;
      const subtotal = (items || []).reduce((sum, item) => sum + (Number(item.total) || 0), 0);
      const vatTotal = isVatEnabled ? (items || []).reduce((sum, item) => sum + (Number(item.vat_amount) || 0), 0) : 0;
      const total_amount = Number((subtotal + vatTotal - discount).toFixed(2)) || 0;

      if (total_amount <= 0) {
        setPreviewJournalEntry(null);
        setPreviewActivityLog(null);
        return;
      }

      const customer = customers.find(c => c.id === selectedCustomerId);
      const return_number = returnNumber || 'RET-PREVIEW';

      // Preview Activity Log
      setPreviewActivityLog({
        action: language === 'ar' ? 'إضافة مرتجع مبيعات' : 'Add Sales Return',
        details: language === 'ar' 
          ? `إضافة مرتجع مبيعات جديد للعميل ${customer?.name || '...'} بمبلغ ${formatNumber(total_amount)}`
          : `Add new sales return for customer ${customer?.name || '...'} with amount ${formatNumber(total_amount)}`,
        created_at: new Date().toISOString()
      });

      // Preview Journal Entry
      const journalItems: JournalEntryItem[] = [];

      // Debit: Sales/Revenue Accounts (per product)
      (items || []).forEach(item => {
        if (!item.product_id) return;
        const product = products.find(p => p.id === item.product_id);
        let debitAccountId = product?.revenue_account_id || '';
        let debitAccountName = product?.revenue_account_name || 'حساب مردودات المبيعات';
        const itemTotal = Number(item.total) || 0;
        const itemVat = isVatEnabled ? (Number(item.vat_amount) || 0) : 0;

        journalItems.push({
          account_id: debitAccountId,
          account_name: debitAccountName,
          debit: itemTotal,
          credit: 0,
          description: `مرتجع صنف: ${item.product_name} - مرتجع ${return_number}`
        });

        if (itemVat > 0) {
          let vatAccountId = product?.vat_account_id || '';
          let vatAccountName = product?.vat_account_name || (language === 'ar' ? 'حساب ضريبة القيمة المضافة' : 'VAT Liability Account');
          if (!vatAccountId) {
            const globalVatAccount = accounts.find(a => 
              a.name.includes('ضريبة القيمة المضافة') || a.name.includes('قيمة مضافة')
            );
            vatAccountId = globalVatAccount?.id || '';
            vatAccountName = globalVatAccount?.name || vatAccountName;
          }
          journalItems.push({
            account_id: vatAccountId,
            account_name: vatAccountName,
            debit: itemVat,
            credit: 0,
            description: `ضريبة القيمة المضافة مرتجعة - صنف: ${item.product_name} - مرتجع رقم ${return_number}`
          });
        }
      });

      // Credit: Customer or Cash
      let creditAccountId = '';
      let creditAccountName = '';

      if (paymentType === 'cash' && paymentMethodId) {
        const method = paymentMethods.find(m => m.id === paymentMethodId);
        creditAccountId = method?.account_id || '';
        creditAccountName = method?.account_name || 'حساب النقدية';
      } else {
        creditAccountId = customer?.account_id || '';
        creditAccountName = customer?.account_name || 'حساب العملاء';
      }

      if (discount > 0) {
        const discountAccountId = settings?.customer_discount_account_id || '';
        const discountAccount = accounts.find(a => a.id === discountAccountId);
        journalItems.push({
          account_id: discountAccountId,
          account_name: discountAccount?.name || 'حساب الخصم المسموح به',
          debit: 0,
          credit: discount,
          description: `تسوية خصم مرتجع مبيعات رقم ${return_number}`
        });
      }

      journalItems.push({
        account_id: creditAccountId,
        account_name: creditAccountName,
        debit: 0,
        credit: total_amount,
        description: `مرتجع مبيعات رقم ${return_number} - ${customer?.name || '...'}`,
        customer_id: paymentType === 'credit' ? selectedCustomerId : undefined,
        customer_name: paymentType === 'credit' ? customer?.name : undefined
      });

      const totalDebit = journalItems.reduce((sum, i) => sum + (Number(i.debit) || 0), 0);
      const totalCredit = journalItems.reduce((sum, i) => sum + (Number(i.credit) || 0), 0);

      setPreviewJournalEntry({
        id: 'preview',
        date,
        reference_number: return_number,
        reference_id: 'preview',
        reference_type: 'return',
        description: `قيد مرتجع مبيعات رقم ${return_number}`,
        items: journalItems,
        total_debit: totalDebit,
        total_credit: totalCredit,
        company_id: user.company_id,
        created_at: new Date().toISOString(),
        created_by: user.id
      });
    };

    generatePreview();
  }, [isModalOpen, items, selectedCustomerId, date, user, customers, products, accounts, discount, paymentType, paymentMethodId, settings, company]);

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const code = `CUST-${Date.now().toString().slice(-6)}`;
      const selectedAccount = accounts.find(a => a.id === customerFormData.account_id);
      const newCustomer = {
        ...customerFormData,
        code,
        account_name: selectedAccount?.name || '',
        company_id: user.company_id
      };
      const customerId = await dbService.add('customers', newCustomer);

      // Create Journal Entry for Opening Balance if it's not zero
      if (customerFormData.opening_balance !== 0 && customerFormData.account_id && customerFormData.counter_account_id) {
        const counterAccount = accounts.find(a => a.id === customerFormData.counter_account_id);
        const journalItems: JournalEntryItem[] = [
          {
            account_id: customerFormData.account_id,
            account_name: selectedAccount?.name || '',
            debit: customerFormData.opening_balance > 0 ? customerFormData.opening_balance : 0,
            credit: customerFormData.opening_balance < 0 ? Math.abs(customerFormData.opening_balance) : 0,
            description: `رصيد أول المدة - ${customerFormData.name}`
          },
          {
            account_id: customerFormData.counter_account_id,
            account_name: counterAccount?.name || '',
            debit: customerFormData.opening_balance < 0 ? Math.abs(customerFormData.opening_balance) : 0,
            credit: customerFormData.opening_balance > 0 ? customerFormData.opening_balance : 0,
            description: `رصيد أول المدة - ${customerFormData.name}`
          }
        ];

        const journalEntry: Omit<JournalEntry, 'id'> = {
          date: customerFormData.opening_balance_date,
          reference_number: `OB-${code}`,
          reference_id: customerId,
          reference_type: 'opening_balance',
          description: `قيد رصيد أول المدة للعميل: ${customerFormData.name}`,
          items: journalItems,
          total_debit: Math.abs(customerFormData.opening_balance),
          total_credit: Math.abs(customerFormData.opening_balance),
          company_id: user.company_id,
          created_at: new Date().toISOString(),
          created_by: user.id
        };
        await dbService.createJournalEntry(journalEntry);
      }

      await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة عميل', `إضافة عميل جديد من المرتجع: ${customerFormData.name}`, ['customers', 'returns']);
      
      setSelectedCustomerId(customerId);
      setIsCustomerModalOpen(false);
      setCustomerFormData({
        name: '',
        mobile: '',
        email: '',
        address: '',
        opening_balance: 0,
        opening_balance_date: new Date().toISOString().slice(0, 10),
        account_id: '',
        counter_account_id: ''
      });
      showNotification('تم إضافة العميل بنجاح');
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء إضافة العميل', 'error');
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
      await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة صنف', `إضافة صنف جديد من المرتجع: ${productFormData.name}`, ['products', 'returns']);
      
      addItem(productId);
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

  const addItem = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    setItems(prev => [...prev, {
      product_id: product.id,
      product_name: product.name,
      product_code: product.code,
      product_image_url: product.image_url,
      quantity: 1,
      unit_price: Number(product.sale_price) || 0,
      total: Number(product.sale_price) || 0
    }]);
  };

  const addEmptyRow = () => {
    setItems(prev => [...prev, {
      product_id: '',
      product_name: '',
      quantity: 1,
      unit_price: 0,
      total: 0
    }]);
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const applyOperationToAllItems = () => {
    if (!selectedOperationId) return;
    setItems(prev => prev.map(item => ({ ...item, operation_id: selectedOperationId })));
    showNotification(language === 'ar' ? 'تم تطبيق العملية على كافة الأصناف' : 'Operation applied to all items', 'success');
  };

  const applyDepartmentToAllItems = () => {
    if (!selectedDepartmentId) return;
    setItems(prev => prev.map(item => ({ ...item, department_id: selectedDepartmentId })));
    showNotification(language === 'ar' ? 'تم تطبيق الإدارة على كافة الأصناف' : 'Department applied to all items', 'success');
  };

  const applyCostCenterToAllItems = () => {
    if (!selectedCostCenterId) return;
    setItems(prev => prev.map(item => ({ ...item, cost_center_id: selectedCostCenterId })));
    showNotification(language === 'ar' ? 'تم تطبيق مركز التكلفة على كافة الأصناف' : 'Cost center applied to all items', 'success');
  };

  const updateItem = (index: number, field: keyof ReturnItem, value: any) => {
    setItems(prev => {
      const newItems = [...prev];
      const item = { ...newItems[index], [field]: value };
      const isVatEnabled = company?.settings?.vat_enabled || company?.vat_enabled || false;
      
      if (field === 'product_id') {
        const product = products.find(p => p.id === value);
        if (product) {
          item.product_name = product.name;
          item.product_image_url = product.image_url;
          item.unit_price = Number(product.sale_price) || 0;
          item.barcode = product.barcode || '';
          item.vat_rate = Number(product.vat_rate) || 0;
          const total = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
          item.total = total;
          item.vat_amount = isVatEnabled ? Number((total * ((item.vat_rate || 0) / 100)).toFixed(2)) : 0;
        } else {
          item.product_name = '';
          item.product_image_url = '';
          item.unit_price = 0;
          item.barcode = '';
          item.vat_rate = 0;
          item.total = 0;
          item.vat_amount = 0;
        }
      }
      
      if (field === 'quantity' || field === 'unit_price' || field === 'vat_rate') {
        const total = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
        item.total = total;
        item.vat_amount = isVatEnabled ? Number((total * ((item.vat_rate || 0) / 100)).toFixed(2)) : 0;
      }
      
      newItems[index] = item;
      return newItems;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedCustomerId || isSaving) return;

    if (paymentType === 'cash' && !paymentMethodId) {
      showNotification('يرجى اختيار طريقة الدفع للمرتجع النقدي', 'error');
      return;
    }

    const hasPhysicalProduct = items.some(item => {
      const prod = products.find(p => p.id === item.product_id);
      return prod && prod.type !== 'service';
    });

    if (hasPhysicalProduct && !selectedWarehouseId) {
      showNotification('يرجى اختيار المخزن', 'error');
      return;
    }
    
    const validItems = items.filter(item => item.product_id);
    if (validItems.length === 0) {
      showNotification('يرجى إضافة أصناف مكتملة للمرتجع', 'error');
      return;
    }

    const isVatEnabled = company?.settings?.vat_enabled || company?.vat_enabled || false;

    setIsSaving(true);
    try {
      const customer = customers.find(c => c.id === selectedCustomerId);
      const paymentMethod = paymentMethods.find(m => m.id === paymentMethodId);
      const return_number = editingReturn ? editingReturn.return_number : returnNumber;
      
      const subtotal = validItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
      const vatTotal = isVatEnabled ? validItems.reduce((sum, item) => sum + (Number(item.vat_amount) || 0), 0) : 0;
      const total_amount = Number((subtotal + vatTotal - discount).toFixed(2)) || 0;
      
      const sanitizedItems = validItems.map(i => ({
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: Number(i.quantity) || 0,
        unit_price: Number(i.unit_price) || 0,
        total: Number((Number(i.quantity) || 0) * (Number(i.unit_price) || 0)) || 0,
        barcode: i.barcode || '',
        image_url: i.image_url || i.product_image_url || '',
        operation_id: i.operation_id || null,
        department_id: i.department_id || null,
        cost_center_id: i.cost_center_id || null,
        vat_rate: i.vat_rate || 0,
        vat_amount: i.vat_amount || 0
      }));

      const returnData = { 
        return_number,
        customer_id: selectedCustomerId, 
        customer_name: customer?.name || '',
        warehouse_id: selectedWarehouseId || null,
        date, 
        items: sanitizedItems,
        subtotal,
        discount: Number(discount) || 0,
        tax: vatTotal,
        total_amount,
        payment_type: paymentType,
        payment_method_id: paymentType === 'cash' ? (paymentMethodId || null) : null,
        payment_method_name: paymentType === 'cash' ? (paymentMethod?.name || '') : null,
        company_id: user.company_id,
        created_at: new Date().toISOString(),
        created_by: user.id,
        operation_id: selectedOperationId || null,
        department_id: selectedDepartmentId || null,
        cost_center_id: selectedCostCenterId || null,
        description: description || ''
      };

      // Journal Items
      const journalItems: any[] = [];
      let customerAccountId = customer?.account_id || '';
      let customerAccountName = customer?.account_name || 'حساب العملاء';
      const custAcc = accounts.find(a => a.id === customerAccountId);
      const customerAccountCode = custAcc?.code || '';

      sanitizedItems.forEach(item => {
        const product = products.find(p => p.id === item.product_id);
        if (!product) return;

        let debitAccountId = product.revenue_account_id || '';
        let debitAccountName = product.revenue_account_name || 'حساب مردودات المبيعات';
        const debitAccount = accounts.find(a => a.id === debitAccountId);

        // 1. Debit Revenue (reverse sales)
        journalItems.push({
          account_id: debitAccountId,
          account_name: debitAccountName,
          account_code: debitAccount?.code || '',
          product_name: item.product_name,
          debit: item.total,
          credit: 0,
          description: `مرتجع مبيعات صنف: ${item.product_name} - مرتجع ${return_number}`
        });

        // 2. Debit VAT (reverse tax)
        if (isVatEnabled && item.vat_amount > 0) {
          let vatAccountId = product.vat_account_id || '';
          let vatAccountName = product.vat_account_name || (language === 'ar' ? 'حساب ضريبة القيمة المضافة' : 'VAT Liability Account');
          if (!vatAccountId) {
            const globalVatAccount = accounts.find(a => 
              a.name.includes('ضريبة القيمة المضافة') || a.name.includes('قيمة مضافة')
            );
            vatAccountId = globalVatAccount?.id || '';
            vatAccountName = globalVatAccount?.name || vatAccountName;
          }
          const vatAccount = accounts.find(a => a.id === vatAccountId);
          journalItems.push({
            account_id: vatAccountId,
            account_name: vatAccountName,
            account_code: vatAccount?.code || '',
            product_name: item.product_name,
            debit: item.vat_amount,
            credit: 0,
            description: `ضريبة القيمة المضافة مرتجعة - صنف: ${item.product_name} - مرتجع رقم ${return_number}`
          });
        }

        // 3. Debit Inventory & Credit COGS for physical goods (reverse cost of goods sold)
        if (product.type !== 'service') {
          const itemCost = Number(product.cost_price) || 0;
          const totalCost = Number((item.quantity * itemCost).toFixed(2));

          if (totalCost > 0) {
            let costAccId = product.cost_account_id || '';
            let costAccName = product.cost_account_name || 'تكلفة المبيعات';
            if (!costAccId) {
              const fallbackCostAcc = accounts.find(a => a.name.includes('تكلفة المبيعات') || a.name.includes('تكلفة مبيعات') || a.name.includes('تكلفة البضاعة المباعة'));
              if (fallbackCostAcc) {
                costAccId = fallbackCostAcc.id;
                costAccName = fallbackCostAcc.name;
              }
            }
            const costAcc = accounts.find(a => a.id === costAccId);

            let invAccId = product.inventory_account_id || '';
            let invAccName = product.inventory_account_name || 'المخزون';
            if (!invAccId) {
              const fallbackInvAcc = accounts.find(a => a.name.includes('مخزون') || a.name.includes('مخازن'));
              if (fallbackInvAcc) {
                invAccId = fallbackInvAcc.id;
                invAccName = fallbackInvAcc.name;
              }
            }
            const invAcc = accounts.find(a => a.id === invAccId);

            // Debit Inventory
            journalItems.push({
              account_id: invAccId,
              account_name: invAccName,
              account_code: invAcc?.code || '',
              product_name: item.product_name,
              debit: totalCost,
              credit: 0,
              description: `إرجاع للمخزون - صنف: ${item.product_name} - مرتجع رقم ${return_number}`
            });

            // Credit COGS
            journalItems.push({
              account_id: costAccId,
              account_name: costAccName,
              account_code: costAcc?.code || '',
              product_name: item.product_name,
              debit: 0,
              credit: totalCost,
              description: `عكس تكلفة البضاعة المباعة - صنف: ${item.product_name} - مرتجع رقم ${return_number}`
            });
          }
        }
      });

      // 4. Credit Discount (reverse discount)
      if (discount > 0) {
        const discountAccountId = settings?.customer_discount_account_id || '';
        const discountAccount = accounts.find(a => a.id === discountAccountId);
        journalItems.push({
          account_id: discountAccountId,
          account_name: discountAccount?.name || 'حساب الخصم المسموح به',
          account_code: discountAccount?.code || '',
          debit: 0,
          credit: discount,
          description: `تسوية خصم مرتجع مبيعات رقم ${return_number}`
        });
      }

      // 5. Credit Customer or Cash
      if (paymentType === 'cash' && paymentMethodId) {
        const pm = paymentMethods.find(p => p.id === paymentMethodId);
        let cashAccountId = pm?.account_id || '';
        let cashAccountName = pm?.account_name || 'حساب النقدية';
        const cashAccount = accounts.find(a => a.id === cashAccountId);
        journalItems.push({
          account_id: cashAccountId,
          account_name: cashAccountName,
          account_code: cashAccount?.code || '',
          debit: 0,
          credit: total_amount,
          description: `دفع نقدية مقابل مرتجع مبيعات رقم ${return_number} - ${customer?.name}`,
          sub_account_id: paymentMethodId,
          sub_account_type: 'payment_method'
        });
      } else {
        journalItems.push({
          account_id: customerAccountId,
          account_name: customerAccountName,
          account_code: customerAccountCode,
          debit: 0,
          credit: total_amount,
          description: `مرتجع مبيعات عملاء - مرتجع رقم ${return_number} - ${customer?.name}`,
          customer_id: selectedCustomerId,
          customer_name: customer?.name,
          sub_account_id: selectedCustomerId,
          sub_account_type: 'customer'
        });
      }

      const total_debit = Number(journalItems.reduce((sum, item) => sum + (Number(item.debit) || 0), 0).toFixed(2)) || 0;
      const total_credit = Number(journalItems.reduce((sum, item) => sum + (Number(item.credit) || 0), 0).toFixed(2)) || 0;

      const journalEntryData = {
        date,
        reference_number: return_number,
        reference_type: 'return',
        description: `قيد مرتجع مبيعات رقم ${return_number}`,
        items: journalItems,
        total_debit,
        total_credit,
        company_id: user.company_id,
        created_at: new Date().toISOString(),
        created_by: user.id
      };

      // Calculate changes if editing
      const changes: any[] = [];
      const detailsList: string[] = [];

      if (editingReturn) {
        // 1. Date
        if (editingReturn.date !== date) {
          const oldDateFormatted = formatDate(editingReturn.date);
          const newDateFormatted = formatDate(date);
          changes.push({
            field: language === 'ar' ? 'التاريخ' : 'Date',
            old_value: oldDateFormatted,
            new_value: newDateFormatted
          });
          detailsList.push(language === 'ar' ? `تغيير التاريخ من ${oldDateFormatted} إلى ${newDateFormatted}` : `Date changed from ${oldDateFormatted} to ${newDateFormatted}`);
        }

        // 2. Customer
        if (editingReturn.customer_id !== selectedCustomerId) {
          const oldCustomer = customers.find(c => c.id === editingReturn.customer_id)?.name || editingReturn.customer_name || editingReturn.customer_id;
          const newCustomer = customers.find(c => c.id === selectedCustomerId)?.name || selectedCustomerId;
          changes.push({
            field: language === 'ar' ? 'العميل' : 'Customer',
            old_value: oldCustomer,
            new_value: newCustomer
          });
          detailsList.push(language === 'ar' ? `تغيير العميل من ${oldCustomer} إلى ${newCustomer}` : `Customer changed from ${oldCustomer} to ${newCustomer}`);
        }

        // 3. Discount
        const oldDiscount = Number(editingReturn.discount) || 0;
        const newDiscount = Number(discount) || 0;
        if (oldDiscount !== newDiscount) {
          changes.push({
            field: language === 'ar' ? 'الخصم' : 'Discount',
            old_value: oldDiscount,
            new_value: newDiscount
          });
          detailsList.push(language === 'ar' ? `تغيير الخصم من ${oldDiscount} إلى ${newDiscount}` : `Discount changed from ${oldDiscount} to ${newDiscount}`);
        }

        // 4. Tax
        const oldTax = Number(editingReturn.tax) || 0;
        const newTax = Number(vatTotal) || 0;
        if (oldTax !== newTax) {
          changes.push({
            field: language === 'ar' ? 'الضريبة' : 'Tax',
            old_value: oldTax,
            new_value: newTax
          });
          detailsList.push(language === 'ar' ? `تغيير قيمة الضريبة من ${oldTax} إلى ${newTax}` : `Tax amount changed from ${oldTax} to ${newTax}`);
        }

        // 5. Total Amount
        const oldTotal = Number(editingReturn.total_amount) || 0;
        const newTotal = Number(total_amount) || 0;
        if (oldTotal !== newTotal) {
          changes.push({
            field: language === 'ar' ? 'إجمالي المرتجع' : 'Total Amount',
            old_value: oldTotal,
            new_value: newTotal
          });
          detailsList.push(language === 'ar' ? `تغيير الإجمالي من ${oldTotal} إلى ${newTotal}` : `Total amount changed from ${oldTotal} to ${newTotal}`);
        }

        // 6. Description
        const oldDesc = editingReturn.description || '';
        const newDesc = description || '';
        if (oldDesc !== newDesc) {
          changes.push({
            field: language === 'ar' ? 'الوصف' : 'Description',
            old_value: oldDesc || (language === 'ar' ? 'فارغ' : 'Empty'),
            new_value: newDesc || (language === 'ar' ? 'فارغ' : 'Empty')
          });
          detailsList.push(language === 'ar' ? `تعديل وصف المرتجع` : `Description updated`);
        }

        // 7. Items Diff
        const oldItems = editingReturn.items || [];
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
            const opChanged = oldItem.operation_id !== newItem.operation_id;
            const ccChanged = oldItem.cost_center_id !== newItem.cost_center_id;
            const deptChanged = oldItem.department_id !== newItem.department_id;

            if (qtyChanged || priceChanged || opChanged || ccChanged || deptChanged) {
              const diffParts: string[] = [];
              if (qtyChanged) diffParts.push(language === 'ar' ? `الكمية من ${oldItem.quantity} إلى ${newItem.quantity}` : `Qty from ${oldItem.quantity} to ${newItem.quantity}`);
              if (priceChanged) diffParts.push(language === 'ar' ? `السعر من ${oldItem.unit_price} إلى ${newItem.unit_price}` : `Price from ${oldItem.unit_price} to ${newItem.unit_price}`);
              if (opChanged) {
                const oldOp = operations.find(o => o.id === oldItem.operation_id)?.operation_number || '-';
                const newOp = operations.find(o => o.id === newItem.operation_id)?.operation_number || '-';
                diffParts.push(language === 'ar' ? `العملية من ${oldOp} إلى ${newOp}` : `Operation from ${oldOp} to ${newOp}`);
              }
              if (ccChanged) {
                const oldCc = costCenters.find(c => c.id === oldItem.cost_center_id)?.name || '-';
                const newCc = costCenters.find(c => c.id === newItem.cost_center_id)?.name || '-';
                diffParts.push(language === 'ar' ? `مركز التكلفة من ${oldCc} إلى ${newCc}` : `Cost center from ${oldCc} to ${newCc}`);
              }
              if (deptChanged) {
                const oldDept = departments.find(d => d.id === oldItem.department_id)?.name || '-';
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

        await dbService.deleteJournalEntryByReference(editingReturn.id, user.company_id);
        await TransactionManager.updateWithAccounting(
          'returns',
          editingReturn.id,
          returnData,
          ReturnSchema,
          journalEntryData,
          JournalEntrySchema
        );

        if (changes.length > 0) {
          const logAction = language === 'ar' ? 'تعديل مرتجع' : 'Update Return';
          const logDetails = detailsList.join(' | ');
          await dbService.logActivity(
            user.id,
            user.username,
            user.company_id,
            logAction,
            logDetails || `تعديل المرتجع رقم ${return_number}`,
            'returns',
            editingReturn.id,
            changes
          );
        }
      } else {
        await TransactionManager.saveWithAccounting(
          'returns',
          returnData,
          ReturnSchema,
          journalEntryData,
          JournalEntrySchema
        );
        await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة مرتجع', `إضافة مرتجع جديد رقم: ${return_number}`, 'returns');
      }

      showNotification(editingReturn ? 'تم تعديل المرتجع بنجاح' : 'تم إضافة المرتجع بنجاح', 'success');
      closeModal();
    } catch (e: any) {
      console.error('Save failed:', e);
      showNotification(e.message || 'حدث خطأ أثناء حفظ المرتجع', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    setReturnToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!returnToDelete || !user) return;
    try {
      const ret = returns.find(r => r.id === returnToDelete);
      
      // Delete associated journal entry
      await dbService.deleteJournalEntryByReference(returnToDelete, user.company_id);
      
      await dbService.delete('returns', returnToDelete);
      await dbService.logActivity(user.id, user.username, user.company_id, 'حذف مرتجع', `حذف المرتجع رقم: ${ret?.return_number}`, 'returns');
      showNotification('تم حذف المرتجع بنجاح', 'success');
      setIsDeleteModalOpen(false);
      setReturnToDelete(null);
    } catch (e: any) {
      console.error(e);
      showNotification(e.message || 'حدث خطأ أثناء حذف المرتجع', 'error');
    }
  };

  const openModal = async (ret?: Return) => {
    if (ret) {
      console.log('[EDIT] Opening edit modal for sales return ID:', ret.id);
      try {
        const fullData = await dbService.get<Return>('returns', ret.id);
        console.log('[EDIT] Sales return details from API:', fullData);
        
        if (!fullData) throw new Error('Return details not found');

        setEditingReturn(fullData);
        setSelectedCustomerId(fullData.customer_id);
        setSelectedWarehouseId(fullData.warehouse_id || '');
        setDate(fullData.date ? fullData.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
        setPaymentType(fullData.payment_type);
        setPaymentMethodId(fullData.payment_method_id || '');
        setItems(fullData.items || []);
        setReturnNumber(fullData.return_number);
        setDiscount(fullData.discount || 0);
        setDescription(fullData.description || '');
        setSelectedOperationId(fullData.operation_id || '');
        setSelectedDepartmentId(fullData.department_id || '');
        setSelectedCostCenterId(fullData.cost_center_id || '');
        console.log('[EDIT] Form updated with sales return:', fullData.id);
      } catch (error: any) {
        console.error('[EDIT] Error loading return:', error);
        showNotification('فشل تحميل بيانات المرتجع', 'error');
        return;
      }
    } else {
      setEditingReturn(null);
      const newDate = new Date().toISOString().slice(0, 10);
      setSelectedCustomerId('');
      setSelectedWarehouseId('');
      setDate(newDate);
      setPaymentType('credit');
      setPaymentMethodId('');
      setDiscount(0);
      setDescription('');
      setSelectedOperationId('');
      setSelectedDepartmentId('');
      setSelectedCostCenterId('');
      setItems([{ product_id: '', product_name: '', quantity: 1, unit_price: 0, total: 0 }]);
      const num = await generateReturnNumber(newDate);
      setReturnNumber(num);
    }
    setIsModalOpen(true);
    setIsFullScreen(false);
  };

  useEffect(() => {
    if (pendingViewDoc && pendingViewDoc.type === 'return' && user) {
      const loadPendingDoc = async () => {
        try {
          const existing = returns.find(r => r.return_number === pendingViewDoc.idOrNumber || r.id === pendingViewDoc.idOrNumber);
          if (existing) {
            openModal(existing);
            setPendingViewDoc(null);
            return;
          }
          const docs = await dbService.getDocsByFilter<any>('returns', user.company_id, [
            { field: 'return_number', operator: '==', value: pendingViewDoc.idOrNumber }
          ]);
          if (docs && docs.length > 0) {
            openModal(docs[0]);
          } else {
            const docById = await dbService.get<any>('returns', pendingViewDoc.idOrNumber);
            if (docById) {
              openModal(docById);
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
  }, [pendingViewDoc, returns, user, setPendingViewDoc]);

  const handleViewReturn = (ret: Return) => {
    setViewReturn(ret);
  };

  const exportToPDF = async (ret: Return) => {
    if (!returnRef.current) return;
    
    const element = returnRef.current;
    try {
      await exportToPDFUtil(element, {
        filename: `${ret.return_number}.pdf`,
        margin: 10,
        orientation: 'portrait',
        reportTitle: `مرتجع مبيعات رقم: ${ret.return_number}`
      });
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء تصدير PDF', 'error');
    }
  };

  const handlePrint = () => {
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        body * {
          visibility: hidden !important;
        }
        #return-capture-area, #return-capture-area * {
          visibility: visible !important;
        }
        #return-capture-area {
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
        img {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
    `;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => document.head.removeChild(style), 1000);
  };

  const handleExportExcel = () => {
    const formattedData = formatDataForExcel(filteredReturns, {
      'return_number': 'رقم المرتجع',
      'customer_name': 'العميل',
      'date': 'التاريخ',
      'total_amount': 'المبلغ الإجمالي'
    });
    exportToExcel(formattedData, { filename: 'Returns_Report', sheetName: 'المرتجع' });
  };

  const handleExportPDF = async () => {
    if (tableRef.current) {
      await exportToPDFUtil(tableRef.current, { 
        filename: 'Returns_Report', 
        orientation: 'landscape',
        reportTitle: 'قائمة مرتجعات المبيعات'
      });
    }
  };

  const applyAiData = (data: any) => {
    if (data.customerName) {
      const customer = customers.find(c => c.name.toLowerCase().includes(data.customerName.toLowerCase()));
      if (customer) setSelectedCustomerId(customer.id);
    }
    if (data.date) setDate(data.date);
    if (data.items) {
      const newItems = data.items.map((item: any) => {
        const product = products.find(p => p.name.toLowerCase().includes(item.productName.toLowerCase()));
        return {
          product_id: product?.id || '',
          product_name: product?.name || item.productName,
          quantity: item.quantity || 1,
          unit_price: item.price || product?.sale_price || 0,
          total: (item.quantity || 1) * (item.price || product?.sale_price || 0)
        };
      });
      setItems(newItems);
    }
  };

  const filteredReturns = returns.filter(r => 
    r.return_number.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {!isModalOpen ? (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">{t('returns.title')}</h2>
          <p className="text-zinc-500">{t('returns.subtitle')}</p>
          {serverSummary.total_amount !== undefined && (
            <div className={`mt-2 flex items-center gap-4 text-sm ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
               <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100 font-bold">
                 {t('returns.summary_total')}: {formatMoney(serverSummary.total_amount)} {t('returns.currency')}
               </span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => setIsActivityLogOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-zinc-600 border border-zinc-200 rounded-2xl font-bold hover:bg-zinc-50 transition-all active:scale-95 shadow-sm"
            title={t('common.activity_log')}
          >
            <History size={20} />
            <span className="hidden md:inline">{t('common.activity_log')}</span>
          </button>
          <ExportButtons 
            onExportExcel={handleExportExcel} 
            onExportPDF={handleExportPDF} 
          />
          <button 
            onClick={() => openModal()}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-200"
          >
            <Plus size={20} />
            {t('returns.add')}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-50 flex items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className={`${dir === 'rtl' ? 'right-3' : 'left-3'} absolute top-3 text-zinc-400`} size={18} />
            <input
              type="text"
              placeholder={t('returns.search_placeholder')}
              className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2 bg-zinc-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all`}
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
          <div ref={tableRef} id="returns-list-table" className="overflow-x-auto hidden md:block">
            <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
              <thead>
                <tr className="bg-zinc-50/50 text-zinc-500 text-xs uppercase tracking-wider">
                  <th className={`px-6 py-4 font-bold cursor-pointer hover:text-emerald-600 transition-colors group ${dir === 'rtl' ? 'text-right' : 'text-left'}`} onClick={() => handleSort('return_number')}>
                    <div className="flex items-center gap-1">
                      {t('returns.column_number')}
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {sortBy === 'return_number' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className={`px-6 py-4 font-bold cursor-pointer hover:text-emerald-600 transition-colors group ${dir === 'rtl' ? 'text-right' : 'text-left'}`} onClick={() => handleSort('customer_name')}>
                    <div className="flex items-center gap-1">
                      {t('returns.column_customer')}
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {sortBy === 'customer_name' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className={`px-6 py-4 font-bold cursor-pointer hover:text-emerald-600 transition-colors group ${dir === 'rtl' ? 'text-right' : 'text-left'}`} onClick={() => handleSort('date')}>
                    <div className="flex items-center gap-1">
                      {t('returns.column_date')}
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {sortBy === 'date' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className={`px-6 py-4 font-bold cursor-pointer hover:text-emerald-600 transition-colors group ${dir === 'rtl' ? 'text-right' : 'text-left'}`} onClick={() => handleSort('payment_type')}>
                    <div className="flex items-center gap-1">
                      {t('returns.column_type')}
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {sortBy === 'payment_type' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className={`px-6 py-4 font-bold cursor-pointer hover:text-emerald-600 transition-colors group ${dir === 'rtl' ? 'text-right' : 'text-left'}`} onClick={() => handleSort('total_amount')}>
                    <div className="flex items-center gap-1">
                      {t('returns.column_total')}
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {sortBy === 'total_amount' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className={`px-6 py-4 font-bold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                    {language === 'ar' ? 'رقم القيد' : 'Journal Entry'}
                  </th>
                  <th className={`px-6 py-4 font-bold ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filteredReturns.map((ret) => (
                  <tr 
                    key={ret.id} 
                    className="hover:bg-zinc-50/50 transition-colors group cursor-pointer"
                    onClick={() => openModal(ret)}
                  >
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs bg-zinc-100 px-2 py-1 rounded text-zinc-600">{ret.return_number}</span>
                    </td>
                    <td className="px-6 py-4 font-bold text-zinc-900">{ret.customer_name}</td>
                    <td className="px-6 py-4 text-zinc-500">{formatDate(ret.date)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${ret.payment_type === 'cash' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                        {ret.payment_type === 'cash' ? t('returns.payment_cash') : t('returns.payment_credit')}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-emerald-600">{formatNumber(ret.total_amount)} {t('returns.currency')}</td>
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
                    <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>
                      <div className={`flex items-center ${dir === 'rtl' ? 'justify-start' : 'justify-end'} gap-2 opacity-0 group-hover:opacity-100 transition-opacity`}>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActivityLogDocumentId(ret.id);
                            setIsActivityLogOpen(true);
                          }}
                          className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-all no-pdf"
                          title={t('common.activity_log')}
                        >
                          <History size={18} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            openModal(ret);
                          }}
                          className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all no-pdf"
                          title={t('common.edit')}
                        >
                          <FileText size={18} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewReturn(ret);
                          }}
                          className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all no-pdf"
                          title={t('common.view')}
                        >
                          <Eye size={18} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(ret.id);
                          }}
                          className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all no-pdf"
                          title={t('common.delete')}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredReturns.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">{t('common.no_data')}</td>
                  </tr>
                )}
              </tbody>
            </table>
            <PaginationControls page={page} limit={limit} total={totalRecords} onPageChange={setPage} onLimitChange={setLimit} />
          </div>
        ) : (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredReturns.map((ret) => (
              <div 
                key={ret.id} 
                onClick={() => openModal(ret)}
                className="p-6 bg-zinc-50/50 rounded-3xl border border-zinc-100 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5 transition-all group relative overflow-hidden cursor-pointer flex flex-col justify-between"
              >
                <div className="absolute top-4 left-4 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewReturn(ret);
                    }}
                    className="p-2 bg-white text-emerald-500 rounded-xl border border-emerald-50 shadow-sm hover:bg-emerald-50 transition-all font-bold"
                  >
                    <Eye size={16} />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      openModal(ret);
                    }}
                    className="p-2 bg-white text-blue-500 rounded-xl border border-blue-50 shadow-sm hover:bg-blue-50 transition-all font-bold"
                  >
                    <FileText size={16} />
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
                        <span className="font-mono text-xs bg-zinc-100 px-2 py-1 rounded text-zinc-600 font-bold">{ret.return_number}</span>
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
                      <h4 className="font-bold text-zinc-900 group-hover:text-emerald-600 transition-colors">{ret.customer_name}</h4>
                      <p className="text-xs text-zinc-400 mt-1">
                        {ret.payment_type === 'cash' ? t('returns.payment_cash') : t('returns.payment_credit')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center justify-between">
                    <span className="text-zinc-500 text-xs font-bold">{t('returns.column_total')}</span>
                    <span className="font-black text-emerald-600 text-lg">
                      {formatNumber(ret.total_amount)} {t('returns.currency')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {filteredReturns.length === 0 && !loading && (
              <div className="col-span-full py-12 text-center text-zinc-500 italic">{t('common.no_data')}</div>
            )}
            <div className="col-span-full">
              <PaginationControls page={page} limit={limit} total={totalRecords} onPageChange={setPage} onLimitChange={setLimit} />
            </div>
          </div>
        )}

        {/* Mobile List View */}
        <div className="md:hidden divide-y divide-zinc-50">
          {filteredReturns.map((ret) => (
            <div 
              key={ret.id} 
              onClick={() => openModal(ret)}
              className="p-4 space-y-4 cursor-pointer hover:bg-zinc-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] bg-emerald-50 px-2 py-1 rounded text-emerald-700 font-bold w-fit">{ret.return_number}</span>
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
                  <h4 className="font-bold text-zinc-900 text-lg">{ret.customer_name}</h4>
                </div>
                <div className={dir === 'rtl' ? 'text-left' : 'text-right'}>
                  <p className="font-bold text-emerald-600 text-lg">{formatNumber(ret.total_amount)} {t('returns.currency')}</p>
                  <span className="text-xs text-zinc-400">{formatDate(ret.date)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                <button 
                  onClick={() => {
                    setActivityLogDocumentId(ret.id);
                    setIsActivityLogOpen(true);
                  }}
                  className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-all"
                  title={t('common.activity_log')}
                >
                  <History size={18} />
                </button>
                <button 
                  onClick={() => openModal(ret)}
                  className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-100 rounded-lg transition-all"
                  title={t('common.edit')}
                >
                  <FileText size={18} />
                </button>
                <button 
                  onClick={() => handleViewReturn(ret)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-zinc-50 text-zinc-600 rounded-2xl text-sm font-bold border border-zinc-100 active:scale-95 transition-transform"
                >
                  <Eye size={18} /> {t('common.view')}
                </button>
                <button 
                  onClick={() => handleDelete(ret.id)}
                  className="p-3 bg-red-50 text-red-600 rounded-2xl border border-red-100 active:scale-95 transition-transform"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
          {filteredReturns.length === 0 && !loading && (
            <div className="p-8 text-center text-zinc-500 italic">{t('common.no_data')}</div>
          )}
        </div>
          </div>
        </>
      ) : (
        <div className={`bg-white rounded-3xl border border-zinc-200 shadow-md overflow-hidden animate-in slide-in-from-bottom-4 duration-300 flex flex-col ${isFullScreen ? 'fixed inset-0 z-[100] rounded-none' : 'min-h-[80vh] relative'}`}>
          {/* Form Header */}
          <div className="p-2 md:p-2.5 md:px-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-[70] flex-wrap gap-2" dir={dir}>
            {/* Right side (start in RTL): Actions: Save, Cancel, Return to List */}
            <div className="flex flex-col items-start gap-1 shrink-0">
              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={closeModal} 
                  className="flex items-center gap-1 px-2.5 py-0.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all font-bold text-[11px] whitespace-nowrap"
                >
                  {dir === 'rtl' ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                  <span>{language === 'ar' ? 'العودة للقائمة' : 'Return to List'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="flex items-center gap-1 px-2 py-0.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all font-bold text-[11px] whitespace-nowrap border border-zinc-200 shadow-sm cursor-pointer"
                >
                  {isFullScreen ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
                  <span>{isFullScreen ? (language === 'ar' ? 'تصغير' : 'Minimize') : (language === 'ar' ? 'ملء الشاشة' : 'Fullscreen')}</span>
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <button 
                  type="button"
                  onClick={closeModal}
                  className="w-20 py-1 rounded-lg bg-zinc-100 text-zinc-700 font-bold hover:bg-zinc-200 transition-all flex items-center gap-1 justify-center active:scale-95 border border-zinc-200 shadow-sm text-[11px] whitespace-nowrap font-sans"
                >
                  <RotateCcw size={12} />
                  <span>{language === 'ar' ? 'إلغاء' : 'Cancel'}</span>
                </button>
                <button 
                  type="submit"
                  form="return-form"
                  onClick={handleSubmit}
                  className="w-20 py-1 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all flex items-center gap-1 justify-center active:scale-95 shadow-sm text-[11px] whitespace-nowrap font-sans"
                >
                  <Save size={12} />
                  <span>{language === 'ar' ? 'حفظ' : 'Save'}</span>
                </button>
              </div>
            </div>

            {/* Middle: Journal / Activity toggle */}
            <div className="flex-1 flex justify-center">
              <button 
                type="button" 
                onClick={() => setShowSidePanel(!showSidePanel)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold transition-all border shadow-sm ${showSidePanel ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
              >
                <History size={13} />
                <span>{language === 'ar' ? 'قيد اليومية / سجل التعديلات' : 'Journal Entry / Activity Log'}</span>
              </button>
            </div>

            {/* Left side (end in RTL): Document Info: Title, Return No, Linked Journal, and Status Badge */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex flex-col gap-1 items-start">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="text-sm md:text-base font-black text-slate-900 tracking-tight leading-none font-sans">
                    {editingReturn ? (language === 'ar' ? 'تعديل مرتجع مبيعات' : 'Edit Sales Return') : (language === 'ar' ? 'إنشاء مرتجع مبيعات جديد' : 'Create New Sales Return')}
                  </h3>
                  <span className="text-[11px] font-mono font-black text-slate-800 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-lg select-all shadow-sm">
                    {returnNumber}
                  </span>
                </div>

                {editingReturn?.entry_number ? (
                  <div className="flex items-center gap-1 text-emerald-700 text-[10px] font-bold font-mono leading-none mt-0.5">
                    <span className="text-emerald-500 font-sans font-bold">{language === 'ar' ? 'القيد المرتبط:' : 'Linked JE:'}</span>
                    <span className="bg-emerald-50 px-1 py-0.5 rounded border border-emerald-100 font-black">{editingReturn.entry_number}</span>
                  </div>
                ) : (
                  <div className="text-[9px] font-bold text-zinc-400 mt-0.5">
                    {language === 'ar' ? 'القيد المرتبط: لا يوجد قيد مرتبط بعد' : 'Linked JE: No journal entry linked yet'}
                  </div>
                )}
              </div>

              {/* Cash/Credit Badge */}
              <div className="flex items-center">
                {paymentType === 'cash' ? (
                  <div className="px-2.5 py-1 border-2 border-emerald-600 text-emerald-600 bg-emerald-50/50 font-black text-[11px] uppercase rounded-xl select-none tracking-wider shadow-sm flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                    {language === 'ar' ? 'مرتجع نقدي' : 'Cash Return'}
                  </div>
                ) : (
                  <div className="px-2.5 py-1 border-2 border-blue-600 text-blue-600 bg-blue-50/50 font-black text-[11px] uppercase rounded-xl select-none tracking-wider shadow-sm flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                    {language === 'ar' ? 'مرتجع آجل' : 'Credit Return'}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto flex flex-col h-full relative">
            <div className="flex-1 p-1.5 md:p-2.5 space-y-1.5 overflow-y-auto pb-3">
              <form id="return-form" onSubmit={handleSubmit} className="space-y-1.5">
                {/* Upper Layout: Combined Totals Summary and Metadata Form into a single card */}
                <section className="bg-white p-2 md:p-2.5 rounded-xl border border-zinc-200 shadow-sm grid grid-cols-1 lg:grid-cols-4 gap-2 lg:gap-2.5 items-stretch">
                  
                  {/* Left: Return Summary Card Column */}
                  <div className="flex flex-col justify-center space-y-1 p-0.5">
                    <div className="flex items-center gap-1 mb-0.5 text-emerald-600">
                      <Layers className="w-3.5 h-3.5" />
                      <h2 className="font-semibold text-zinc-900 text-[10px]">{language === 'ar' ? 'ملخص المرتجع' : 'Return Summary'}</h2>
                    </div>

                    <div className="bg-zinc-50 rounded-lg p-1.5 border border-zinc-100 space-y-0.5">
                      <div className="flex justify-between items-center text-zinc-650 text-[10px]">
                        <span className="font-medium">{language === 'ar' ? 'المجموع الفرعي' : 'Subtotal'}</span>
                        <span className="font-bold text-[11px]">
                          {formatMoney(items.reduce((sum, i) => sum + (Number(i.total) || 0), 0))}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-emerald-600 text-[10px]">
                        <div className="flex items-center gap-1">
                          <span className="font-medium">{language === 'ar' ? 'الخصم' : 'Discount'}</span>
                          <input 
                            type="number" 
                            className="w-11 bg-white border border-zinc-200 rounded px-1 py-0.5 text-center font-bold text-emerald-600 focus:ring-1 focus:ring-emerald-500 outline-none text-[10px]"
                            value={Number(discount)}
                            onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <span className="font-bold text-[11px]">-{formatMoney(discount)}</span>
                      </div>
                      {(() => {
                        const isVatEnabled = company?.settings?.vat_enabled || company?.vat_enabled || false;
                        if (!isVatEnabled) return null;
                        return (
                          <div className="flex justify-between items-center text-zinc-650 text-[10px] pt-0.5 border-t border-dashed border-zinc-200">
                            <span className="font-medium">{language === 'ar' ? 'ضريبة القيمة المضافة' : 'VAT'}</span>
                            <span className="font-bold text-[11px]">
                              +{formatMoney(items.reduce((sum, i) => sum + (Number(i.vat_amount) || 0), 0))}
                            </span>
                          </div>
                        );
                      })()}
                      <div className="flex justify-between items-center text-emerald-600 text-[10px] pt-0.5 border-t border-zinc-200">
                        <span className="font-black text-[11px]">{language === 'ar' ? 'الإجمالي' : 'Total'}</span>
                        <div className="flex flex-col items-end">
                          <span className="font-black text-xs tracking-tighter text-left">
                            {formatMoney(
                              items.reduce((sum, i) => sum + (Number(i.total) || 0), 0) + 
                              ((company?.settings?.vat_enabled || company?.vat_enabled) ? items.reduce((sum, i) => sum + (Number(i.vat_amount) || 0), 0) : 0) - 
                              discount
                            )} {company?.settings?.currency || 'EGP'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Unified Metadata & Payment Settings Panel Column */}
                  <div className="lg:col-span-3 space-y-1 relative lg:border-s lg:border-zinc-150 lg:ps-2.5 flex flex-col justify-between">
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-1.5">
                      {/* 1. Date */}
                      <div>
                        <label className="block text-[9px] font-bold text-zinc-400 mb-0 px-0.5">{language === 'ar' ? 'التاريخ' : 'Date'}</label>
                        <input
                          required
                          type="date"
                          className="w-full px-1.5 py-0.5 rounded-md bg-zinc-50 border border-zinc-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 text-[11px]"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                        />
                      </div>

                      {/* 2. Customer */}
                      <div className="col-span-1 md:col-span-2 lg:col-span-2">
                        <label className="block text-[9px] font-bold text-zinc-400 mb-0 px-0.5">{language === 'ar' ? 'العميل' : 'Customer'}</label>
                        <select 
                          required
                          className="w-full px-1.5 py-0.5 rounded-md bg-zinc-50 border border-zinc-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 text-[11px] cursor-pointer"
                          value={selectedCustomerId}
                          onChange={(e) => {
                            if (e.target.value === 'new_customer') {
                              setIsCustomerModalOpen(true);
                            } else {
                              setSelectedCustomerId(e.target.value);
                            }
                          }}
                        >
                          <option value="">{language === 'ar' ? 'اختر عميل' : 'Select Customer'}</option>
                          {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          <option value="new_customer" className="font-bold text-emerald-600 italic">+ {t('customers.add')}</option>
                        </select>
                      </div>

                      {/* 3. Warehouse */}
                      <div>
                        <label className="block text-[9px] font-bold text-zinc-400 mb-0 px-0.5">{language === 'ar' ? 'المخزن' : 'Warehouse'}</label>
                        <select 
                          required
                          className="w-full px-1.5 py-0.5 rounded-md bg-zinc-50 border border-zinc-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 text-[11px] cursor-pointer"
                          value={selectedWarehouseId}
                          onChange={(e) => setSelectedWarehouseId(e.target.value)}
                        >
                          <option value="">{language === 'ar' ? 'اختر المخزن' : 'Select Warehouse'}</option>
                          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                      </div>

                      {/* 4. Payment Type */}
                      <div>
                        <label className="block text-[9px] font-bold text-zinc-400 mb-0 px-0.5">{language === 'ar' ? 'طريقة الدفع' : 'Payment Type'}</label>
                        <select 
                          className="w-full px-1.5 py-0.5 rounded-md bg-zinc-50 border border-zinc-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 text-[11px] cursor-pointer"
                          value={paymentType}
                          onChange={(e) => setPaymentType(e.target.value as 'cash' | 'credit')}
                        >
                          <option value="credit">{language === 'ar' ? 'آجل' : 'Credit'}</option>
                          <option value="cash">{language === 'ar' ? 'نقدي' : 'Cash'}</option>
                        </select>
                      </div>
                    </div>

                    {/* Second Row of metadata */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5 mt-1 pt-1 border-t border-zinc-100">
                      {/* 5. Payment Method */}
                      {paymentType === 'cash' ? (
                        <div>
                          <label className="block text-[9px] font-bold text-zinc-400 mb-0 px-0.5">{language === 'ar' ? 'طريقة الدفع للمرتجع' : 'Payment Method'}</label>
                          <select 
                            required
                            className="w-full px-1.5 py-0.5 rounded-md border border-zinc-200 bg-zinc-50 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 text-[11px] cursor-pointer"
                            value={paymentMethodId}
                            onChange={(e) => setPaymentMethodId(e.target.value)}
                          >
                            <option value="">{t('common.select_method')}</option>
                            {paymentMethods.map(pm => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
                          </select>
                        </div>
                      ) : null}

                      {/* 6. Description / Notes */}
                      <div className={paymentType === 'cash' ? 'col-span-1 md:col-span-2 lg:col-span-3' : 'col-span-2 md:col-span-3 lg:col-span-4'}>
                        <label className="block text-[9px] font-bold text-zinc-400 mb-0 px-0.5">{language === 'ar' ? 'الوصف / ملاحظات' : 'Description / Notes'}</label>
                        <input 
                          type="text"
                          className="w-full px-1.5 py-0.5 rounded-md border border-zinc-200 bg-zinc-50 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 text-[11px]"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder={language === 'ar' ? 'أضف وصفاً اختيارياً هنا...' : 'Add optional description...'}
                        />
                      </div>
                    </div>

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
                  </div>
                </section>

                {/* Items Section */}
                <section className="bg-white p-2 md:p-2.5 rounded-xl border border-zinc-200 shadow-sm space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-1 text-emerald-600">
                      <Package className="w-3.5 h-3.5" />
                      <h2 className="font-semibold text-zinc-900 text-[10px]">{language === 'ar' ? 'أصناف المرتجع' : 'Return Items'}</h2>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsProductModalOpen(true)}
                        className="px-2.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[10px] font-bold border border-emerald-100 hover:bg-emerald-100 transition-all cursor-pointer"
                      >
                        + {t('products.add')}
                      </button>
                      <button
                        type="button"
                        onClick={addEmptyRow}
                        className="px-2.5 py-0.5 bg-zinc-150 text-zinc-700 rounded text-[10px] font-bold hover:bg-zinc-200 transition-all cursor-pointer"
                      >
                        + {language === 'ar' ? 'إضافة سطر فارغ' : 'Add Empty Row'}
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-zinc-200 overflow-hidden">
                    <table className="w-full text-sm text-right border-collapse table-fixed min-w-[1150px]">
                      <thead>
                        <tr className="bg-zinc-100 border-b border-zinc-200 text-zinc-700 text-xs font-bold">
                          <th className="p-1 border-r border-zinc-200 text-right w-80 min-w-[320px]">{language === 'ar' ? 'اسم الصنف' : 'Product Name'}</th>
                          <th className="p-1 border-r border-zinc-200 text-center w-12">{language === 'ar' ? 'صورة' : 'Image'}</th>
                          <th className="p-1 border-r border-zinc-200 text-center w-24">{language === 'ar' ? 'باركود' : 'Barcode'}</th>
                          <th className="p-1 border-r border-zinc-200 text-center w-28">{language === 'ar' ? 'رقم عملية' : 'Operation No'}</th>
                          <th className="p-1 border-r border-zinc-200 text-center w-28">{language === 'ar' ? 'الإدارة' : 'Department'}</th>
                          <th className="p-1 border-r border-zinc-200 text-center w-28">{language === 'ar' ? 'مركز التكلفة' : 'Cost Center'}</th>
                          <th className="p-1 border-r border-zinc-200 text-center w-16">{language === 'ar' ? 'الكمية' : 'Qty'}</th>
                          <th className="p-1 border-r border-zinc-200 text-center w-24">{language === 'ar' ? 'سعر الوحدة' : 'Unit Price'}</th>
                          {((company?.settings?.vat_enabled || company?.vat_enabled) ? true : false) && (
                            <th className="p-1 border-r border-zinc-200 text-center w-14">{language === 'ar' ? 'ض ق م' : 'VAT %'}</th>
                          )}
                          <th className="p-1 border-r border-zinc-200 text-center w-24">{language === 'ar' ? 'الإجمالي' : 'Total'}</th>
                          <th className="p-1 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {items.map((item, index) => (
                          <tr key={index} className="group hover:bg-zinc-50 transition-colors">
                            <td className="p-0.5 border-b border-r border-zinc-200 w-80 min-w-[320px]">
                              <div className="relative">
                                <select 
                                  className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-white rounded px-1.5 py-0.5 outline-none font-bold text-zinc-800 appearance-none transition-all text-xs cursor-pointer"
                                  value={item.product_id}
                                  onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                                >
                                  <option value="">{t('common.select_product')}</option>
                                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                                <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-2' : 'right-2'} top-1.5 w-3.5 h-3.5 text-zinc-400 pointer-events-none`} />
                              </div>
                            </td>
                            <td className="p-0.5 border-b border-r border-zinc-200 w-12 text-center">
                              <div className="flex justify-center items-center">
                                {item.product_image_url ? (
                                  <div className="relative group w-8 h-8">
                                    <img src={item.product_image_url} alt="" className="w-full h-full object-cover rounded shadow-sm" referrerPolicy="no-referrer" />
                                    <button 
                                      type="button"
                                      onClick={() => updateItem(index, 'product_image_url', '')}
                                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <X size={8} />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="w-8 h-8 bg-zinc-50 rounded flex items-center justify-center border border-zinc-150">
                                    <Box size={14} className="text-zinc-300" />
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="p-0.5 border-b border-r border-zinc-200 w-24 text-center">
                              <input 
                                type="text" 
                                placeholder={language === 'ar' ? 'الباركود...' : 'Barcode...'}
                                className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-white rounded px-1.5 py-0.5 text-center font-bold text-xs text-zinc-800 outline-none transition-all font-mono"
                                value={item.barcode || ''}
                                onChange={(e) => updateItem(index, 'barcode', e.target.value)}
                              />
                            </td>
                            
                            {/* رقم عملية */}
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
                                        : (operations.find(op => op.id === item.operation_id)?.operation_number || '')
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
                                        query: operations.find(op => op.id === item.operation_id)?.operation_number || ''
                                      });
                                      setPopoverRect({
                                        top: rect.bottom,
                                        left: left,
                                        width: dropdownWidth
                                      });
                                    }}
                                  />
                                  {item.operation_id && (
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

                            {/* الإدارة */}
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
                                        : (departments.find(d => d.id === item.department_id)?.name || '')
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
                                        query: departments.find(d => d.id === item.department_id)?.name || ''
                                      });
                                      setPopoverRect({
                                        top: rect.bottom,
                                        left: left,
                                        width: dropdownWidth
                                      });
                                    }}
                                  />
                                  {item.department_id && (
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

                            {/* مركز التكلفة */}
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
                                        : (costCenters.find(cc => cc.id === item.cost_center_id)?.name || '')
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
                                        query: costCenters.find(cc => cc.id === item.cost_center_id)?.name || ''
                                      });
                                      setPopoverRect({
                                        top: rect.bottom,
                                        left: left,
                                        width: dropdownWidth
                                      });
                                    }}
                                  />
                                  {item.cost_center_id && (
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

                            <td className="p-0.5 border-b border-r border-zinc-200 w-16">
                              <input 
                                type="number" 
                                className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-white rounded px-1.5 py-0.5 text-center font-black text-zinc-900 outline-none transition-all text-xs"
                                value={item.quantity !== undefined && item.quantity !== null ? Number(item.quantity) : ''}
                                onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                              />
                            </td>
                            <td className="p-0.5 border-b border-r border-zinc-200 w-24">
                              <input 
                                type="number" 
                                step="any"
                                className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-white rounded px-1.5 py-0.5 text-center font-bold text-zinc-850 outline-none transition-all text-xs font-mono"
                                value={item.unit_price}
                                onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                              />
                            </td>
                            {((company?.settings?.vat_enabled || company?.vat_enabled) ? true : false) && (
                              <td className="p-0.5 border-b border-r border-zinc-200 w-14">
                                <div className="flex items-center justify-center gap-0.5">
                                  <input 
                                    type="number" 
                                    min={0}
                                    max={100}
                                    className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-white rounded px-1 py-0.5 text-center font-black text-zinc-900 outline-none transition-all text-xs"
                                    value={item.vat_rate !== undefined && item.vat_rate !== null ? Number(item.vat_rate) : 0}
                                    onChange={(e) => updateItem(index, 'vat_rate', parseFloat(e.target.value) || 0)}
                                  />
                                  <span className="text-sm text-zinc-900 font-black">%</span>
                                </div>
                              </td>
                            )}
                            <td className="p-0.5 border-b border-r border-zinc-200 w-24 text-center font-bold text-emerald-600 text-xs">
                              {formatMoney(item.total)}
                            </td>
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
                            <td colSpan={((company?.settings?.vat_enabled || company?.vat_enabled) ? 11 : 10)} className="px-3 py-6 text-center text-zinc-400 italic text-xs font-sans">
                              {language === 'ar' ? 'لا توجد أصناف مضافة.' : 'No items added.'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

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
                                  <td className="p-2 text-zinc-600 font-bold">{op.customer_name || '-'}</td>
                                  <td className="p-2 text-zinc-500 truncate max-w-[120px]" title={op.description}>{op.description || '-'}</td>
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
                            <tbody className="divide-y divide-zinc-100">
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
                                  <td className="p-2 font-mono text-zinc-900 font-bold">{d.code || '-'}</td>
                                  <td className="p-2 text-zinc-600 font-bold">{d.name}</td>
                                  <td className="p-2 text-zinc-500 truncate max-w-[150px]" title={d.description}>{d.description || '-'}</td>
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
                            <tbody className="divide-y divide-zinc-100">
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
                                  <td className="p-2 font-mono text-zinc-900 font-bold">{cc.code || '-'}</td>
                                  <td className="p-2 text-zinc-600 font-bold">{cc.name}</td>
                                  <td className="p-2 text-zinc-500 truncate max-w-[150px]" title={cc.description}>{cc.description || '-'}</td>
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

                {/* Inline Section for Activity Log and Journal Entry */}
                {showSidePanel && (
                  <div className="mt-6 border border-zinc-200 rounded-2xl overflow-hidden bg-white shadow-sm flex flex-col w-full">
                    <div 
                      onClick={() => setIsPanelExpanded(!isPanelExpanded)}
                      className="p-3 border-b border-zinc-150 flex items-center justify-between bg-zinc-50 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-3">
                        <button 
                          type="button"
                          className="w-7 h-7 rounded-full bg-slate-200/70 hover:bg-slate-300 flex items-center justify-center transition-all shadow-sm"
                        >
                          {isPanelExpanded ? <ChevronDown size={16} className="text-slate-600" /> : <ChevronRight size={16} className="text-slate-600" />}
                        </button>
                        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                          <History size={16} className="text-emerald-600 animate-pulse" />
                          <span>{language === 'ar' ? 'سجل التعديلات والقيد' : 'Activity Log & Journal'}</span>
                        </h3>
                      </div>
                      <button 
                        type="button" 
                        onClick={(e) => { e.stopPropagation(); setShowSidePanel(false); }} 
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-all"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isPanelExpanded ? 'max-h-[1200px] border-t border-zinc-200' : 'max-h-0'}`}>
                      <TransactionSidePanel 
                        documentId={editingReturn?.id || ''} 
                        category="returns" 
                        previewJournalEntry={previewJournalEntry}
                        previewActivityLog={previewActivityLog}
                        layout="bottom"
                        currencyCode={company?.settings?.currency || 'EGP'}
                        exchangeRate={1}
                        previewItems={items}
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
                      <span>{language === 'ar' ? 'عرض سجل التعديلات والقيد' : 'Show Activity Log & Journal'}</span>
                    </button>
                  </div>
                )}

                {/* Action Footer */}
                <div className="flex gap-4 pt-6 mt-6 border-t border-zinc-100">
                  <button 
                    type="button"
                    onClick={closeModal}
                    disabled={isSaving}
                    className="flex-1 py-3 bg-white text-zinc-650 rounded-xl font-bold border border-zinc-200 hover:bg-zinc-50 transition-all active:scale-95 shadow-sm text-sm"
                  >
                    {t('common.cancel')}
                  </button>
                  <button 
                    type="submit"
                    disabled={items.length === 0 || selectedCustomerId === '' || isSaving}
                    className="flex-[2] py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 text-sm"
                  >
                    {isSaving ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {editingReturn ? t('returns.edit') : t('returns.add')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* View Return Modal */}
      {viewReturn && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center md:p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full h-full md:h-auto md:max-w-6xl md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col md:max-h-[90vh] border border-slate-200">
            <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg md:text-xl font-bold text-slate-900">{t('returns.view_return')}</h3>
              <button onClick={() => setViewReturn(null)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-xl transition-all"><X size={24} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row h-full">
              <div ref={returnRef} id="return-capture-area" className="flex-1 p-6 md:p-8 space-y-8 bg-white overflow-y-auto" style={{ color: '#18181b' }}>
                <CompanyInvoiceHeader 
                  company={company} 
                  documentNumber={viewReturn.return_number}
                  documentDate={formatDate(viewReturn.date)}
                />

                <div className="grid grid-cols-2 gap-8 py-2">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{language === 'ar' ? 'مرتجع من العميل' : 'Return From Customer'}</p>
                    <p className="text-2xl font-black text-slate-900 tracking-tight">{viewReturn.customer_name}</p>
                    {viewReturn.customer_id && (
                      <p className="text-xs text-slate-500 font-medium">كود العميل: {viewReturn.customer_id.slice(-6).toUpperCase()}</p>
                    )}
                    {viewReturn.warehouse_id && (
                      <p className="text-xs text-slate-500 font-medium">
                        {language === 'ar' ? 'المخزن:' : 'Warehouse:'} <span className="text-emerald-600 font-bold">{warehouses.find(w => w.id?.toString() === viewReturn.warehouse_id?.toString())?.name || viewReturn.warehouse_id}</span>
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
                  <div className={`flex flex-col ${dir === 'rtl' ? 'items-start' : 'items-end'} justify-center gap-2`}>
                    <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border
                      ${viewReturn.payment_type === 'cash' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                        : 'bg-amber-50 text-amber-700 border-amber-100'
                      }`}>
                      {viewReturn.payment_type === 'cash' ? 'سداد نقدي' : 'سداد آجل'}
                    </div>
                  </div>
                </div>

                {viewReturn.description && (
                  <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{language === 'ar' ? 'الوصف / ملاحظات' : 'Description / Notes'}</p>
                    <p className="text-slate-700 whitespace-pre-wrap">{viewReturn.description}</p>
                  </div>
                )}

                <div className="border border-[#f4f4f5] rounded-2xl overflow-hidden">
                  <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'} text-sm`}>
                    <thead className="bg-[#fafafa] text-[#71717a] uppercase text-[10px] font-bold tracking-widest">
                      <tr>
                        <th className="px-4 py-3 w-16 text-center">{t('products.column_image')}</th>
                        <th className="px-4 py-3">{language === 'ar' ? 'الصنف' : 'Product'}</th>
                        <th className="px-4 py-3 w-24">{language === 'ar' ? 'الكمية' : 'Quantity'}</th>
                        <th className="px-4 py-3 w-32">{language === 'ar' ? 'السعر' : 'Price'}</th>
                        <th className="px-4 py-3 w-32">{language === 'ar' ? 'الإجمالي' : 'Total'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#fafafa]">
                      {viewReturn.items?.map((item, index) => (
                        <tr key={index}>
                          <td className="px-4 py-3 text-center">
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
                          <td className="px-4 py-3 font-medium text-[#18181b]">{item.product_name}</td>
                          <td className="px-4 py-3 text-[#71717a]">{item.quantity}</td>
                          <td className="px-4 py-3 text-[#71717a]">{formatMoney(item.unit_price)} {t('returns.currency')}</td>
                          <td className="px-4 py-3 font-bold text-[#18181b]">{formatMoney(item.total)} {t('returns.currency')}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50/50 font-bold border-t border-slate-100">
                      <tr>
                        <td colSpan={4} className={`px-6 py-3 ${dir === 'rtl' ? 'text-left' : 'text-right'} text-slate-400 font-bold text-[10px] uppercase tracking-wider`}>{language === 'ar' ? 'المجموع الفرعي' : 'Subtotal'}</td>
                        <td className="px-6 py-3 text-slate-900 text-base">{formatMoney(viewReturn.subtotal)} {t('returns.currency')}</td>
                      </tr>
                      {Number(viewReturn.discount) > 0 && (
                        <tr>
                          <td colSpan={4} className={`px-6 py-3 ${dir === 'rtl' ? 'text-left' : 'text-right'} text-red-400 font-bold text-[10px] uppercase tracking-wider`}>{language === 'ar' ? 'الخصم' : 'Discount'}</td>
                          <td className="px-6 py-3 text-red-600 text-base">-{formatMoney(viewReturn.discount)} {t('returns.currency')}</td>
                        </tr>
                      )}
                      {Number(viewReturn.tax) > 0 && (
                        <tr>
                          <td colSpan={4} className={`px-6 py-3 ${dir === 'rtl' ? 'text-left' : 'text-right'} text-zinc-600 font-bold text-[10px] uppercase tracking-wider`}>{language === 'ar' ? 'ضريبة القيمة المضافة' : 'VAT'}</td>
                          <td className="px-6 py-3 text-zinc-750 text-base">+{formatMoney(viewReturn.tax)} {t('returns.currency')}</td>
                        </tr>
                      )}
                      <tr className="bg-slate-900 text-white">
                        <td colSpan={4} className={`px-6 py-5 ${dir === 'rtl' ? 'text-left' : 'text-right'} font-black text-lg uppercase tracking-tight`}>{t('returns.summary_total')}</td>
                        <td className="px-6 py-5 text-2xl font-black text-emerald-400">{formatMoney(viewReturn.total_amount)} {t('returns.currency')}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="hidden lg:block w-80 border-r border-slate-100 bg-slate-50/30">
                <InlineActivityLog category="returns" documentId={viewReturn.id} />
              </div>
            </div>

            <div className="p-4 md:p-6 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex gap-2">
                <button 
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-6 py-3 bg-white text-slate-700 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all active:scale-95 shadow-sm cursor-pointer"
                >
                  <Printer size={20} />
                  {language === 'ar' ? 'طباعة' : 'Print'}
                </button>
                <button 
                  onClick={() => exportToPDF(viewReturn)}
                  className="flex items-center gap-2 px-6 py-3 bg-white text-slate-700 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all active:scale-95 shadow-sm cursor-pointer"
                >
                  <Download size={20} />
                  PDF
                </button>
              </div>
              <button 
                onClick={() => setViewReturn(null)}
                className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-200 cursor-pointer"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-4xl md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-4 md:p-6 border-b border-zinc-50 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg md:text-xl font-bold text-zinc-900">{t('customers.add')}</h3>
              <button onClick={() => setIsCustomerModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 p-2 hover:bg-zinc-100 rounded-xl transition-all"><X size={24} /></button>
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              <form onSubmit={handleCustomerSubmit} className="p-4 md:p-8 space-y-5 flex-1 overflow-y-auto pb-32 md:pb-8">
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('customers.form_name')}</label>
                    <div className="relative">
                      <Search className={`${dir === 'rtl' ? 'right-3' : 'left-3'} absolute top-3 text-zinc-400`} size={18} />
                      <input
                        required
                        type="text"
                        className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
                        value={customerFormData.name}
                        onChange={(e) => setCustomerFormData({ ...customerFormData, name: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('customers.form_mobile')}</label>
                    <div className="relative">
                      <Phone className={`${dir === 'rtl' ? 'right-3' : 'left-3'} absolute top-3 text-zinc-400`} size={18} />
                      <input
                        required
                        type="tel"
                        pattern="[0-9]{11,}"
                        className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-left`}
                        value={customerFormData.mobile}
                        onChange={(e) => setCustomerFormData({ ...customerFormData, mobile: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('customers.form_email')}</label>
                    <div className="relative">
                      <Mail className={`${dir === 'rtl' ? 'right-3' : 'left-3'} absolute top-3 text-zinc-400`} size={18} />
                      <input
                        type="email"
                        className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-left`}
                        value={customerFormData.email}
                        onChange={(e) => setCustomerFormData({ ...customerFormData, email: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('customers.form_address')}</label>
                    <textarea
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      rows={2}
                      value={customerFormData.address}
                      onChange={(e) => setCustomerFormData({ ...customerFormData, address: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('customers.form_opening_balance')}</label>
                      <div className="relative">
                        <Wallet className={`${dir === 'rtl' ? 'right-3' : 'left-3'} absolute top-3 text-zinc-400`} size={18} />
                        <input 
                          type="number" 
                          className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
                          value={customerFormData.opening_balance}
                          onChange={(e) => setCustomerFormData({ ...customerFormData, opening_balance: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('customers.form_balance_date')}</label>
                      <div className="relative">
                        <Calendar className={`${dir === 'rtl' ? 'right-3' : 'left-3'} absolute top-3 text-zinc-400`} size={18} />
                        <input 
                          type="date" 
                          className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
                          value={customerFormData.opening_balance_date}
                          onChange={(e) => setCustomerFormData({ ...customerFormData, opening_balance_date: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('customers.form_account')}</label>
                    <select
                      required
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={customerFormData.account_id}
                      onChange={(e) => setCustomerFormData({ ...customerFormData, account_id: e.target.value })}
                    >
                      <option value="">{t('common.select_account')}</option>
                      {accounts.map(account => (
                        <option key={account.id} value={account.id}>
                          {account.code} - {account.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {customerFormData.opening_balance !== 0 && (
                    <div className="animate-in slide-in-from-top-2 duration-200">
                      <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('customers.form_counter_account')}</label>
                      <select
                        required
                        className="w-full px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={customerFormData.counter_account_id}
                        onChange={(e) => setCustomerFormData({ ...customerFormData, counter_account_id: e.target.value })}
                      >
                        <option value="">{t('common.select_counter_account')}</option>
                        {accounts.map(account => (
                          <option key={account.id} value={account.id}>
                            {account.code} - {account.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-emerald-600 mt-1 font-medium">{t('customers.form_counter_account_hint')}</p>
                    </div>
                  )}
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                  >
                    {t('common.save')}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsCustomerModalOpen(false)}
                    className="px-8 py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all active:scale-95"
                  >
                    {t('common.cancel')}
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
              <h3 className="text-lg md:text-xl font-bold text-zinc-900">{t('products.add')}</h3>
              <button onClick={() => setIsProductModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 p-2 hover:bg-zinc-100 rounded-xl transition-all"><X size={24} /></button>
            </div>
            <form onSubmit={handleProductSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="p-4 md:p-6 space-y-4 flex-1 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('products.form_name')}</label>
                    <input
                      required
                      type="text"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={productFormData.name}
                      onChange={(e) => setProductFormData({ ...productFormData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('products.form_code')}</label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={productFormData.code}
                      onChange={(e) => setProductFormData({ ...productFormData, code: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('products.form_category')}</label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={productFormData.category}
                      onChange={(e) => setProductFormData({ ...productFormData, category: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('products.form_unit')}</label>
                    <select
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={productFormData.unit}
                      onChange={(e) => setProductFormData({ ...productFormData, unit: e.target.value })}
                    >
                      <option value="قطعة">{t('products.unit_piece')}</option>
                      <option value="كيلو">{t('products.unit_kg')}</option>
                      <option value="متر">{t('products.unit_meter')}</option>
                      <option value="لتر">{t('products.unit_liter')}</option>
                      <option value="علبة">{t('products.unit_box')}</option>
                      <option value="كرتونة">{t('products.unit_carton')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('products.form_cost_price')}</label>
                    <input
                      required
                      type="number"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={productFormData.cost_price}
                      onChange={(e) => setProductFormData({ ...productFormData, cost_price: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('products.form_sale_price')}</label>
                    <input
                      required
                      type="number"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={productFormData.sale_price}
                      onChange={(e) => setProductFormData({ ...productFormData, sale_price: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('products.form_stock_quantity')}</label>
                    <input
                      type="number"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={productFormData.stock}
                      onChange={(e) => setProductFormData({ ...productFormData, stock: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('products.form_min_stock')}</label>
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
                  {t('common.save')}
                </button>
                <button 
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-8 py-4 bg-zinc-200 text-zinc-700 rounded-2xl font-bold hover:bg-zinc-300 transition-all active:scale-95"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-zinc-900 mb-4">{t('common.delete_confirm_title')}</h3>
            <p className="text-zinc-500 mb-6">{t('common.delete_confirm_msg')}</p>
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setReturnToDelete(null);
                }}
                className="flex-1 py-3 bg-zinc-100 text-zinc-600 rounded-xl font-bold hover:bg-zinc-200 transition-all"
              >
                {t('common.cancel')}
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
              >
                {t('common.delete')}
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
        category="returns"
        documentId={activityLogDocumentId}
      />
    </div>
  );
};
