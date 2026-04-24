import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Supplier, Product, PaymentMethod, JournalEntry, JournalEntryItem, Account } from '../types';
import { Search, Plus, Trash2, X, RotateCcw, User, CreditCard, Calendar, Hash, Package, Save, Eye, Download, History, Printer, Edit, Phone, Mail, MapPin, Wallet, Box } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SmartAIInput } from '../components/SmartAIInput';
import { exportToPDF as exportToPDFUtil } from '../utils/pdfUtils';
import { exportToExcel, formatDataForExcel } from '../utils/excelUtils';
import { dbService } from '../services/dbService';
import { PageActivityLog } from '../components/PageActivityLog';
import { TransactionSidePanel } from '../components/TransactionSidePanel';
import { ExportButtons } from '../components/ExportButtons';
import { ActivityLog } from '../types';

export const PurchaseReturns: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [purchaseReturns, setPurchaseReturns] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewReturn, setViewReturn] = useState<any | null>(null);
  const [editingReturn, setEditingReturn] = useState<any | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [returnToDelete, setReturnToDelete] = useState<string | null>(null);
  const returnRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
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
    date: new Date().toISOString().slice(0, 10),
    payment_type: 'credit' as 'credit' | 'cash',
    payment_method_id: '',
    notes: ''
  });

  const [items, setItems] = useState<{ product_id: string; quantity: number; cost_price: number }[]>([]);

  useEffect(() => {
    if (user) {
      const unsubPR = dbService.subscribe<any>('purchase_returns', user.company_id, setPurchaseReturns);
      const unsubSuppliers = dbService.subscribe<Supplier>('suppliers', user.company_id, setSuppliers);
      const unsubProducts = dbService.subscribe<Product>('products', user.company_id, setProducts);
      const unsubPM = dbService.subscribe<PaymentMethod>('payment_methods', user.company_id, setPaymentMethods);
      const unsubAccounts = dbService.subscribe<any>('accounts', user.company_id, setAccounts);
      
      setLoading(false);
      return () => {
        unsubPR();
        unsubSuppliers();
        unsubProducts();
        unsubPM();
        unsubAccounts();
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
        details: `إضافة مرتجع مشتريات جديد للمورد ${supplier?.name || '...'} بمبلغ ${total_amount.toLocaleString()}`,
        timestamp: new Date().toISOString()
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
        let creditAccountId = product?.cost_account_id || '';
        let creditAccountName = product?.cost_account_name || '';

        if (!creditAccountId) {
          const fallbackAccount = accounts.find(a => 
            a.name.includes('مخزون') || a.name.includes('مشتريات')
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

    try {
      const supplier = suppliers.find(s => s.id === returnData.supplier_id);
      const paymentMethod = paymentMethods.find(pm => pm.id === returnData.payment_method_id);
      const return_number = editingReturn ? editingReturn.return_number : `PRET-${Date.now().toString().slice(-6)}`;
      
      const total_amount = validItems.reduce((sum, item) => sum + (item.quantity * item.cost_price), 0);

      const data = {
        ...returnData,
        supplier_name: supplier?.name || '',
        payment_method_name: paymentMethod?.name || '',
        total_amount,
        return_number,
        items: validItems.map(item => {
          const product = products.find(p => p.id === item.product_id);
          return {
            ...item,
            product_name: product?.name || '',
            product_image_url: product?.image_url || '',
            price: item.cost_price,
            total: item.quantity * item.cost_price
          };
        }),
        company_id: user.company_id
      };

      let id = '';

      if (editingReturn) {
        id = editingReturn.id;
        await dbService.update('purchase_returns', id, data);
        
        // Delete old journal entry and create new one
        await dbService.deleteJournalEntryByReference(id, user.company_id);
      } else {
        id = await dbService.add('purchase_returns', data);
      }

      // Create Journal Entry
      const journalItems: JournalEntryItem[] = [];

      // ALWAYS Debit: Supplier Account first (for the return part)
      let supplierAccountId = supplier?.account_id || '';
      let supplierAccountName = supplier?.account_name || '';
      
      if (!supplierAccountId) {
        const fallbackAccount = accounts.find(a => a.name.includes('موردين'));
        supplierAccountId = fallbackAccount?.id || 'suppliers_account_default';
        supplierAccountName = fallbackAccount?.name || 'حساب الموردين (افتراضي)';
      }

      // Line 1: Dr. Supplier (Reducing liability)
      journalItems.push({
        account_id: supplierAccountId,
        account_name: supplierAccountName,
        debit: total_amount,
        credit: 0,
        description: `مرتجع مشتريات رقم ${return_number} - ${supplier?.name}`,
        supplier_id: returnData.supplier_id,
        supplier_name: supplier?.name
      });

      // Line 2: Cr. Cost Accounts (per product) - reversing the purchase
      (items || []).forEach(item => {
        const product = products.find(p => p.id === item.product_id);
        let creditAccountId = product?.cost_account_id || '';
        let creditAccountName = product?.cost_account_name || '';

        if (!creditAccountId) {
          const fallbackAccount = accounts.find(a => 
            a.name.includes('مشتريات') || a.name.includes('تكلفة')
          );
          creditAccountId = fallbackAccount?.id || 'purchase_account_default';
          creditAccountName = fallbackAccount?.name || 'حساب المشتريات (افتراضي)';
        }

        journalItems.push({
          account_id: creditAccountId,
          account_name: creditAccountName,
          debit: 0,
          credit: item.quantity * item.cost_price,
          description: `مرتجع مشتريات صنف: ${product?.name} - مرتجع ${return_number}`
        });
      });

      // If Cash, add the payment lines (Dr. Cash / Cr. Supplier)
      // Wait, for Purchase Return CASH: We received cash from supplier.
      // So: Dr. Cash / Cr. Supplier
      if (returnData.payment_type === 'cash' && returnData.payment_method_id) {
        const pm = paymentMethods.find(p => p.id === returnData.payment_method_id);
        let cashAccountId = pm?.account_id || '';
        let cashAccountName = pm?.account_name || '';
        
        if (!cashAccountId) {
          const fallbackAccount = accounts.find(a => 
            a.name.includes('نقدية') || a.name.includes('خزينة') || a.name.includes('صندوق')
          );
          cashAccountId = fallbackAccount?.id || 'cash_account_default';
          cashAccountName = fallbackAccount?.name || 'حساب النقدية (افتراضي)';
        }

        // Line 3: Dr. Cash/Bank (We received money)
        journalItems.push({
          account_id: cashAccountId,
          account_name: cashAccountName,
          debit: total_amount,
          credit: 0,
          description: `استلام نقدية مقابل مرتجع مشتريات رقم ${return_number} - ${supplier?.name}`
        });

        // Line 4: Cr. Supplier (Offsetting the debit from Line 1)
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

      if (journalItems.length > 0) {
        const journalEntry: Omit<JournalEntry, 'id'> = {
          date: returnData.date,
          reference_number: return_number,
          reference_id: id,
          reference_type: 'purchase_return',
          description: `قيد مرتجع مشتريات رقم ${return_number}`,
          items: journalItems,
          total_debit: total_amount,
          total_credit: total_amount,
          company_id: user.company_id,
          created_at: new Date().toISOString(),
          created_by: user.id
        };
        await dbService.createJournalEntry(journalEntry);
      }
      
      await dbService.logActivity(
        user.id, 
        user.username, 
        user.company_id, 
        editingReturn ? 'تعديل مرتجع مشتريات' : 'إضافة مرتجع مشتريات', 
        `${editingReturn ? 'تعديل' : 'إضافة'} مرتجع مشتريات رقم: ${return_number}`, 
        'purchase_returns', 
        id
      );
      
      showNotification(editingReturn ? 'تم تحديث مرتجع المشتريات بنجاح' : 'تم حفظ مرتجع المشتريات بنجاح');
      closeModal();
      setEditingReturn(null);
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء حفظ مرتجع المشتريات', 'error');
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

  const openModal = () => {
    setReturnData({
      supplier_id: '',
      date: new Date().toISOString().slice(0, 10),
      payment_type: 'credit',
      payment_method_id: '',
      notes: ''
    });
    setItems([{ product_id: '', quantity: 1, cost_price: 0 }]);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleEdit = (ret: any) => {
    setEditingReturn(ret);
    setReturnData({
      supplier_id: ret.supplier_id,
      date: ret.date,
      payment_type: ret.payment_type || 'credit',
      payment_method_id: ret.payment_method_id || '',
      notes: ret.notes || ''
    });
    setItems(ret.items.map((item: any) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      cost_price: item.price
    })));
    setIsModalOpen(true);
  };

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
      setIsDeleteModalOpen(false);
      setReturnToDelete(null);
    } catch (e) {
      console.error(e);
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
            className="flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-2xl font-bold hover:bg-orange-700 transition-all active:scale-95 shadow-lg shadow-orange-200"
          >
            <Plus size={20} />
            إضافة مرتجع
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-50 flex items-center gap-4">
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
        </div>

        <div ref={tableRef} id="purchase-returns-list-table" className="hidden md:block overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-zinc-50/50 text-zinc-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-bold">رقم المرتجع</th>
                <th className="px-6 py-4 font-bold">المورد</th>
                <th className="px-6 py-4 font-bold">التاريخ</th>
                <th className="px-6 py-4 font-bold">النوع</th>
                <th className="px-6 py-4 font-bold">المبلغ</th>
                <th className="px-6 py-4 font-bold text-left">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-400 italic">لا توجد مرتجعات مشتريات حالياً</td>
                </tr>
              ) : filteredReturns.map((ret) => (
                <tr key={ret.id} className="hover:bg-zinc-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs bg-red-50 px-2 py-1 rounded text-red-700 font-bold">{ret.return_number}</span>
                  </td>
                  <td className="px-6 py-4 font-bold text-zinc-900">{ret.supplier_name}</td>
                  <td className="px-6 py-4 text-zinc-500">{ret.date}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${ret.payment_type === 'cash' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-orange-50 text-orange-600 border border-orange-100'}`}>
                      {ret.payment_type === 'cash' ? 'نقدي' : 'آجل'}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-zinc-900">{ret.total_amount.toLocaleString()} ج.م</td>
                  <td className="px-6 py-4 text-left">
                    <div className="flex items-center justify-start gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          setActivityLogDocumentId(ret.id);
                          setIsActivityLogOpen(true);
                        }}
                        className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all no-pdf"
                        title="سجل النشاط"
                      >
                        <History size={18} />
                      </button>
                      <button 
                        onClick={() => handleViewReturn(ret.id)}
                        className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all no-pdf"
                      >
                        <Eye size={18} />
                      </button>
                      <button 
                        onClick={() => handleEdit(ret)}
                        className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all no-pdf"
                        title="تعديل"
                      >
                        <Edit size={18} />
                      </button>
                      <button 
                        onClick={() => exportToPDF(ret)}
                        className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all no-pdf"
                      >
                        <Download size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(ret.id)}
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
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-zinc-100">
          {filteredReturns.length === 0 ? (
            <div className="px-6 py-12 text-center text-zinc-400 italic">لا توجد مرتجعات مشتريات حالياً</div>
          ) : (
            filteredReturns.map((ret) => (
              <div key={ret.id} className="p-4 space-y-3 active:bg-zinc-50 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs bg-red-50 px-2 py-1 rounded text-red-700 font-bold">{ret.return_number}</span>
                  <span className="text-xs text-zinc-500 flex items-center gap-1">
                    <Calendar size={12} />
                    {ret.date}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-600 flex items-center justify-center">
                      <User size={14} />
                    </div>
                    <span className="font-bold text-zinc-900">{ret.supplier_name}</span>
                  </div>
                  <span className="font-bold text-red-600">{ret.total_amount.toLocaleString()} ج.م</span>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
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
        <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm z-50 flex items-center justify-center md:p-4 overflow-y-auto">
          <div className="bg-white md:rounded-3xl w-full max-w-6xl shadow-2xl animate-in zoom-in-95 duration-200 min-h-screen md:min-h-0 md:my-auto">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-4">
                <h3 className="text-2xl font-bold text-zinc-900 italic serif">إنشاء مرتجع مشتريات</h3>
                <button 
                  type="button"
                  onClick={() => setShowSidePanel(!showSidePanel)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${showSidePanel ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-zinc-100 text-zinc-600 border border-zinc-200 hover:bg-zinc-200'}`}
                >
                  <History size={14} />
                  {showSidePanel ? 'إخفاء القيد والسجل' : 'قيد اليومية'}
                </button>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-zinc-100 rounded-xl transition-all">
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
                        <h3 className="font-bold text-zinc-900">سجل النشاط والقيد</h3>
                        <button onClick={() => setShowSidePanel(false)} className="p-2 text-zinc-400 hover:text-zinc-600">
                          <X size={20} />
                        </button>
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <TransactionSidePanel 
                          category="purchase_returns" 
                          previewJournalEntry={previewJournalEntry}
                          previewActivityLog={previewActivityLog}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit} className="flex-1 p-4 md:p-8 space-y-6 overflow-y-auto">
                <SmartAIInput transactionType="purchase_return" onDataExtracted={applyAiData} />
                <div className="bg-white p-4 md:p-8 rounded-3xl border border-zinc-100 shadow-sm space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-2 uppercase tracking-tighter">المورد</label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <select 
                        required
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none"
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
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-2 uppercase tracking-tighter">التاريخ</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <input 
                        required
                        type="date" 
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={returnData.date}
                        onChange={(e) => setReturnData({...returnData, date: e.target.value})}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-2 uppercase tracking-tighter">نوع المرتجع</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setReturnData({ ...returnData, payment_type: 'credit' })}
                        className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${returnData.payment_type === 'credit' ? 'bg-orange-600 text-white shadow-lg shadow-orange-200' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
                      >
                        <CreditCard size={18} />
                        آجل
                      </button>
                      <button
                        type="button"
                        onClick={() => setReturnData({ ...returnData, payment_type: 'cash' })}
                        className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${returnData.payment_type === 'cash' ? 'bg-orange-600 text-white shadow-lg shadow-orange-200' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
                      >
                        <Wallet size={18} />
                        نقدي
                      </button>
                    </div>
                  </div>

                  {returnData.payment_type === 'cash' && (
                    <div className="animate-in slide-in-from-top-2 duration-200">
                      <label className="block text-sm font-bold text-zinc-700 mb-2 uppercase tracking-tighter">طريقة استرداد المبلغ (إلى خزينة/بنك)</label>
                      <div className="relative">
                        <Wallet className="absolute left-3 top-3 text-zinc-400" size={18} />
                        <select 
                          required
                          className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none"
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
                          {paymentMethods.map(pm => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
                          <option value="new" className="font-bold text-emerald-600">+ إضافة طريقة دفع...</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-2 uppercase tracking-tighter">ملاحظات</label>
                  <textarea 
                    rows={2}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none"
                    placeholder="سبب الارتجاع أو أي ملاحظات..."
                    value={returnData.notes}
                    onChange={(e) => setReturnData({...returnData, notes: e.target.value})}
                  />
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
                <div className="p-4 md:p-6 border-b border-zinc-50 flex items-center justify-between bg-zinc-50/50">
                  <h3 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
                    <RotateCcw size={24} className="text-red-500" />
                    الأصناف المرتجعة
                  </h3>
                  <button 
                    type="button"
                    onClick={addItem}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-all active:scale-95"
                  >
                    <Plus size={18} />
                    إضافة صنف
                  </button>
                </div>

                {/* Desktop Table for Items */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-zinc-50/30 border-b border-zinc-100">
                        <th className="px-6 py-4 text-sm font-bold text-zinc-500 uppercase tracking-tighter w-16 text-center">صورة</th>
                        <th className="px-6 py-4 text-sm font-bold text-zinc-500 uppercase tracking-tighter">الصنف</th>
                        <th className="px-6 py-4 text-sm font-bold text-zinc-500 uppercase tracking-tighter w-32">الكمية</th>
                        <th className="px-6 py-4 text-sm font-bold text-zinc-500 uppercase tracking-tighter w-48">سعر التكلفة</th>
                        <th className="px-6 py-4 text-sm font-bold text-zinc-500 uppercase tracking-tighter w-48">الإجمالي</th>
                        <th className="px-6 py-4 text-sm font-bold text-zinc-500 uppercase tracking-tighter w-20"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-zinc-400 italic">لا توجد أصناف مضافة حالياً</td>
                        </tr>
                      ) : items.map((item, index) => (
                        <tr key={index} className="hover:bg-zinc-50/50 transition-colors">
                          <td className="px-6 py-4 text-center">
                            {(item as any).product_image_url ? (
                              <img 
                                src={(item as any).product_image_url} 
                                alt="Product" 
                                className="w-10 h-10 object-cover rounded-lg mx-auto border border-zinc-100"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-zinc-50 rounded-lg flex items-center justify-center mx-auto border border-zinc-100">
                                <Box size={16} className="text-zinc-300" />
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <select 
                              required
                              className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
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
                          </td>
                          <td className="px-6 py-4">
                            <input 
                              required
                              type="number" 
                              min="1"
                              className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-center"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                            />
                          </td>
                          <td className="px-6 py-4">
                            <input 
                              required
                              type="number" 
                              step="0.01"
                              className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-center"
                              value={item.cost_price}
                              onChange={(e) => updateItem(index, 'cost_price', Number(e.target.value))}
                            />
                          </td>
                          <td className="px-6 py-4 font-bold text-zinc-900">
                            {(item.quantity * item.cost_price).toLocaleString()} ج.م
                          </td>
                          <td className="px-6 py-4">
                            <button 
                              type="button"
                              onClick={() => removeItem(index)}
                              className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View for Items */}
                <div className="md:hidden divide-y divide-zinc-100">
                  {items.length === 0 ? (
                    <div className="px-6 py-12 text-center text-zinc-400 italic">لا توجد أصناف مضافة حالياً</div>
                  ) : items.map((item, index) => (
                    <div key={index} className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {(item as any).product_image_url ? (
                            <img 
                              src={(item as any).product_image_url} 
                              alt="Product" 
                              className="w-12 h-12 object-cover rounded-xl border border-zinc-100"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-zinc-50 rounded-xl flex items-center justify-center border border-zinc-100">
                              <Box size={20} className="text-zinc-300" />
                            </div>
                          )}
                          <span className="font-bold text-zinc-900">صنف #{index + 1}</span>
                        </div>
                        <button 
                          type="button"
                          onClick={() => removeItem(index)}
                          className="p-2 text-red-500 bg-red-50 rounded-lg"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">الصنف</label>
                          <select 
                            required
                            className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
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
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">الكمية</label>
                            <input 
                              required
                              type="number" 
                              min="1"
                              className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">سعر التكلفة</label>
                            <input 
                              required
                              type="number" 
                              step="0.01"
                              className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                              value={item.cost_price}
                              onChange={(e) => updateItem(index, 'cost_price', Number(e.target.value))}
                            />
                          </div>
                        </div>
                        <div className="flex justify-between items-center bg-zinc-50 p-3 rounded-xl">
                          <span className="text-sm text-zinc-500">الإجمالي:</span>
                          <span className="font-bold text-zinc-900">{(item.quantity * item.cost_price).toLocaleString()} ج.م</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-red-500 text-white p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                  <span className="font-bold text-lg">إجمالي المرتجع:</span>
                  <span className="font-bold text-3xl">
                    {calculateTotal().toLocaleString()} ج.م
                  </span>
                </div>
              </div>

              <div className="flex justify-end pt-6 border-t border-zinc-100 sticky bottom-0 bg-white p-4 md:p-0">
                <button 
                  type="submit"
                  className="w-full md:w-auto flex items-center justify-center gap-3 px-12 py-4 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition-all shadow-xl shadow-red-500/20 active:scale-95"
                >
                  <Save size={24} />
                  حفظ مرتجع المشتريات
                </button>
              </div>
            </form>
          </div>
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
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1" style={{ color: '#71717a' }}>المورد</p>
                    <p className="text-lg font-bold text-zinc-900" style={{ color: '#18181b' }}>{viewReturn.supplier_name}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1" style={{ color: '#71717a' }}>التاريخ</p>
                    <p className="text-lg font-bold text-zinc-900" style={{ color: '#18181b' }}>{viewReturn.date}</p>
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
                          <td className="px-6 py-4 text-zinc-500 hidden md:table-cell" style={{ color: '#71717a' }}>{item.price.toLocaleString()}</td>
                          <td className="px-6 py-4 font-bold text-zinc-900" style={{ color: '#18181b' }}>{item.total.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-zinc-50/50" style={{ backgroundColor: '#fafafa' }}>
                      <tr>
                        <td colSpan={window.innerWidth < 768 ? 2 : 3} className="px-6 py-4 font-bold text-zinc-500" style={{ color: '#71717a' }}>الإجمالي الكلي</td>
                        <td className="px-6 py-4 font-black text-red-600 text-lg" style={{ color: '#dc2626' }}>{viewReturn.total_amount.toLocaleString()} ج.م</td>
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
                        className="w-full px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
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
                      <p className="text-[10px] text-orange-600 mt-1 font-medium">يستخدم هذا الحساب لإنشاء قيد رصيد أول المدة (مثلاً: رأس المال أو الأرباح المرحلة)</p>
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
