import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Return, Customer, Product, ReturnItem, JournalEntry, JournalEntryItem, Account, PaymentMethod } from '../types';
import { Search, Plus, Trash2, X, Eye, Download, FileText, RotateCcw, History, Printer, Phone, Mail, MapPin, Wallet, Calendar, Box, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SmartAIInput } from '../components/SmartAIInput';
import { exportToPDF as exportToPDFUtil } from '../utils/pdfUtils';
import { exportToExcel, formatDataForExcel } from '../utils/excelUtils';
import { dbService } from '../services/dbService';
import { PageActivityLog } from '../components/PageActivityLog';
import { TransactionSidePanel } from '../components/TransactionSidePanel';
import { ExportButtons } from '../components/ExportButtons';
import { ActivityLog } from '../types';

export const Returns: React.FC = () => {
  const { user } = useAuth();
  const { t, dir } = useLanguage();
  const { showNotification } = useNotification();
  const [returns, setReturns] = useState<Return[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
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
      const unsubReturns = dbService.subscribe<Return>('returns', user.company_id, setReturns);
      const unsubCustomers = dbService.subscribe<Customer>('customers', user.company_id, setCustomers);
      const unsubProducts = dbService.subscribe<Product>('products', user.company_id, setProducts);
      const unsubAccounts = dbService.subscribe<Account>('accounts', user.company_id, setAccounts);
      const unsubPaymentMethods = dbService.subscribe<PaymentMethod>('payment_methods', user.company_id, setPaymentMethods);
      
      setLoading(false);
      return () => {
        unsubReturns();
        unsubCustomers();
        unsubProducts();
        unsubAccounts();
        unsubPaymentMethods();
      };
    }
  }, [user]);

  // Real-time Preview Logic
  useEffect(() => {
    if (!isModalOpen || !user) {
      setPreviewJournalEntry(null);
      setPreviewActivityLog(null);
      return;
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
        details: `إضافة مرتجع مبيعات جديد للعميل ${customer?.name || '...'} بمبلغ ${total_amount.toLocaleString()}`,
        timestamp: new Date().toISOString()
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
      quantity: 1,
      price: product.sale_price,
      total: product.sale_price
    }]);
  };

  const addEmptyRow = () => {
    setItems(prev => [...prev, {
      product_id: '',
      product_name: '',
      quantity: 1,
      price: 0,
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
          item.price = product.sale_price;
          item.total = (item.quantity || 0) * (item.price || 0);
        } else {
          item.product_name = '';
          item.product_image_url = '';
          item.price = 0;
          item.total = 0;
        }
      }
      
      if (field === 'quantity' || field === 'price') {
        item.total = (item.quantity || 0) * (item.price || 0);
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
      const return_number = editingReturn ? editingReturn.return_number : `RET-${Date.now().toString().slice(-6)}`;
      const total_amount = validItems.reduce((sum, item) => sum + item.total, 0);
      
      const returnData = { 
        customer_id: selectedCustomerId, 
        customer_name: customer?.name || '',
        date, 
        items: validItems,
        total_amount,
        return_number,
        payment_type: paymentType,
        payment_method_id: paymentMethodId,
        payment_method_name: paymentMethod?.name || '',
        company_id: user.company_id
      };

      let id = '';
      if (editingReturn) {
        id = editingReturn.id;
        await dbService.update('returns', id, returnData);
        // Delete old journal entry to recreate it
        await dbService.deleteJournalEntryByReference(id, user.company_id);
      } else {
        id = await dbService.add('returns', returnData);
      }

      // Create Journal Entry
      const journalItems: JournalEntryItem[] = [];

      // ALWAYS Credit: Customer Account first (for the return part)
      let customerAccountId = customer?.account_id || '';
      let customerAccountName = customer?.account_name || '';
      
      if (!customerAccountId) {
        const fallbackAccount = accounts.find(a => a.name.includes('عملاء'));
        customerAccountId = fallbackAccount?.id || 'customers_account_default';
        customerAccountName = fallbackAccount?.name || 'حساب العملاء (افتراضي)';
      }

      // Line 1: Cr. Customer (Reducing receivable)
      journalItems.push({
        account_id: customerAccountId,
        account_name: customerAccountName,
        debit: 0,
        credit: total_amount,
        description: `مرتجع مبيعات رقم ${return_number} - ${customer?.name}`,
        customer_id: selectedCustomerId,
        customer_name: customer?.name
      });

      // Line 2: Dr. Sales Return Accounts (per product) - reversing the sale
      validItems.forEach(item => {
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

      // If Cash, add the payment lines (Dr. Customer / Cr. Cash)
      // For Sales Return CASH: We paid cash to customer.
      if (paymentType === 'cash' && paymentMethodId) {
        const pm = paymentMethods.find(p => p.id === paymentMethodId);
        let cashAccountId = pm?.account_id || '';
        let cashAccountName = pm?.account_name || '';
        
        if (!cashAccountId) {
          const fallbackAccount = accounts.find(a => 
            a.name.includes('نقدية') || a.name.includes('خزينة') || a.name.includes('صندوق')
          );
          cashAccountId = fallbackAccount?.id || 'cash_account_default';
          cashAccountName = fallbackAccount?.name || 'حساب النقدية (افتراضي)';
        }

        // Line 3: Dr. Customer (Offsetting the credit from Line 1)
        journalItems.push({
          account_id: customerAccountId,
          account_name: customerAccountName,
          debit: total_amount,
          credit: 0,
          description: `تسوية نقدية لمرتجع مبيعات رقم ${return_number} - ${customer?.name}`,
          customer_id: selectedCustomerId,
          customer_name: customer?.name
        });

        // Line 4: Cr. Cash/Bank (We paid money)
        journalItems.push({
          account_id: cashAccountId,
          account_name: cashAccountName,
          debit: 0,
          credit: total_amount,
          description: `دفع نقدية مقابل مرتجع مبيعات رقم ${return_number} - ${customer?.name}`
        });
      }

      if (journalItems.length > 0) {
        const journalEntry: Omit<JournalEntry, 'id'> = {
          date,
          reference_number: return_number,
          reference_id: id,
          reference_type: 'return',
          description: `قيد مرتجع مبيعات رقم ${return_number}`,
          items: journalItems,
          total_debit: journalItems.reduce((sum, item) => sum + item.debit, 0),
          total_credit: journalItems.reduce((sum, item) => sum + item.credit, 0),
          company_id: user.company_id,
          created_at: new Date().toISOString(),
          created_by: user.id
        };
        await dbService.createJournalEntry(journalEntry);
      }
      
      const action = editingReturn ? 'تعديل مرتجع' : 'إضافة مرتجع';
      const details = editingReturn ? `تعديل المرتجع رقم: ${return_number}` : `إضافة مرتجع جديد رقم: ${return_number}`;
      await dbService.logActivity(user.id, user.username, user.company_id, action, details, 'returns', id);
      
      showNotification(editingReturn ? 'تم تعديل المرتجع بنجاح' : 'تم إضافة المرتجع بنجاح', 'success');
      closeModal();
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء حفظ المرتجع', 'error');
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

  const openModal = (ret?: Return) => {
    if (ret) {
      setEditingReturn(ret);
      setSelectedCustomerId(ret.customer_id);
      setDate(ret.date);
      setPaymentType(ret.payment_type);
      setPaymentMethodId(ret.payment_method_id || '');
      setItems(ret.items);
    } else {
      setEditingReturn(null);
      setSelectedCustomerId('');
      setDate(new Date().toISOString().slice(0, 10));
      setPaymentType('credit');
      setPaymentMethodId('');
      setItems([{ product_id: '', product_name: '', quantity: 1, price: 0, total: 0 }]);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingReturn(null);
  };

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
          price: item.price || product?.sale_price || 0,
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">{t('returns.title')}</h2>
          <p className="text-zinc-500">{t('returns.subtitle')}</p>
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
            className="flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-2xl font-bold hover:bg-orange-700 transition-all active:scale-95 shadow-lg shadow-orange-200"
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
              className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2 bg-zinc-50 border-none rounded-xl focus:ring-2 focus:ring-orange-500 transition-all`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div ref={tableRef} id="returns-list-table" className="overflow-x-auto hidden md:block">
          <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
            <thead>
              <tr className="bg-zinc-50/50 text-zinc-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-bold">{t('returns.column_number')}</th>
                <th className="px-6 py-4 font-bold">{t('returns.column_customer')}</th>
                <th className="px-6 py-4 font-bold">{t('returns.column_date')}</th>
                <th className="px-6 py-4 font-bold">{t('returns.column_type')}</th>
                <th className="px-6 py-4 font-bold">{t('returns.column_total')}</th>
                <th className={`px-6 py-4 font-bold ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filteredReturns.map((ret) => (
                <tr key={ret.id} className="hover:bg-zinc-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs bg-zinc-100 px-2 py-1 rounded text-zinc-600">{ret.return_number}</span>
                  </td>
                  <td className="px-6 py-4 font-bold text-zinc-900">{ret.customer_name}</td>
                  <td className="px-6 py-4 text-zinc-500">{ret.date}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${ret.payment_type === 'cash' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-orange-50 text-orange-600 border border-orange-100'}`}>
                      {ret.payment_type === 'cash' ? t('returns.payment_cash') : t('returns.payment_credit')}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-orange-600">{ret.total_amount.toLocaleString()} {t('returns.currency')}</td>
                  <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>
                    <div className={`flex items-center ${dir === 'rtl' ? 'justify-start' : 'justify-end'} gap-2 opacity-0 group-hover:opacity-100 transition-opacity`}>
                      <button 
                        onClick={() => {
                          setActivityLogDocumentId(ret.id);
                          setIsActivityLogOpen(true);
                        }}
                        className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-all no-pdf"
                        title={t('common.activity_log')}
                      >
                        <History size={18} />
                      </button>
                      <button 
                        onClick={() => openModal(ret)}
                        className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all no-pdf"
                        title={t('common.edit')}
                      >
                        <FileText size={18} />
                      </button>
                      <button 
                        onClick={() => handleViewReturn(ret)}
                        className="p-2 text-zinc-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-all no-pdf"
                        title={t('common.view')}
                      >
                        <Eye size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(ret.id)}
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
        </div>

        {/* Mobile List View */}
        <div className="md:hidden divide-y divide-zinc-50">
          {filteredReturns.map((ret) => (
            <div key={ret.id} className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[10px] bg-orange-50 px-2 py-1 rounded text-orange-700 font-bold w-fit">{ret.return_number}</span>
                  <h4 className="font-bold text-zinc-900 text-lg">{ret.customer_name}</h4>
                </div>
                <div className={dir === 'rtl' ? 'text-left' : 'text-right'}>
                  <p className="font-bold text-orange-600 text-lg">{ret.total_amount.toLocaleString()} {t('returns.currency')}</p>
                  <span className="text-xs text-zinc-400">{ret.date}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
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

      {/* Create Return Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center md:p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full h-full md:h-auto md:max-w-6xl md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 md:max-h-[90vh] flex flex-col">
            <div className="p-4 md:p-6 border-b border-zinc-50 flex items-center justify-between bg-zinc-50/50 sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white">
                  <RotateCcw size={20} className="md:w-6 md:h-6" />
                </div>
                <div>
                  <h3 className="text-lg md:text-xl font-bold text-zinc-900">{editingReturn ? t('returns.edit') : t('returns.add')}</h3>
                  <p className="text-[10px] md:text-xs text-zinc-500 hidden md:block">{t('returns.form_subtitle')}</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setShowSidePanel(!showSidePanel)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${showSidePanel ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-zinc-100 text-zinc-600 border border-zinc-200 hover:bg-zinc-200'}`}
                >
                  <History size={14} />
                  {showSidePanel ? t('common.hide_side_panel') : t('common.journal_entry')}
                </button>
              </div>
              <button onClick={closeModal} className="text-zinc-400 hover:text-zinc-600 p-2 hover:bg-zinc-100 rounded-full transition-all">
                <X size={24} />
              </button>
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
                    className="absolute inset-y-0 left-0 z-50 w-full lg:w-80 shadow-2xl lg:shadow-none lg:relative lg:inset-auto"
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
                          documentId={''}
                          category="returns" 
                          previewJournalEntry={previewJournalEntry}
                          previewActivityLog={previewActivityLog}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 pb-32 md:pb-6">
                <SmartAIInput transactionType="return" onDataExtracted={applyAiData} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('returns.form_customer')}</label>
                    <select 
                      required
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
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
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('returns.form_date')}</label>
                    <input 
                      required
                      type="date"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('returns.form_payment_type')}</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentType('credit')}
                        className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${paymentType === 'credit' ? 'bg-orange-600 text-white shadow-lg shadow-orange-200' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
                      >
                        <CreditCard size={18} />
                        {t('returns.payment_credit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentType('cash')}
                        className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${paymentType === 'cash' ? 'bg-orange-600 text-white shadow-lg shadow-orange-200' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
                      >
                        <Wallet size={18} />
                        {t('returns.payment_cash')}
                      </button>
                    </div>
                  </div>
                  {paymentType === 'cash' && (
                    <div className="animate-in slide-in-from-top-2 duration-200">
                      <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('returns.form_payment_method')}</label>
                      <select 
                        required
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                        value={paymentMethodId}
                        onChange={(e) => setPaymentMethodId(e.target.value)}
                      >
                        <option value="">{t('common.select_method')}</option>
                        {paymentMethods.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="bg-orange-50 rounded-2xl p-6 border border-orange-100 flex flex-col justify-center items-center text-center">
                  <span className="text-orange-600 text-sm font-bold uppercase tracking-widest mb-1">{t('returns.summary_total')}</span>
                  <span className="text-4xl font-black text-orange-700">
                    {items.reduce((sum, item) => sum + (item.total || 0), 0).toLocaleString()} <span className="text-lg">{t('returns.currency')}</span>
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <h4 className="font-bold text-zinc-900 flex items-center gap-2">
                      <FileText size={18} className="text-orange-500" />
                      {t('returns.form_items')}
                    </h4>
                    <button 
                      type="button"
                      onClick={() => setShowSidePanel(!showSidePanel)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${showSidePanel ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-zinc-100 text-zinc-600 border border-zinc-200 hover:bg-zinc-200'}`}
                    >
                      <History size={14} />
                      {showSidePanel ? t('common.hide_side_panel') : t('common.journal_entry')}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={addEmptyRow}
                      className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-sm font-bold hover:bg-emerald-100 transition-colors flex items-center gap-2"
                    >
                      <Plus size={16} />
                      {t('returns.add_item')}
                    </button>
                    <select 
                      className="px-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                      onChange={(e) => {
                        if (e.target.value === 'new_product') {
                          setIsProductModalOpen(true);
                          e.target.value = "";
                        } else if (e.target.value !== "") {
                          addItem(e.target.value);
                          e.target.value = "";
                        }
                      }}
                    >
                      <option value="">{t('common.select_product')}</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.sale_price} {t('returns.currency')})</option>
                      ))}
                      <option value="new_product" className="font-bold text-emerald-600">+ {t('products.add')}</option>
                    </select>
                  </div>
                </div>

                <div className="border border-zinc-100 rounded-2xl overflow-hidden">
                  <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'} text-sm`}>
                    <thead className="bg-zinc-50 text-zinc-500 uppercase text-[10px] font-bold tracking-wider">
                      <tr>
                        <th className="px-4 py-3 w-12 text-center">{t('products.column_image')}</th>
                        <th className="px-4 py-3">{t('returns.column_product')}</th>
                        <th className="px-4 py-3 w-24">{t('returns.column_quantity')}</th>
                        <th className="px-4 py-3 w-32">{t('returns.column_price')}</th>
                        <th className="px-4 py-3 w-32">{t('returns.column_total')}</th>
                        <th className="px-4 py-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {items.map((item, index) => (
                        <tr key={index}>
                          <td className="px-4 py-3 text-center">
                            {item.product_image_url ? (
                              <img 
                                src={item.product_image_url} 
                                alt={item.product_name} 
                                className="w-8 h-8 object-cover rounded-lg mx-auto border border-zinc-100"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-8 h-8 bg-zinc-50 rounded-lg flex items-center justify-center mx-auto border border-zinc-100">
                                <Box size={14} className="text-zinc-300" />
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <select 
                              className="w-full bg-transparent outline-none font-bold text-zinc-900 appearance-none cursor-pointer"
                              value={item.product_id}
                              onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                            >
                              <option value="">{t('common.select_product')}</option>
                              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <input 
                              type="number"
                              min="1"
                              className="w-full px-2 py-1 bg-zinc-50 border border-zinc-200 rounded-lg text-center"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input 
                              type="number"
                              className="w-full px-2 py-1 bg-zinc-50 border border-zinc-200 rounded-lg text-center"
                              value={item.price}
                              onChange={(e) => updateItem(index, 'price', Number(e.target.value))}
                            />
                          </td>
                          <td className="px-4 py-3 font-bold text-zinc-900">{item.total.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <button 
                              type="button"
                              onClick={() => removeItem(index)}
                              className="text-zinc-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {items.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-zinc-400 italic">{t('common.no_data')}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="submit"
                  disabled={items.length === 0 || selectedCustomerId === '' || isSaving}
                  className="flex-1 py-4 bg-orange-500 text-white rounded-2xl font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {t('common.saving')}
                    </>
                  ) : (
                    t('common.save')
                  )}
                </button>
                <button 
                  type="button"
                  onClick={closeModal}
                  disabled={isSaving}
                  className="px-8 py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all disabled:opacity-50"
                >
                  {t('common.cancel')}
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
          <div ref={returnRef} id="return-capture-area" className="bg-white w-full h-full md:h-auto md:max-w-2xl md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col" style={{ backgroundColor: '#ffffff', color: '#18181b' }}>
            <div className="p-4 md:p-6 border-b border-zinc-50 flex items-center justify-between bg-zinc-50/50 sticky top-0 z-10 md:hidden" style={{ backgroundColor: '#f4f4f5' }}>
              <h3 className="text-lg font-bold text-zinc-900" style={{ color: '#18181b' }}>{t('returns.view_return')}</h3>
              <button onClick={() => setViewReturn(null)} className="text-zinc-400 hover:text-zinc-600 p-2 hover:bg-zinc-100 rounded-full transition-all">
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row h-full">
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-2xl md:text-3xl font-bold text-zinc-900" style={{ color: '#18181b' }}>{t('returns.title')}</h3>
                    <p className="text-zinc-500 font-mono text-sm md:text-base" style={{ color: '#71717a' }}>{viewReturn.return_number}</p>
                  </div>
                  <button onClick={() => setViewReturn(null)} className="hidden md:block text-zinc-400 hover:text-zinc-600 p-2 hover:bg-zinc-100 rounded-full transition-all">
                    <X size={24} />
                  </button>
                </div>
                <div className={`flex ${dir === 'rtl' ? 'justify-end' : 'justify-start'} gap-2`}>
                  <button 
                    onClick={() => {
                      setActivityLogDocumentId(viewReturn.id);
                      setIsActivityLogOpen(true);
                    }}
                    className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all"
                    title={t('common.activity_log')}
                  >
                    <History size={20} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1" style={{ color: '#71717a' }}>{t('returns.column_customer')}</p>
                    <p className="text-lg font-bold text-zinc-900" style={{ color: '#18181b' }}>{viewReturn.customer_name}</p>
                  </div>
                  <div className={dir === 'rtl' ? 'text-left' : 'text-right'}>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1" style={{ color: '#71717a' }}>{t('returns.column_date')}</p>
                    <p className="text-lg font-bold text-zinc-900" style={{ color: '#18181b' }}>{viewReturn.date}</p>
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
                          <td className="px-6 py-4 text-zinc-500" style={{ color: '#71717a' }}>{item.price.toLocaleString()}</td>
                          <td className="px-6 py-4 font-bold text-zinc-900" style={{ color: '#18181b' }}>{item.total.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-zinc-50/50" style={{ backgroundColor: '#fafafa' }}>
                      <tr>
                        <td colSpan={3} className="px-6 py-4 font-bold text-zinc-500" style={{ color: '#71717a' }}>{t('returns.summary_total')}</td>
                        <td className="px-6 py-4 font-black text-orange-600 text-lg" style={{ color: '#ea580c' }}>{viewReturn.total_amount.toLocaleString()} {t('returns.currency')}</td>
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
                        className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all`}
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
                        className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all text-left`}
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
                        className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all text-left`}
                        value={customerFormData.email}
                        onChange={(e) => setCustomerFormData({ ...customerFormData, email: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('customers.form_address')}</label>
                    <textarea
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
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
                          className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all`}
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
                          className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all`}
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
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
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
                        className="w-full px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
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
                      <p className="text-[10px] text-orange-600 mt-1 font-medium">{t('customers.form_counter_account_hint')}</p>
                    </div>
                  )}
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-orange-500 text-white rounded-2xl font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 active:scale-95"
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
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                      value={productFormData.name}
                      onChange={(e) => setProductFormData({ ...productFormData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('products.form_code')}</label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                      value={productFormData.code}
                      onChange={(e) => setProductFormData({ ...productFormData, code: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('products.form_category')}</label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                      value={productFormData.category}
                      onChange={(e) => setProductFormData({ ...productFormData, category: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('products.form_unit')}</label>
                    <select
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
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
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                      value={productFormData.cost_price}
                      onChange={(e) => setProductFormData({ ...productFormData, cost_price: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('products.form_sale_price')}</label>
                    <input
                      required
                      type="number"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                      value={productFormData.sale_price}
                      onChange={(e) => setProductFormData({ ...productFormData, sale_price: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('products.form_stock_quantity')}</label>
                    <input
                      type="number"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                      value={productFormData.stock}
                      onChange={(e) => setProductFormData({ ...productFormData, stock: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('products.form_min_stock')}</label>
                    <input
                      type="number"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                      value={productFormData.min_stock}
                      onChange={(e) => setProductFormData({ ...productFormData, min_stock: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
              <div className="p-4 md:p-6 border-t border-zinc-50 bg-zinc-50/50 flex gap-3 sticky bottom-0">
                <button 
                  type="submit"
                  className="flex-1 py-4 bg-orange-500 text-white rounded-2xl font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 active:scale-95"
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
