import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { TransactionManager } from '../services/TransactionManager';
import { ReturnSchema, JournalEntrySchema } from '../lib/schemas';
import { Return, Customer, Product, ReturnItem, JournalEntry, JournalEntryItem, Account, PaymentMethod } from '../types';
import { Search, Plus, Trash2, X, Eye, Download, FileText, RotateCcw, History, Printer, Phone, Mail, MapPin, Wallet, Calendar, Box, CreditCard, User, ChevronDown, Layers, Save, Package, ChevronRight, ChevronLeft, Maximize2, Minimize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SmartAIInput } from '../components/SmartAIInput';
import { exportToPDF as exportToPDFUtil } from '../utils/pdfUtils';
import { exportToExcel, formatDataForExcel } from '../utils/excelUtils';
import { dbService } from '../services/dbService';
import { PageActivityLog } from '../components/PageActivityLog';
import { formatNumber, formatDate, formatMoney } from '../utils/formatUtils';
import { TransactionSidePanel } from '../components/TransactionSidePanel';
import { ExportButtons } from '../components/ExportButtons';
import { ActivityLog, Company } from '../types';
import { PaginationControls } from '../components/PaginationControls';
import { CompanyInvoiceHeader } from '../components/CompanyInvoiceHeader';
import { useNavigation } from '../contexts/NavigationContext';

export const Returns: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { showNotification } = useNotification();
  const { pendingViewDoc, setPendingViewDoc } = useNavigation();
  const [returns, setReturns] = useState<Return[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
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

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [returnToDelete, setReturnToDelete] = useState<string | null>(null);
  const returnRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [activityLogDocumentId, setActivityLogDocumentId] = useState<string | undefined>(undefined);
  const [previewJournalEntry, setPreviewJournalEntry] = useState<JournalEntry | null>(null);
  const [previewActivityLog, setPreviewActivityLog] = useState<Partial<ActivityLog> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editingReturn, setEditingReturn] = useState<Return | null>(null);
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
    return await dbService.getNextSequence('returns', selectedDate);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingReturn(null);
    setSelectedCustomerId('');
    setDate(new Date().toISOString().slice(0, 10));
    setPaymentType('credit');
    setPaymentMethodId('');
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
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentType, setPaymentType] = useState<'credit' | 'cash'>('credit');
  const [paymentMethodId, setPaymentMethodId] = useState<string>('');
  const [items, setItems] = useState<ReturnItem[]>([]);

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
      
      setLoading(false);
      return () => {
        unsubItems();
        unsubCustomers();
        unsubProducts();
        unsubAccounts();
        unsubPaymentMethods();
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
      const total_amount = (items || []).reduce((sum, item) => sum + item.total, 0);
      if (total_amount <= 0) {
        setPreviewJournalEntry(null);
        setPreviewActivityLog(null);
        return;
      }

      const customer = customers.find(c => c.id === selectedCustomerId);
      const return_number = 'RET-PREVIEW';

      // Preview Activity Log
      setPreviewActivityLog({
        action: 'إضافة مرتجع مبيعات',
        details: `إضافة مرتجع مبيعات جديد للعميل ${customer?.name || '...'} بمبلغ ${formatNumber(total_amount)}`,
        created_at: new Date().toISOString()
      });

      // Preview Journal Entry
      const journalItems: JournalEntryItem[] = [];

      // Debit: Sales/Revenue Accounts (per product)
      (items || []).forEach(item => {
        const product = products.find(p => p.id === item.product_id);
        let debitAccountId = product?.revenue_account_id || '';
        let debitAccountName = product?.revenue_account_name || '';

        if (!debitAccountId) {
          const fallbackAccount = accounts.find(a => 
            a.name.includes('مبيعات') || a.name.includes('إيراد')
          );
          debitAccountId = fallbackAccount?.id || 'sales_account_default';
          debitAccountName = fallbackAccount?.name || 'حساب المبيعات (افتراضي)';
        }

        journalItems.push({
          account_id: debitAccountId,
          account_name: debitAccountName,
          debit: item.total,
          credit: 0,
          description: `مرتجع مبيعات صنف: ${item.product_name} - مرتجع ${return_number}`
        });
      });

      // Credit: Customer or Cash
      let creditAccountId = '';
      let creditAccountName = '';

      if (paymentType === 'cash' && paymentMethodId) {
        const method = paymentMethods.find(m => m.id === paymentMethodId);
        creditAccountId = method?.account_id || '';
        creditAccountName = method?.account_name || '';
      } else {
        creditAccountId = customer?.account_id || '';
        creditAccountName = customer?.account_name || '';
        
        if (!creditAccountId) {
          const fallbackAccount = accounts.find(a => a.name.includes('عملاء'));
          creditAccountId = fallbackAccount?.id || 'customers_account_default';
          creditAccountName = fallbackAccount?.name || 'حساب العملاء (افتراضي)';
        }
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

      setPreviewJournalEntry({
        id: 'preview',
        date,
        reference_number: return_number,
        reference_id: 'preview',
        reference_type: 'return',
        description: `قيد مرتجع مبيعات رقم ${return_number}`,
        items: journalItems,
        total_debit: total_amount,
        total_credit: total_amount,
        company_id: user.company_id,
        created_at: new Date().toISOString(),
        created_by: user.id
      });
    };

    generatePreview();
  }, [isModalOpen, items, selectedCustomerId, date, user, customers, products, accounts]);

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

  const updateItem = (index: number, field: keyof ReturnItem, value: any) => {
    setItems(prev => {
      const newItems = [...prev];
      const item = { ...newItems[index], [field]: value };
      
      if (field === 'product_id') {
        const product = products.find(p => p.id === value);
        if (product) {
          item.product_name = product.name;
          item.product_image_url = product.image_url;
          item.unit_price = Number(product.sale_price) || 0;
          item.total = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
        } else {
          item.product_name = '';
          item.product_image_url = '';
          item.unit_price = 0;
          item.total = 0;
        }
      }
      
      if (field === 'quantity' || field === 'unit_price') {
        item.total = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
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
    
    const validItems = items.filter(item => item.product_id);
    if (validItems.length === 0) {
      showNotification('يرجى إضافة أصناف مكتملة للمرتجع', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const customer = customers.find(c => c.id === selectedCustomerId);
      const paymentMethod = paymentMethods.find(m => m.id === paymentMethodId);
      const return_number = editingReturn ? editingReturn.return_number : returnNumber;
      const total_amount = Number(validItems.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_price || 0)), 0)) || 0;
      
      const sanitizedItems = validItems.map(i => ({
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: Number(i.quantity) || 0,
        unit_price: Number(i.unit_price) || 0,
        total: Number((Number(i.quantity) || 0) * (Number(i.unit_price) || 0)) || 0
      }));

      const returnData = { 
        return_number,
        customer_id: selectedCustomerId, 
        customer_name: customer?.name || '',
        date, 
        items: sanitizedItems,
        total_amount,
        payment_type: paymentType,
        payment_method_id: paymentType === 'cash' ? (paymentMethodId || null) : null,
        payment_method_name: paymentType === 'cash' ? (paymentMethod?.name || '') : null,
        company_id: user.company_id,
        created_at: new Date().toISOString(),
        created_by: user.id
      };

      // Journal Items
      const journalItems: any[] = [];
      let customerAccountId = customer?.account_id || '';
      let customerAccountName = customer?.account_name || '';
      if (!customerAccountId) {
        const fallback = accounts.find(a => a.name.includes('عملاء'));
        customerAccountId = fallback?.id || 'customers_account_default';
        customerAccountName = fallback?.name || 'حساب العملاء (افتراضي)';
      }

      journalItems.push({
        account_id: customerAccountId,
        account_name: customerAccountName,
        debit: 0,
        credit: total_amount,
        description: `مرتجع مبيعات رقم ${return_number} - ${customer?.name}`,
        customer_id: selectedCustomerId,
        customer_name: customer?.name
      });

      sanitizedItems.forEach(item => {
        const product = products.find(p => p.id === item.product_id);
        let debitAccountId = product?.revenue_account_id || '';
        let debitAccountName = product?.revenue_account_name || '';
        if (!debitAccountId) {
          const fallback = accounts.find(a => a.name.includes('مبيعات') || a.name.includes('إيراد'));
          debitAccountId = fallback?.id || 'sales_account_default';
          debitAccountName = fallback?.name || 'حساب المبيعات (افتراضي)';
        }
        journalItems.push({
          account_id: debitAccountId,
          account_name: debitAccountName,
          debit: Number(item.total) || 0,
          credit: 0,
          description: `مرتجع مبيعات صنف: ${item.product_name} - مرتجع ${return_number}`
        });
      });

      if (paymentType === 'cash' && paymentMethodId) {
        const pm = paymentMethods.find(p => p.id === paymentMethodId);
        let cashAccountId = pm?.account_id || '';
        let cashAccountName = pm?.account_name || '';
        if (!cashAccountId) {
          const fallback = accounts.find(a => a.name.includes('نقدية') || a.name.includes('خزينة') || a.name.includes('صندوق'));
          cashAccountId = fallback?.id || 'cash_account_default';
          cashAccountName = fallback?.name || 'حساب النقدية (افتراضي)';
        }
        journalItems.push({
          account_id: customerAccountId,
          account_name: customerAccountName,
          debit: total_amount,
          credit: 0,
          description: `تسوية نقدية لمرتجع مبيعات رقم ${return_number} - ${customer?.name}`
        });
        journalItems.push({
          account_id: cashAccountId,
          account_name: cashAccountName,
          debit: 0,
          credit: total_amount,
          description: `دفع نقدية مقابل مرتجع مبيعات رقم ${return_number} - ${customer?.name}`
        });
      }

      const total_debit = Number(journalItems.reduce((sum, item) => sum + (Number(item.debit) || 0), 0)) || 0;
      const total_credit = Number(journalItems.reduce((sum, item) => sum + (Number(item.credit) || 0), 0)) || 0;

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

      if (editingReturn) {
        await dbService.deleteJournalEntryByReference(editingReturn.id, user.company_id);
        await TransactionManager.updateWithAccounting(
          'returns',
          editingReturn.id,
          returnData,
          ReturnSchema,
          journalEntryData,
          JournalEntrySchema
        );
      } else {
        await TransactionManager.saveWithAccounting(
          'returns',
          returnData,
          ReturnSchema,
          journalEntryData,
          JournalEntrySchema
        );
      }

      showNotification(editingReturn ? 'تم تعديل المرتجع بنجاح' : 'تم إضافة المرتجع بنجاح', 'success');
      closeModal();

      if (!editingReturn) {
        dbService.logActivity(user.id, user.username, user.company_id, 'إضافة مرتجع', `إضافة مرتجع جديد رقم: ${return_number}`, 'returns');
      }

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
        setDate(fullData.date ? fullData.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
        setPaymentType(fullData.payment_type);
        setPaymentMethodId(fullData.payment_method_id || '');
        setItems(fullData.items || []);
        setReturnNumber(fullData.return_number);
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
      setDate(newDate);
      setPaymentType('credit');
      setPaymentMethodId('');
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
        <div className="p-6 border-b border-zinc-50 flex items-center gap-4">
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
        </div>

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
                  <span className="font-mono text-[10px] bg-emerald-50 px-2 py-1 rounded text-emerald-700 font-bold w-fit">{ret.return_number}</span>
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
          <div className="p-4 md:p-6 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-[70]">
            <div className="flex items-center gap-3">
              <button 
                type="button"
                onClick={closeModal} 
                className={`flex items-center gap-2 px-4 py-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all font-black text-sm ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}
              >
                {dir === 'rtl' ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                <span>{language === 'ar' ? 'العودة للقائمة' : 'Back to List'}</span>
              </button>
            </div>

            <div className="flex-1 flex justify-center">
              <button 
                type="button"
                onClick={() => setShowSidePanel(!showSidePanel)}
                className={`flex items-center gap-3 px-6 py-2.5 rounded-2xl text-sm font-black transition-all border shadow-sm ${showSidePanel ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'}`}
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
                    disabled={returns.findIndex(r => r.id === editingReturn.id) === 0}
                  >
                    {dir === 'rtl' ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    {language === 'ar' ? 'السابق' : 'Prev'}
                  </button>
                  <button 
                    type="button"
                    onClick={handleNextReturn}
                    className="flex items-center gap-1 px-3 py-1.5 hover:bg-white rounded-xl transition-all text-zinc-600 disabled:opacity-30 text-xs font-black"
                    disabled={returns.findIndex(r => r.id === editingReturn.id) === returns.length - 1}
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
                {editingReturn ? t('returns.edit') : t('returns.add')}
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
                        category="returns" 
                        previewJournalEntry={previewJournalEntry}
                        previewActivityLog={previewActivityLog}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 pb-32 md:pb-8">
              <SmartAIInput transactionType="return" onDataExtracted={applyAiData} />
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-3 space-y-6">
                  {/* Card 1: Basic Info */}
                  <section className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm space-y-6 relative pt-12">
                    <div className="absolute top-4 right-4 flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                      <FileText className="w-4 h-4" />
                      <span className="text-xs font-bold">{t('returns.basic_info')}</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">{t('returns.column_number')}</label>
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
                        <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">{t('returns.form_customer')}</label>
                        <div className="relative group">
                          <User className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                          <select 
                            required
                            className={`w-full ${dir === 'rtl' ? 'ps-10 pe-12' : 'pe-10 ps-12'} py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-zinc-800 appearance-none text-sm cursor-pointer`}
                            value={selectedCustomerId}
                            onChange={(e) => {
                              if (e.target.value === 'new_customer') {
                                setIsCustomerModalOpen(true);
                              } else {
                                setSelectedCustomerId(e.target.value);
                              }
                            }}
                          >
                            <option value="">{t('common.select_customer')}</option>
                            {customers.map(c => (
                              <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                            ))}
                            <option value="new_customer" className="font-bold text-emerald-600">+ {t('customers.add')}</option>
                          </select>
                          <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">{t('returns.form_date')}</label>
                        <div className="relative">
                          <Calendar className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                          <input 
                            required
                            type="date"
                            className={`w-full ${dir === 'rtl' ? 'ps-4 pe-12' : 'pe-4 ps-12'} py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-zinc-800 text-sm`}
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Card 2: Payment settings */}
                  <section className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm space-y-6 relative pt-12">
                    <div className="absolute top-4 right-4 flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                      <Wallet className="w-4 h-4" />
                      <span className="text-xs font-bold">{t('returns.payment_settings')}</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">{t('returns.form_payment_type')}</label>
                        <div className="grid grid-cols-2 gap-3 p-1 bg-zinc-100 rounded-2xl">
                          <button
                            type="button"
                            onClick={() => setPaymentType('cash')}
                            className={`py-2 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm ${paymentType === 'cash' ? 'bg-white text-emerald-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                          >
                            <Wallet size={16} />
                            {t('returns.payment_cash')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaymentType('credit')}
                            className={`py-2 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm ${paymentType === 'credit' ? 'bg-white text-emerald-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                          >
                            <Layers size={16} />
                            {t('returns.payment_credit')}
                          </button>
                        </div>
                      </div>

                      {paymentType === 'cash' && (
                        <div className="animate-in slide-in-from-top-2 duration-200">
                          <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">{t('returns.form_payment_method')}</label>
                          <div className="relative group">
                            <CreditCard className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                            <select 
                              required
                              className={`w-full ${dir === 'rtl' ? 'ps-10 pe-12' : 'pe-10 ps-12'} py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-zinc-800 appearance-none text-sm cursor-pointer`}
                              value={paymentMethodId}
                              onChange={(e) => setPaymentMethodId(e.target.value)}
                            >
                              <option value="">{t('common.select_method')}</option>
                              {paymentMethods.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                              ))}
                            </select>
                            <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                          </div>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Card 3: Items */}
                  <section className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm space-y-6 relative pt-12">
                    <div className="absolute top-4 right-4 flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                      <Package className="w-4 h-4" />
                      <span className="text-xs font-bold">{t('returns.form_items')}</span>
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
                          + {t('products.add')}
                        </button>
                        <button
                          type="button"
                          onClick={addEmptyRow}
                          className="px-4 py-2 bg-zinc-100 text-zinc-600 rounded-xl text-xs font-bold hover:bg-zinc-200 transition-all"
                        >
                          <Plus size={14} className="inline-block me-1" />
                          {t('returns.add_empty')}
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
                      <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'} text-sm`}>
                        <thead className="bg-zinc-50 text-zinc-400 uppercase text-[10px] font-black tracking-widest border-b border-zinc-100">
                          <tr>
                            <th className="px-6 py-4 w-12 text-center">{t('products.column_image')}</th>
                            <th className="px-6 py-4">{t('returns.column_product')}</th>
                            <th className="px-6 py-4 w-28 text-center">{t('returns.column_quantity')}</th>
                            <th className="px-6 py-4 w-32 text-center">{t('returns.column_price')}</th>
                            <th className={`px-6 py-4 w-32 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>{t('returns.column_total')}</th>
                            <th className="px-6 py-4 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50">
                          {items.map((item, index) => (
                            <tr key={index} className="hover:bg-zinc-50/50 transition-colors group">
                              <td className="px-6 py-3 text-center">
                                {item.product_image_url ? (
                                  <img 
                                    src={item.product_image_url} 
                                    alt={item.product_name} 
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
                                    onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                                  >
                                    <option value="">{t('common.select_product')}</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                  </select>
                                  <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-3' : 'right-3'} top-3 w-4 h-4 text-zinc-400 pointer-events-none`} />
                                </div>
                              </td>
                              <td className="px-6 py-3">
                                <input 
                                  type="number"
                                  step="any"
                                  className="w-full bg-zinc-50 border border-transparent focus:bg-white focus:ring-2 focus:ring-emerald-500 rounded-xl px-4 py-2.5 text-xs outline-none text-center font-bold text-zinc-800 transition-all"
                                  value={Number(item.quantity) || 0}
                                  onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                                />
                              </td>
                              <td className="px-6 py-3">
                                <input 
                                  type="number"
                                  step="any"
                                  className="w-full bg-zinc-50 border border-transparent focus:bg-white focus:ring-2 focus:ring-emerald-500 rounded-xl px-4 py-2.5 text-xs outline-none text-center font-bold text-zinc-800 transition-all"
                                  value={Number(item.unit_price) || 0}
                                  onChange={(e) => updateItem(index, 'unit_price', Number(e.target.value))}
                                />
                              </td>
                              <td className={`px-6 py-3 font-bold text-zinc-900 text-sm ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>
                                {formatNumber(item.total || 0)}
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
                          <span>{t('returns.summary_total')}</span>
                        </div>
                        <div className="flex justify-between items-baseline gap-4">
                          <span className="text-4xl font-black tracking-tighter text-emerald-400">
                            {formatNumber(items.reduce((sum, item) => sum + (item.total || 0), 0))}
                          </span>
                          <span className="font-bold text-zinc-400">{t('returns.currency')}</span>
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
                  disabled={isSaving}
                  className="flex-1 py-4 bg-white text-zinc-600 rounded-2xl font-bold border border-zinc-200 hover:bg-zinc-100 transition-all active:scale-95 shadow-sm"
                >
                  {t('common.cancel')}
                </button>
                <button 
                  type="submit"
                  disabled={items.length === 0 || selectedCustomerId === '' || isSaving}
                  className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-3"
                >
                  {isSaving ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="w-6 h-6" />
                  )}
                  {editingReturn ? t('returns.edit') : t('returns.add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Return Modal */}
      {viewReturn && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center md:p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div ref={returnRef} id="return-capture-area" className="bg-white w-full h-full md:h-auto md:max-w-2xl md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col" style={{ backgroundColor: '#ffffff', color: '#18181b' }}>
            <div className="p-4 md:p-6 border-b border-zinc-50 flex items-center justify-between bg-zinc-50/50 sticky top-0 z-10 md:hidden" style={{ backgroundColor: '#f4f4f5' }}>
              <h3 className="text-lg font-bold text-zinc-900" style={{ color: '#18181b' }}>{t('returns.view_return')}</h3>
              <button onClick={() => setViewReturn(null)} className="text-zinc-400 hover:text-zinc-600 p-2 hover:bg-zinc-100 rounded-full transition-all">
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row h-full">
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
                <CompanyInvoiceHeader 
                  company={company} 
                  documentNumber={viewReturn.return_number}
                  documentDate={formatDate(viewReturn.date)}
                />

                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1" style={{ color: '#71717a' }}>{t('returns.column_customer')}</p>
                    <p className="text-lg font-bold text-zinc-900" style={{ color: '#18181b' }}>{viewReturn.customer_name}</p>
                  </div>
                  <div className={dir === 'rtl' ? 'text-left' : 'text-right'}>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1" style={{ color: '#71717a' }}>تاريخ المرتجع</p>
                    <p className="text-lg font-bold text-zinc-900" style={{ color: '#18181b' }}>{formatDate(viewReturn.date)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1" style={{ color: '#71717a' }}>{t('returns.column_type')}</p>
                    <p className="text-lg font-bold text-zinc-900" style={{ color: '#18181b' }}>{viewReturn.payment_type === 'cash' ? t('returns.payment_cash') : t('returns.payment_credit')}</p>
                  </div>
                  {viewReturn.payment_type === 'cash' && (
                    <div className={dir === 'rtl' ? 'text-left' : 'text-right'}>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1" style={{ color: '#71717a' }}>{t('returns.form_payment_method')}</p>
                      <p className="text-lg font-bold text-zinc-900" style={{ color: '#18181b' }}>{viewReturn.payment_method_name}</p>
                    </div>
                  )}
                </div>

                <div className="border border-zinc-100 rounded-2xl overflow-hidden" style={{ borderColor: '#f4f4f5' }}>
                  <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'} text-sm border-collapse`}>
                    <thead className="bg-zinc-50 text-zinc-500 uppercase text-[10px] font-bold tracking-wider" style={{ backgroundColor: '#fafafa' }}>
                      <tr>
                        <th className="px-6 py-3 w-16 text-center" style={{ color: '#71717a' }}>{t('products.column_image')}</th>
                        <th className="px-6 py-3" style={{ color: '#71717a' }}>{t('returns.column_product')}</th>
                        <th className="px-6 py-3" style={{ color: '#71717a' }}>{t('returns.column_quantity')}</th>
                        <th className="px-6 py-3" style={{ color: '#71717a' }}>{t('returns.column_price')}</th>
                        <th className="px-6 py-3" style={{ color: '#71717a' }}>{t('returns.column_total')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50" style={{ borderColor: '#fafafa' }}>
                      {viewReturn.items?.map((item, idx) => (
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
                          <td className="px-6 py-4 text-zinc-500" style={{ color: '#71717a' }}>{formatNumber(item.unit_price)}</td>
                          <td className="px-6 py-4 font-bold text-zinc-900" style={{ color: '#18181b' }}>{formatNumber(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50/50 font-bold border-t border-slate-100">
                      <tr className="bg-slate-900 text-white font-bold">
                        <td colSpan={4} className={`px-6 py-5 ${dir === 'rtl' ? 'text-left' : 'text-right'} font-black text-lg uppercase tracking-tight`}>{t('returns.summary_total')}</td>
                        <td className="px-6 py-5 text-2xl font-black text-emerald-400">{formatNumber(viewReturn.total_amount)} {t('returns.currency')}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => exportToPDF(viewReturn)}
                    className="flex-1 py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all flex items-center justify-center gap-2"
                  >
                    <Download size={20} />
                    {t('common.download_pdf')}
                  </button>
                  <button 
                    onClick={() => setViewReturn(null)}
                    className="flex-1 py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all"
                  >
                    {t('common.close')}
                  </button>
                </div>
              </div>

              {/* Side Panel for Activity Log and Journal Entry */}
              <TransactionSidePanel 
                documentId={viewReturn.id} 
                category="returns" 
              />
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
