import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Supplier, Product, PaymentMethod, ExpenseCategory, Account, JournalEntry, JournalEntryItem } from '../types';
import { 
  Search, Plus, Trash2, X, ShoppingCart, User, CreditCard, 
  Calendar, Hash, Package, Save, FileText, Pencil, Download, 
  Eye, History, Printer, ArrowRight, ArrowLeft, Minimize2, 
  Maximize2, Phone, Mail, MapPin, Wallet, Layers, Paperclip, Tag, Box
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SmartAIInput } from '../components/SmartAIInput';
import { exportToPDF as exportToPDFUtil } from '../utils/pdfUtils';
import { exportToExcel, formatDataForExcel } from '../utils/excelUtils';
import { dbService } from '../services/dbService';
import { PageActivityLog } from '../components/PageActivityLog';
import { InlineActivityLog } from '../components/InlineActivityLog';
import { JournalEntryPreview } from '../components/JournalEntryPreview';
import { TransactionSidePanel } from '../components/TransactionSidePanel';
import DocumentChatter from '../components/DocumentChatter';
import { ExportButtons } from '../components/ExportButtons';
import { ActivityLog } from '../types';

export const PurchaseInvoices: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [purchaseInvoices, setPurchaseInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewInvoice, setViewInvoice] = useState<any | null>(null);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isExpenseCategoryModalOpen, setIsExpenseCategoryModalOpen] = useState(false);
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
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
    code: '',
    name: '',
    type: 'product' as 'service' | 'product' | 'commodity',
    sale_price: 0,
    cost_price: 0,
    description: '',
    image_url: '',
    barcode: '',
    revenue_account_id: '',
    cost_account_id: ''
  });

  const [expenseCategoryFormData, setExpenseCategoryFormData] = useState({
    code: '',
    name: '',
    description: ''
  });

  const [paymentMethodFormData, setPaymentMethodFormData] = useState({
    code: '',
    name: '',
    type: 'cash' as 'cash' | 'bank' | 'wallet',
    account_id: '',
    opening_balance: 0,
    opening_balance_date: new Date().toISOString().slice(0, 10),
    counter_account_id: '',
    details: ''
  });

  const invoiceRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  
  // Invoice State
  const [invoiceData, setInvoiceData] = useState({
    supplier_id: '',
    date: new Date().toISOString().slice(0, 10),
    payment_type: 'cash' as 'cash' | 'credit',
    payment_method_id: '',
    notes: '',
    discount: 0,
    purchase_type: 'items' as 'items' | 'expenses'
  });

  const [items, setItems] = useState<{ 
    product_id?: string; 
    expense_category_id?: string;
    product_name?: string;
    category_name?: string;
    quantity: number; 
    cost_price: number;
    total: number;
  }[]>([]);

  useEffect(() => {
    if (user) {
      const unsubPI = dbService.subscribe<any>('purchase_invoices', user.company_id, setPurchaseInvoices);
      const unsubSuppliers = dbService.subscribe<Supplier>('suppliers', user.company_id, setSuppliers);
      const unsubProducts = dbService.subscribe<Product>('products', user.company_id, setProducts);
      const unsubPM = dbService.subscribe<PaymentMethod>('payment_methods', user.company_id, setPaymentMethods);
      const unsubCategories = dbService.subscribe<ExpenseCategory>('expense_categories', user.company_id, setCategories);
      const unsubAccounts = dbService.subscribe<Account>('accounts', user.company_id, setAccounts);
      
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
        unsubPI();
        unsubSuppliers();
        unsubProducts();
        unsubPM();
        unsubCategories();
        unsubAccounts();
      };
    }
  }, [user]);

  const generateInvoiceNumber = (selectedDate: string) => {
    const dateObj = new Date(selectedDate);
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    
    const monthInvoices = purchaseInvoices.filter(inv => {
      const invDate = new Date(inv.date);
      return (invDate.getMonth() + 1).toString().padStart(2, '0') === month;
    });

    let maxSeq = 0;
    monthInvoices.forEach(inv => {
      const parts = inv.invoice_number.split('-');
      if (parts.length === 3 && parts[1] === month) {
        const seq = parseInt(parts[2]);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    });
    
    const nextNumber = maxSeq + 1;
    return `PUR-${month}-${nextNumber.toString().padStart(5, '0')}`;
  };

  // Real-time Preview Logic
  useEffect(() => {
    if (!isModalOpen || !user) {
      setPreviewJournalEntry(null);
      setPreviewActivityLog(null);
      return;
    }

    // Update invoice number if date changes and we are creating a new invoice
    if (!editingInvoice) {
      setInvoiceNumber(generateInvoiceNumber(invoiceData.date));
    }
  }, [invoiceData.date, purchaseInvoices, isModalOpen, editingInvoice, user]);

  useEffect(() => {
    const generatePreview = () => {
      const subtotal = (items || []).reduce((sum, item) => sum + item.total, 0);
      const total_amount = subtotal - invoiceData.discount;
      if (subtotal <= 0) {
        setPreviewJournalEntry(null);
        setPreviewActivityLog(null);
        return;
      }

      const supplier = suppliers.find(s => s.id === invoiceData.supplier_id);
      const invoice_number = editingInvoice?.invoice_number || 'PUR-PREVIEW';

      // Preview Activity Log
      setPreviewActivityLog({
        action: editingInvoice ? 'تعديل فاتورة مشتريات' : 'إضافة فاتورة مشتريات',
        details: editingInvoice 
          ? `تعديل فاتورة مشتريات رقم: ${invoice_number} من المورد ${supplier?.name || '...'}`
          : `إضافة فاتورة مشتريات جديدة من المورد ${supplier?.name || '...'} بمبلغ ${total_amount.toLocaleString()}`,
        timestamp: new Date().toISOString()
      });

      // Preview Journal Entry
      const journalItems: JournalEntryItem[] = [];

      // Debit: Purchase/Expense Accounts (per item)
      (items || []).forEach(item => {
        let debitAccountId = '';
        let debitAccountName = '';

        if (invoiceData.purchase_type === 'items') {
          const product = products.find(p => p.id === item.product_id);
          debitAccountId = product?.cost_account_id || '';
          debitAccountName = product?.cost_account_name || '';
          
          if (!debitAccountId) {
            const fallbackAccount = accounts.find(a => a.name.includes('مشتريات'));
            debitAccountId = fallbackAccount?.id || 'purchase_account_default';
            debitAccountName = fallbackAccount?.name || 'حساب المشتريات (افتراضي)';
          }
        } else {
          const category = categories.find(c => c.id === item.expense_category_id);
          debitAccountId = category?.account_id || '';
          debitAccountName = category?.account_name || '';
          
          if (!debitAccountId) {
            const fallbackAccount = accounts.find(a => a.name.includes('مصروف'));
            debitAccountId = fallbackAccount?.id || 'expense_account_default';
            debitAccountName = fallbackAccount?.name || 'حساب المصروفات (افتراضي)';
          }
        }

        journalItems.push({
          account_id: debitAccountId,
          account_name: debitAccountName,
          debit: item.total,
          credit: 0,
          description: `مشتريات: ${item.product_name || item.category_name} - فاتورة ${invoice_number}`
        });
      });

      // Credit: Supplier or Payment Method
      let creditAccountId = '';
      let creditAccountName = '';

      if (invoiceData.payment_type === 'cash') {
        const pm = paymentMethods.find(p => p.id === invoiceData.payment_method_id);
        creditAccountId = pm?.account_id || '';
        creditAccountName = pm?.account_name || '';
        
        if (!creditAccountId) {
          const fallbackAccount = accounts.find(a => 
            a.name.includes('نقدية') || a.name.includes('خزينة') || a.name.includes('صندوق')
          );
          creditAccountId = fallbackAccount?.id || 'cash_account_default';
          creditAccountName = fallbackAccount?.name || 'حساب النقدية (افتراضي)';
        }
      } else {
        creditAccountId = supplier?.account_id || '';
        creditAccountName = supplier?.account_name || '';
        
        if (!creditAccountId) {
          const fallbackAccount = accounts.find(a => a.name.includes('موردين'));
          creditAccountId = fallbackAccount?.id || 'suppliers_account_default';
          creditAccountName = fallbackAccount?.name || 'حساب الموردين (افتراضي)';
        }
      }

      journalItems.push({
        account_id: creditAccountId,
        account_name: creditAccountName,
        debit: 0,
        credit: total_amount,
        description: `فاتورة مشتريات رقم ${invoice_number} - ${supplier?.name || '...'}`
      });

      // Credit: Discount Account (if any)
      if (invoiceData.discount > 0) {
        const discountAccount = accounts.find(a => a.id === settings?.supplier_discount_account_id) || 
                                accounts.find(a => a.name.includes('خصم مكتسب') || a.name.includes('خصم مشتريات'));
        journalItems.push({
          account_id: discountAccount?.id || 'purchase_discount_default',
          account_name: discountAccount?.name || 'حساب الخصم المكتسب (افتراضي)',
          debit: 0,
          credit: invoiceData.discount,
          description: `خصم مكتسب - فاتورة رقم ${invoice_number}`
        });
      }

      setPreviewJournalEntry({
        id: 'preview',
        date: invoiceData.date,
        reference_number: invoice_number,
        reference_id: 'preview',
        reference_type: 'purchase_invoice',
        description: `قيد فاتورة مشتريات رقم ${invoice_number}`,
        items: journalItems,
        total_debit: total_amount,
        total_credit: total_amount,
        company_id: user.company_id,
        created_at: new Date().toISOString(),
        created_by: user.id
      });
    };

    generatePreview();
  }, [isModalOpen, items, invoiceData, user, suppliers, products, categories, paymentMethods, accounts, editingInvoice, settings]);

  const addItem = () => {
    setItems(prev => [...prev, { quantity: 1, cost_price: 0, total: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: any) => {
    setItems(prev => {
      const newItems = [...prev];
      (newItems[index] as any)[field] = value;
      
      if (field === 'product_id' && invoiceData.purchase_type === 'items') {
        const product = products.find(p => p.id === value);
        if (product) {
          newItems[index].cost_price = product.cost_price;
          newItems[index].product_name = product.name;
          (newItems[index] as any).product_code = product.code;
          (newItems[index] as any).product_image_url = product.image_url;
        }
      } else if (field === 'expense_category_id' && invoiceData.purchase_type === 'expenses') {
        const category = categories.find(c => c.id === value);
        if (category) {
          newItems[index].category_name = category.name;
        }
      }
      
      newItems[index].total = (newItems[index].quantity || 0) * (newItems[index].cost_price || 0);
      return newItems;
    });
  };

  const exportToPDF = async (invoice: any) => {
    const element = invoiceRef.current;
    if (!element) {
      showNotification('حدث خطأ أثناء تحميل الفاتورة', 'error');
      return;
    }
    
    try {
      await exportToPDFUtil(element, {
        filename: `Purchase-Invoice-${invoice.invoice_number}.pdf`,
        margin: 10,
        orientation: 'portrait',
        reportTitle: `فاتورة مشتريات رقم: ${invoice.invoice_number}`
      });
    } catch (e) {
      console.error('PDF Export Error:', e);
      showNotification('حدث خطأ أثناء تصدير PDF', 'error');
    }
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + (item.total || 0), 0);
  };

  const calculateTotal = () => {
    const subtotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
    return subtotal - (invoiceData.discount || 0);
  };

  const applyAiData = (data: any) => {
    if (data.supplierName) {
      const supplier = suppliers.find(s => s.name.toLowerCase().includes(data.supplierName.toLowerCase()));
      if (supplier) setInvoiceData(prev => ({ ...prev, supplier_id: supplier.id }));
    }
    if (data.date) setInvoiceData(prev => ({ ...prev, date: data.date }));
    if (data.items) {
      const newItems = data.items.map((item: any) => {
        const product = products.find(p => p.name.toLowerCase().includes(item.productName.toLowerCase()));
        return {
          product_id: product?.id || '',
          product_name: product?.name || item.productName,
          quantity: item.quantity || 1,
          cost_price: item.price || product?.cost_price || 0,
          total: (item.quantity || 1) * (item.price || product?.cost_price || 0)
        };
      });
      setItems(newItems);
    }
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
            description: `رصيد أول المدة - ${supplierFormData.name}`,
            supplier_id: supplierId,
            supplier_name: supplierFormData.name
          },
          {
            account_id: supplierFormData.counter_account_id,
            account_name: counterAccount?.name || '',
            debit: supplierFormData.opening_balance > 0 ? supplierFormData.opening_balance : 0,
            credit: supplierFormData.opening_balance < 0 ? Math.abs(supplierFormData.opening_balance) : 0,
            description: `رصيد أول المدة - ${supplierFormData.name}`,
            supplier_id: supplierId,
            supplier_name: supplierFormData.name
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

      await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة مورد', `إضافة مورد جديد من فاتورة المشتريات: ${supplierFormData.name}`, ['suppliers', 'purchase_invoices']);
      
      setInvoiceData({ ...invoiceData, supplier_id: supplierId });
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
      const revenueAccount = accounts.find(a => a.id === productFormData.revenue_account_id);
      const costAccount = accounts.find(a => a.id === productFormData.cost_account_id);
      
      const newProduct = {
        ...productFormData,
        revenue_account_name: revenueAccount?.name || '',
        cost_account_name: costAccount?.name || '',
        company_id: user.company_id
      };
      const productId = await dbService.add('products', newProduct);
      await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة صنف', `إضافة صنف جديد من فاتورة المشتريات: ${productFormData.name}`, ['products', 'purchase_invoices']);
      
      setIsProductModalOpen(false);
      setProductFormData({
        code: '',
        name: '',
        type: 'product',
        sale_price: 0,
        cost_price: 0,
        description: '',
        image_url: '',
        barcode: '',
        revenue_account_id: '',
        cost_account_id: ''
      });
      showNotification('تم إضافة الصنف بنجاح');
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء إضافة الصنف', 'error');
    }
  };

  const handleProductFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type === 'application/pdf') {
        const reader = new FileReader();
        reader.onloadend = () => {
          setProductFormData({ ...productFormData, image_url: reader.result as string });
        };
        reader.readAsDataURL(file);
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        showNotification('الصورة كبيرة جداً، سيتم ضغطها تلقائياً', 'info');
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
          setProductFormData({ ...productFormData, image_url: resizedDataUrl });
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleExpenseCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await dbService.add('expense_categories', {
        ...expenseCategoryFormData,
        company_id: user.company_id
      });
      await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة تصنيف مصروفات', `إضافة تصنيف جديد من فاتورة المشتريات: ${expenseCategoryFormData.name}`, ['expense_categories', 'purchase_invoices']);
      
      setIsExpenseCategoryModalOpen(false);
      setExpenseCategoryFormData({
        code: '',
        name: '',
        description: ''
      });
      showNotification('تم إضافة تصنيف المصروفات بنجاح');
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء إضافة التصنيف', 'error');
    }
  };

  const handlePaymentMethodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const selectedAccount = accounts.find(a => a.id === paymentMethodFormData.account_id);
      const pmId = await dbService.add('payment_methods', {
        ...paymentMethodFormData,
        account_name: selectedAccount?.name || '',
        company_id: user.company_id
      });
      await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة طريقة دفع', `إضافة طريقة دفع جديدة من فاتورة المشتريات: ${paymentMethodFormData.name}`, ['payment_methods', 'purchase_invoices'], pmId);
      
      // Create journal entry for opening balance if not zero
      if (paymentMethodFormData.opening_balance !== 0 && paymentMethodFormData.account_id && paymentMethodFormData.counter_account_id) {
        const absBalance = Math.abs(paymentMethodFormData.opening_balance);
        const isNegative = paymentMethodFormData.opening_balance < 0;
        const counterAccount = accounts.find(a => a.id === paymentMethodFormData.counter_account_id);

        await dbService.add('journal_entries', {
          company_id: user.company_id,
          date: paymentMethodFormData.opening_balance_date,
          description: `رصيد افتتاحي لطريقة الدفع: ${paymentMethodFormData.name}`,
          reference_id: pmId,
          reference_type: 'opening_balance',
          items: [
            {
              account_id: paymentMethodFormData.account_id,
              account_name: selectedAccount?.name || '',
              debit: isNegative ? 0 : absBalance,
              credit: isNegative ? absBalance : 0,
              description: 'رصيد افتتاحي'
            },
            {
              account_id: paymentMethodFormData.counter_account_id,
              account_name: counterAccount?.name || 'حساب الميزانية الافتتاحية',
              debit: isNegative ? absBalance : 0,
              credit: isNegative ? 0 : absBalance,
              description: `رصيد افتتاحي لطريقة الدفع: ${paymentMethodFormData.name}`
            }
          ],
          total_debit: absBalance,
          total_credit: absBalance,
          created_at: new Date().toISOString(),
          created_by: user.id
        });
      }

      setInvoiceData({ ...invoiceData, payment_method_id: pmId });
      setIsPaymentMethodModalOpen(false);
      setPaymentMethodFormData({
        code: '',
        name: '',
        type: 'cash',
        account_id: '',
        opening_balance: 0,
        opening_balance_date: new Date().toISOString().slice(0, 10),
        counter_account_id: '',
        details: ''
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
    
    const validItems = items.filter(item => 
      (invoiceData.purchase_type === 'items' && item.product_id) || 
      (invoiceData.purchase_type === 'expenses' && item.expense_category_id)
    );

    if (validItems.length === 0) {
      showNotification('يرجى إضافة أصناف أو بنود مكتملة للفاتورة', 'error');
      return;
    }

    try {
      const supplier = suppliers.find(s => s.id === invoiceData.supplier_id);
      const paymentMethod = paymentMethods.find(pm => pm.id === invoiceData.payment_method_id);
      
      const subtotal = validItems.reduce((sum, item) => sum + (item.total || 0), 0);
      const total_amount = subtotal - invoiceData.discount;

      const data = {
        ...invoiceData,
        supplier_name: supplier?.name || '',
        payment_method_name: paymentMethod?.name || '',
        subtotal,
        total_amount,
        items: validItems.map(item => ({
          product_id: item.product_id || null,
          expense_category_id: item.expense_category_id || null,
          product_name: item.product_name || '',
          category_name: item.category_name || '',
          quantity: item.quantity,
          price: item.cost_price,
          total: item.total
        })),
        company_id: user.company_id
      };

      let id = editingInvoice?.id;
      const invoice_number = editingInvoice?.invoice_number || invoiceNumber;

      if (editingInvoice) {
        const fieldsToTrack = [
          { field: 'supplier_id', label: 'المورد' },
          { field: 'date', label: 'التاريخ' },
          { field: 'total_amount', label: 'المبلغ الإجمالي' },
          { field: 'payment_type', label: 'نوع الدفع' },
          { field: 'payment_method_id', label: 'طريقة الدفع' },
          { field: 'purchase_type', label: 'نوع المشتريات' }
        ];
        await dbService.updateWithLog(
          'purchase_invoices', 
          editingInvoice.id, 
          { ...data, invoice_number }, 
          { id: user.id, username: user.username, company_id: user.company_id },
          'تعديل فاتورة مشتريات',
          'purchase_invoices',
          fieldsToTrack
        );
      } else {
        id = await dbService.add('purchase_invoices', { ...data, invoice_number });
      }

      // Create/Update Journal Entry
      const journalItems: JournalEntryItem[] = [];

      // ALWAYS Credit: Supplier Account first (for the invoice part)
      let supplierAccountId = supplier?.account_id || '';
      let supplierAccountName = supplier?.account_name || '';
      
      if (!supplierAccountId) {
        const fallbackAccount = accounts.find(a => a.name.includes('موردين'));
        supplierAccountId = fallbackAccount?.id || 'suppliers_account_default';
        supplierAccountName = fallbackAccount?.name || 'حساب الموردين (افتراضي)';
      }

      // Line 1: Cr. Supplier
      journalItems.push({
        account_id: supplierAccountId,
        account_name: supplierAccountName,
        debit: 0,
        credit: total_amount,
        description: `فاتورة مشتريات رقم ${invoice_number} - ${supplier?.name}`,
        supplier_id: invoiceData.supplier_id,
        supplier_name: supplier?.name
      });

        // Line 1.5: Cr. Discount Account (if any)
        if (invoiceData.discount > 0) {
          const discountAccount = accounts.find(a => a.id === settings?.supplier_discount_account_id) || 
                                  accounts.find(a => a.name.includes('خصم مكتسب') || a.name.includes('خصم مشتريات'));
          journalItems.push({
            account_id: discountAccount?.id || 'purchase_discount_default',
            account_name: discountAccount?.name || 'حساب الخصم المكتسب (افتراضي)',
            debit: 0,
            credit: invoiceData.discount,
            description: `خصم مكتسب - فاتورة رقم ${invoice_number}`
          });
        }

        // Line 2: Dr. Purchase/Expense Accounts
        (items || []).forEach(item => {
          let debitAccountId = '';
          let debitAccountName = '';

          if (invoiceData.purchase_type === 'items') {
            const product = products.find(p => p.id === item.product_id);
            debitAccountId = product?.cost_account_id || '';
            debitAccountName = product?.cost_account_name || '';
            
            if (!debitAccountId) {
              // Fallback: Try to find a purchase/cost account
              const fallbackAccount = accounts.find(a => 
                a.name.includes('مشتريات') || a.name.includes('تكلفة')
              );
              debitAccountId = fallbackAccount?.id || 'purchase_account_default';
              debitAccountName = fallbackAccount?.name || 'حساب المشتريات (افتراضي)';
            }
          } else {
            const category = categories.find(c => c.id === item.expense_category_id);
            debitAccountId = (category as any)?.account_id || '';
            debitAccountName = (category as any)?.account_name || '';
            
            if (!debitAccountId) {
              // Fallback: Try to find a matching expense account or general expense account
              const fallbackAccount = accounts.find(a => 
                (category && a.name.includes(category.name)) || a.name.includes('مصروفات')
              );
              debitAccountId = fallbackAccount?.id || 'expense_account_default';
              debitAccountName = fallbackAccount?.name || 'حساب المصروفات (افتراضي)';
            }
          }

          journalItems.push({
            account_id: debitAccountId,
            account_name: debitAccountName,
            debit: item.total,
            credit: 0,
            description: `مشتريات: ${item.product_name || item.category_name} - فاتورة ${invoice_number}`
          });
        });

        // If Cash, add the payment lines (Cr. Cash / Dr. Supplier)
        if (invoiceData.payment_type === 'cash') {
          const pm = paymentMethods.find(p => p.id === invoiceData.payment_method_id);
          let cashAccountId = pm?.account_id || '';
          let cashAccountName = pm?.account_name || '';
          
          if (!cashAccountId) {
            // Fallback: Try to find a cash/treasury account
            const fallbackAccount = accounts.find(a => 
              a.name.includes('نقدية') || a.name.includes('خزينة') || a.name.includes('صندوق')
            );
            cashAccountId = fallbackAccount?.id || 'cash_account_default';
            cashAccountName = fallbackAccount?.name || 'حساب النقدية (افتراضي)';
          }

          // Line 3: Cr. Cash/Bank
          journalItems.push({
            account_id: cashAccountId,
            account_name: cashAccountName,
            debit: 0,
            credit: total_amount,
            description: `سداد فاتورة مشتريات رقم ${invoice_number} - ${supplier?.name}`
          });

          // Line 4: Dr. Supplier
          journalItems.push({
            account_id: supplierAccountId,
            account_name: supplierAccountName,
            debit: total_amount,
            credit: 0,
            description: `تسوية فاتورة مشتريات رقم ${invoice_number} - ${supplier?.name}`,
            supplier_id: invoiceData.supplier_id,
            supplier_name: supplier?.name
          });
        }

        if (journalItems.length > 0 && id) {
          const journalEntry: Omit<JournalEntry, 'id'> = {
            date: invoiceData.date,
            reference_number: invoice_number,
            reference_id: id,
            reference_type: 'purchase_invoice',
            description: `قيد فاتورة مشتريات رقم ${invoice_number}`,
            items: journalItems,
            total_debit: journalItems.reduce((sum, item) => sum + item.debit, 0),
            total_credit: journalItems.reduce((sum, item) => sum + item.credit, 0),
            company_id: user.company_id,
            created_at: new Date().toISOString(),
            created_by: user.id
          };
          
          const existingEntry = await dbService.getJournalEntryByReference(id, user.company_id);
          if (existingEntry) {
            await dbService.updateJournalEntry(existingEntry.id, journalEntry);
          } else {
            await dbService.createJournalEntry(journalEntry);
          }
        }

        if (!editingInvoice && id) {
          await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة فاتورة مشتريات', `إضافة فاتورة مشتريات جديدة رقم: ${invoice_number}`, 'purchase_invoices', id);
        }

      showNotification(editingInvoice ? 'تم تعديل فاتورة المشتريات بنجاح' : 'تم حفظ فاتورة المشتريات بنجاح');
      closeModal();
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء الاتصال بالخادم', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    setInvoiceToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!invoiceToDelete || !user) return;
    try {
      const invoice = purchaseInvoices.find(i => i.id === invoiceToDelete);
      
      // Delete associated journal entry
      await dbService.deleteJournalEntryByReference(invoiceToDelete, user.company_id);
      
      await dbService.delete('purchase_invoices', invoiceToDelete);
      await dbService.logActivity(user.id, user.username, user.company_id, 'حذف فاتورة مشتريات', `حذف فاتورة مشتريات رقم: ${invoice?.invoice_number}`, 'purchase_invoices', invoiceToDelete);
      setIsDeleteModalOpen(false);
      setInvoiceToDelete(null);
    } catch (e) {
      console.error(e);
    }
  };

  const openModal = (invoice?: any) => {
    if (invoice) {
      setEditingInvoice(invoice);
      setInvoiceData({
        supplier_id: invoice.supplier_id.toString(),
        date: invoice.date,
        payment_type: invoice.payment_type || 'cash',
        payment_method_id: invoice.payment_method_id?.toString() || '',
        notes: invoice.notes || '',
        discount: invoice.discount || 0,
        purchase_type: invoice.items?.[0]?.product_id ? 'items' : 'expenses'
      });
      setItems(invoice.items.map((item: any) => ({
        product_id: item.product_id?.toString(),
        expense_category_id: item.expense_category_id?.toString(),
        product_name: item.product_name,
        category_name: item.category_name,
        quantity: item.quantity,
        cost_price: item.price,
        total: item.total
      })));
      setInvoiceNumber(invoice.invoice_number);
    } else {
      setEditingInvoice(null);
      setInvoiceData({
        supplier_id: '',
        date: new Date().toISOString().slice(0, 10),
        payment_type: 'cash',
        payment_method_id: '',
        notes: '',
        discount: 0,
        purchase_type: 'items'
      });
      setItems([]);
      setInvoiceNumber(generateInvoiceNumber(new Date().toISOString().slice(0, 10)));
    }
    setIsModalOpen(true);
  };

  const handleNextInvoice = () => {
    if (!editingInvoice) return;
    const currentIndex = purchaseInvoices.findIndex(inv => inv.id === editingInvoice.id);
    if (currentIndex > 0) {
      openModal(purchaseInvoices[currentIndex - 1]);
    }
  };

  const handleBackInvoice = () => {
    if (!editingInvoice) return;
    const currentIndex = purchaseInvoices.findIndex(inv => inv.id === editingInvoice.id);
    if (currentIndex < purchaseInvoices.length - 1) {
      openModal(purchaseInvoices[currentIndex + 1]);
    }
  };

  const handleExportExcel = () => {
    const formattedData = formatDataForExcel(purchaseInvoices, {
      'invoice_number': 'رقم الفاتورة',
      'supplier_name': 'المورد',
      'date': 'التاريخ',
      'total_amount': 'المبلغ الإجمالي',
      'purchase_type': 'نوع المشتريات'
    });
    exportToExcel(formattedData, { filename: 'Purchase_Invoices_Report', sheetName: 'مشتريات' });
  };

  const handleExportPDF = async () => {
    if (tableRef.current) {
      await exportToPDFUtil(tableRef.current, { 
        filename: 'Purchase_Invoices_Report', 
        orientation: 'landscape',
        reportTitle: 'قائمة فواتير المشتريات'
      });
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingInvoice(null);
    setInvoiceData({
      supplier_id: '',
      date: new Date().toISOString().slice(0, 10),
      payment_type: 'cash',
      payment_method_id: '',
      notes: '',
      discount: 0,
      purchase_type: 'items'
    });
    setItems([]);
  };

  const filteredInvoices = purchaseInvoices.filter(i => 
    i.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">فواتير المشتريات</h2>
          <p className="text-zinc-500">إدارة مشترياتك من الموردين.</p>
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
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-2xl font-bold hover:bg-orange-700 transition-all active:scale-95 shadow-lg shadow-orange-200"
          >
            <Plus size={20} />
            مشتريات جديدة
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-50 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 text-zinc-400" size={18} />
            <input
              type="text"
              placeholder="البحث عن فواتير..."
              className="w-full pl-10 pr-4 py-2 bg-zinc-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div ref={tableRef} id="purchase-invoices-list-table" className="overflow-x-auto hidden md:block">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-zinc-50/50 text-zinc-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-bold">رقم الفاتورة</th>
                <th className="px-6 py-4 font-bold">المورد</th>
                <th className="px-6 py-4 font-bold">التاريخ</th>
                <th className="px-6 py-4 font-bold">المبلغ</th>
                <th className="px-6 py-4 font-bold text-left">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-400 italic">لا توجد فواتير مشتريات حالياً</td>
                </tr>
              ) : filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-zinc-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs bg-emerald-50 px-2 py-1 rounded text-emerald-700 font-bold">{inv.invoice_number}</span>
                  </td>
                  <td className="px-6 py-4 font-bold text-zinc-900">{inv.supplier_name}</td>
                  <td className="px-6 py-4 text-zinc-500">{inv.date}</td>
                  <td className="px-6 py-4 font-bold text-zinc-900">{inv.total_amount.toLocaleString()} ج.م</td>
                  <td className="px-6 py-4 text-left">
                    <div className="flex items-center justify-start gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => setViewInvoice(inv)}
                        className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 rounded-xl transition-all no-pdf"
                      >
                        <Eye size={18} />
                      </button>
                      <button 
                        onClick={() => openModal(inv)}
                        className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all no-pdf"
                      >
                        <Pencil size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(inv.id)}
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

        {/* Mobile List View */}
        <div className="md:hidden divide-y divide-zinc-50">
          {filteredInvoices.map((inv) => (
            <div key={inv.id} className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[10px] bg-emerald-50 px-2 py-1 rounded text-emerald-700 font-bold w-fit">{inv.invoice_number}</span>
                  <h4 className="font-bold text-zinc-900 text-lg">{inv.supplier_name}</h4>
                </div>
                <div className="text-left">
                  <p className="font-bold text-emerald-600 text-lg">{inv.total_amount.toLocaleString()} ج.م</p>
                  <span className="text-xs text-zinc-400">{inv.date}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button 
                  onClick={() => setViewInvoice(inv)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-zinc-50 text-zinc-600 rounded-2xl text-sm font-bold border border-zinc-100 active:scale-95 transition-transform"
                >
                  <Eye size={18} /> عرض
                </button>
                <button 
                  onClick={() => openModal(inv)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-50 text-blue-600 rounded-2xl text-sm font-bold border border-blue-100 active:scale-95 transition-transform"
                >
                  <Pencil size={18} /> تعديل
                </button>
                <button 
                  onClick={() => handleDelete(inv.id)}
                  className="p-3 bg-red-50 text-red-600 rounded-2xl border border-red-100 active:scale-95 transition-transform"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
          {filteredInvoices.length === 0 && !loading && (
            <div className="p-8 text-center text-zinc-500 italic">لا توجد فواتير مشتريات حالياً</div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm`}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${isFullScreen ? 'w-full h-full rounded-none' : 'w-full max-w-6xl max-h-[90vh]'}`}
          >
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-100 text-orange-600 rounded-2xl">
                  <ShoppingCart size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-zinc-900">{editingInvoice ? 'تعديل فاتورة مشتريات' : 'إضافة فاتورة مشتريات'}</h3>
                  <p className="text-sm text-zinc-500">أدخل تفاصيل الفاتورة والأصناف.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {editingInvoice && (
                  <div className="flex items-center gap-1 mr-4">
                    <button
                      onClick={handleBackInvoice}
                      disabled={purchaseInvoices.findIndex(inv => inv.id === editingInvoice.id) === purchaseInvoices.length - 1}
                      className="p-2 hover:bg-zinc-200 rounded-xl transition-all disabled:opacity-30"
                      title="السابق"
                    >
                      <ArrowRight size={20} />
                    </button>
                    <button
                      onClick={handleNextInvoice}
                      disabled={purchaseInvoices.findIndex(inv => inv.id === editingInvoice.id) === 0}
                      className="p-2 hover:bg-zinc-200 rounded-xl transition-all disabled:opacity-30"
                      title="التالي"
                    >
                      <ArrowLeft size={20} />
                    </button>
                  </div>
                )}
                <button 
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="p-2 hover:bg-zinc-200 rounded-xl transition-all text-zinc-500"
                  title={isFullScreen ? "تصغير" : "تكبير"}
                >
                  {isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                </button>
                <button onClick={closeModal} className="p-2 hover:bg-zinc-200 rounded-xl transition-all text-zinc-500">
                  <X size={24} />
                </button>
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
                          documentId={editingInvoice?.id || ''} 
                          category="purchase_invoices" 
                          previewJournalEntry={previewJournalEntry}
                          previewActivityLog={previewActivityLog}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 pb-32 md:pb-8">
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-1">
                  <SmartAIInput transactionType="purchase_invoice" onDataExtracted={applyAiData} />
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Form Content */}
                    <div className="space-y-6">
                      <div className="flex justify-center gap-4 mb-6">
                        <button 
                          type="button"
                          onClick={() => {
                            setInvoiceData({...invoiceData, purchase_type: 'items'});
                            setItems([]);
                          }}
                          className={`flex-1 py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${invoiceData.purchase_type === 'items' ? 'bg-zinc-900 text-white shadow-xl scale-105' : 'bg-zinc-50 text-zinc-500 border border-zinc-200 hover:bg-zinc-100'}`}
                        >
                          <Package size={20} />
                          شراء أصناف
                        </button>
                        <button 
                          type="button"
                          onClick={() => {
                            setInvoiceData({...invoiceData, purchase_type: 'expenses'});
                            setItems([]);
                          }}
                          className={`flex-1 py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${invoiceData.purchase_type === 'expenses' ? 'bg-zinc-900 text-white shadow-xl scale-105' : 'bg-zinc-50 text-zinc-500 border border-zinc-200 hover:bg-zinc-100'}`}
                        >
                          <FileText size={20} />
                          شراء بنود مصروفات
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div>
                          <label className="block text-sm font-bold text-zinc-700 mb-2 uppercase tracking-tighter">المورد</label>
                          <div className="relative">
                            <User className="absolute left-3 top-3 text-zinc-400" size={18} />
                            <select 
                              required
                              className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none"
                              value={invoiceData.supplier_id}
                              onChange={(e) => {
                                if (e.target.value === 'new_supplier') {
                                  setIsSupplierModalOpen(true);
                                } else {
                                  setInvoiceData({...invoiceData, supplier_id: e.target.value});
                                }
                              }}
                            >
                              <option value="">اختر المورد...</option>
                              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                              <option value="new_supplier" className="font-bold text-emerald-600">+ إضافة مورد جديد</option>
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
                              value={invoiceData.date}
                              onChange={(e) => setInvoiceData({...invoiceData, date: e.target.value})}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-zinc-700 mb-2 uppercase tracking-tighter">نوع الدفع</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button 
                              type="button"
                              onClick={() => setInvoiceData({...invoiceData, payment_type: 'cash'})}
                              className={`py-3 rounded-xl font-bold transition-all ${invoiceData.payment_type === 'cash' ? 'bg-zinc-900 text-white shadow-lg' : 'bg-zinc-50 text-zinc-500 border border-zinc-200 hover:bg-zinc-100'}`}
                            >
                              نقدي
                            </button>
                            <button 
                              type="button"
                              onClick={() => setInvoiceData({...invoiceData, payment_type: 'credit'})}
                              className={`py-3 rounded-xl font-bold transition-all ${invoiceData.payment_type === 'credit' ? 'bg-zinc-900 text-white shadow-lg' : 'bg-zinc-50 text-zinc-500 border border-zinc-200 hover:bg-zinc-100'}`}
                            >
                              آجل
                            </button>
                          </div>
                        </div>

                        {invoiceData.payment_type === 'cash' && (
                          <div>
                            <label className="block text-sm font-bold text-zinc-700 mb-2 uppercase tracking-tighter">طريقة السداد</label>
                            <div className="relative">
                              <CreditCard className="absolute left-3 top-3 text-zinc-400" size={18} />
                              <select 
                                required
                                className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none"
                                value={invoiceData.payment_method_id}
                                onChange={(e) => {
                                  if (e.target.value === 'new_payment_method') {
                                    setIsPaymentMethodModalOpen(true);
                                  } else {
                                    setInvoiceData({...invoiceData, payment_method_id: e.target.value});
                                  }
                                }}
                              >
                                <option value="">اختر الطريقة...</option>
                                {paymentMethods.map(pm => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
                                <option value="new_payment_method" className="font-bold text-emerald-600">+ إضافة طريقة دفع جديدة</option>
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
                          placeholder="أي ملاحظات إضافية على الفاتورة..."
                          value={invoiceData.notes}
                          onChange={(e) => setInvoiceData({...invoiceData, notes: e.target.value})}
                        />
                      </div>

                      <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-zinc-50 flex items-center justify-between bg-zinc-50/50">
                          <div className="flex items-center gap-4">
                            <h3 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
                              {invoiceData.purchase_type === 'items' ? <Package size={24} className="text-emerald-500" /> : <FileText size={24} className="text-emerald-500" />}
                              {invoiceData.purchase_type === 'items' ? 'أصناف الفاتورة' : 'بنود المصروفات'}
                            </h3>
                            <button 
                              type="button"
                              onClick={() => setShowSidePanel(!showSidePanel)}
                              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${showSidePanel ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-zinc-100 text-zinc-600 border border-zinc-200 hover:bg-zinc-200'}`}
                            >
                              <History size={14} />
                              قيد اليومية \ سجل التعديلات
                            </button>
                          </div>
                          <button 
                            type="button"
                            onClick={addItem}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all active:scale-95"
                          >
                            <Plus size={18} />
                            إضافة {invoiceData.purchase_type === 'items' ? 'صنف' : 'بند'}
                          </button>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-right border-collapse">
                            <thead>
                              <tr className="bg-zinc-50/30 border-b border-zinc-100">
                                <th className="px-3 py-2 text-xs font-bold text-zinc-500 uppercase tracking-tighter w-12 text-center">صورة</th>
                                <th className="px-3 py-2 text-xs font-bold text-zinc-500 uppercase tracking-tighter">{invoiceData.purchase_type === 'items' ? 'الصنف' : 'البند'}</th>
                                <th className="px-3 py-2 text-xs font-bold text-zinc-500 uppercase tracking-tighter w-24 text-center">الكمية</th>
                                <th className="px-3 py-2 text-xs font-bold text-zinc-500 uppercase tracking-tighter w-32 text-center">السعر</th>
                                <th className="px-3 py-2 text-xs font-bold text-zinc-500 uppercase tracking-tighter w-32 text-center">الإجمالي</th>
                                <th className="px-3 py-2 text-xs font-bold text-zinc-500 uppercase tracking-tighter w-12"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-50">
                              {items.length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-400 italic">لا توجد {invoiceData.purchase_type === 'items' ? 'أصناف' : 'بنود'} مضافة حالياً</td>
                                </tr>
                              ) : items.map((item, index) => (
                                <tr key={index} className="hover:bg-zinc-50/50 transition-colors group">
                                  <td className="px-3 py-1.5 text-center">
                                    {invoiceData.purchase_type === 'items' && (item as any).product_image_url ? (
                                      <img 
                                        src={(item as any).product_image_url} 
                                        alt="Product" 
                                        className="w-8 h-8 object-cover rounded-lg mx-auto border border-zinc-100"
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : (
                                      <div className="w-8 h-8 bg-zinc-50 rounded-lg flex items-center justify-center mx-auto border border-zinc-100">
                                        <Box size={14} className="text-zinc-300" />
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3 py-1.5">
                                    {invoiceData.purchase_type === 'items' ? (
                                      <select 
                                        required
                                        className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                        value={item.product_id || ''}
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
                                    ) : (
                                      <select 
                                        required
                                        className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                        value={item.expense_category_id || ''}
                                        onChange={(e) => {
                                          if (e.target.value === 'new_expense_category') {
                                            setIsExpenseCategoryModalOpen(true);
                                          } else {
                                            updateItem(index, 'expense_category_id', e.target.value);
                                          }
                                        }}
                                      >
                                        <option value="">اختر البند...</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                                        <option value="new_expense_category" className="font-bold text-emerald-600">+ إضافة بند مصروف جديد</option>
                                      </select>
                                    )}
                                  </td>
                                  <td className="px-3 py-1.5">
                                    <input 
                                      required
                                      type="number" 
                                      min="1"
                                      className="w-full px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-center text-sm font-mono"
                                      value={item.quantity}
                                      onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                                    />
                                  </td>
                                  <td className="px-3 py-1.5">
                                    <input 
                                      required
                                      type="number" 
                                      min="0"
                                      step="any"
                                      className="w-full px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-center text-sm font-mono"
                                      value={item.cost_price}
                                      onChange={(e) => updateItem(index, 'cost_price', Number(e.target.value))}
                                    />
                                  </td>
                                  <td className="px-3 py-1.5 font-bold text-zinc-900 text-sm font-mono text-center">
                                    {(item.total || 0).toLocaleString()}
                                  </td>
                                  <td className="px-3 py-1.5">
                                    <button 
                                      type="button"
                                      onClick={() => removeItem(index)}
                                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="bg-zinc-50/50 font-bold border-t border-zinc-100">
                                <td colSpan={3} className="px-3 py-2 text-left text-zinc-500">الإجمالي الفرعي:</td>
                                <td className="px-3 py-2 text-base text-zinc-900 font-mono text-center">{calculateSubtotal().toLocaleString()}</td>
                                <td></td>
                              </tr>
                              <tr className="bg-zinc-50/50 font-bold">
                                <td colSpan={3} className="px-3 py-2 text-left text-zinc-500 flex items-center gap-2">
                                  <span>الخصم:</span>
                                  <input 
                                    type="number" 
                                    className="w-24 bg-white border border-zinc-200 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-orange-500 font-mono"
                                    value={invoiceData.discount}
                                    onChange={(e) => setInvoiceData({ ...invoiceData, discount: parseFloat(e.target.value) || 0 })}
                                  />
                                </td>
                                <td className="px-3 py-2 text-base text-red-600 font-mono text-center">-{invoiceData.discount.toLocaleString()}</td>
                                <td></td>
                              </tr>
                              <tr className="bg-zinc-900 text-white">
                                <td colSpan={3} className="px-6 py-4 text-left font-bold text-lg">الإجمالي الكلي:</td>
                                <td colSpan={2} className="px-6 py-4 font-bold text-2xl text-emerald-400">
                                  {calculateTotal().toLocaleString()} ج.م
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-6 border-t border-zinc-100">
                      <button 
                        type="submit"
                        className="flex items-center gap-3 px-12 py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20 active:scale-95"
                      >
                        <Save size={24} />
                        {editingInvoice ? 'تحديث فاتورة المشتريات' : 'حفظ فاتورة المشتريات'}
                      </button>
                    </div>
                  </form>
                </div>

                {editingInvoice && (
                  <div className="hidden lg:block">
                    <DocumentChatter documentId={editingInvoice.id} collectionName="purchase_invoices" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    )}

      {/* View Modal */}
      {viewInvoice && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center md:p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full h-full md:h-auto md:max-w-5xl md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col md:max-h-[90vh]">
            <div className="p-4 md:p-6 border-b border-zinc-50 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg font-bold text-zinc-900">عرض فاتورة المشتريات</h3>
              <button onClick={() => setViewInvoice(null)} className="p-2 text-zinc-400 hover:text-zinc-600"><X size={24} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row h-full">
              {/* Side Panel for Activity Log and Journal Entry */}
              <TransactionSidePanel 
                documentId={viewInvoice.id} 
                category="purchase_invoices" 
              />

              <div ref={invoiceRef} id="purchase-invoice-capture-area" className="flex-1 p-6 md:p-8 space-y-8 bg-white overflow-y-auto" style={{ color: '#18181b' }}>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-2xl md:text-3xl font-bold text-[#18181b] italic serif">فاتورة مشتريات</h3>
                    <p className="text-[#71717a] font-mono text-sm md:text-base">{viewInvoice.invoice_number}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <p className="text-xs font-bold text-[#a1a1aa] uppercase tracking-widest mb-1">فاتورة من</p>
                    <p className="text-xl font-bold text-[#18181b]">{viewInvoice.supplier_name}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-[#a1a1aa] uppercase tracking-widest mb-1">التاريخ</p>
                    <p className="text-lg font-medium text-[#18181b]">{viewInvoice.date}</p>
                  </div>
                </div>

                <div className="border border-[#f4f4f5] rounded-2xl overflow-hidden">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-[#fafafa] text-[#71717a] uppercase text-[10px] font-bold tracking-widest">
                      <tr>
                        <th className="px-4 py-3 w-16 text-center">صورة</th>
                        <th className="px-4 py-3">الصنف / التصنيف</th>
                        <th className="px-4 py-3 w-24">الكمية</th>
                        <th className="px-4 py-3 w-32">السعر</th>
                        <th className="px-4 py-3 w-32">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f4f4f5]">
                      {viewInvoice.items.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td className="px-4 py-3 text-center">
                            {viewInvoice.purchase_type === 'items' && item.product_image_url ? (
                              <img 
                                src={item.product_image_url} 
                                alt="Product" 
                                className="w-10 h-10 object-cover rounded-lg mx-auto border border-[#f4f4f5]"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-[#fafafa] rounded-lg flex items-center justify-center mx-auto border border-[#f4f4f5]">
                                <Box size={16} className="text-[#a1a1aa]" />
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium text-[#18181b]">{item.product_name || item.category_name}</td>
                          <td className="px-4 py-3 text-[#71717a]">{item.quantity}</td>
                          <td className="px-4 py-3 text-[#71717a]">{item.price?.toLocaleString() || item.cost_price?.toLocaleString()} ج.م</td>
                          <td className="px-4 py-3 font-bold text-[#18181b]">{item.total.toLocaleString()} ج.م</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-[#fafafa] font-bold">
                      <tr>
                        <td colSpan={3} className="px-4 py-2 text-left text-[#71717a]">الإجمالي الفرعي:</td>
                        <td className="px-4 py-2 text-[#18181b]">{viewInvoice.subtotal?.toLocaleString() || viewInvoice.total_amount?.toLocaleString()} ج.م</td>
                      </tr>
                      {viewInvoice.discount > 0 && (
                        <tr>
                          <td colSpan={3} className="px-4 py-2 text-left text-[#71717a]">الخصم:</td>
                          <td className="px-4 py-2 text-red-600">-{viewInvoice.discount.toLocaleString()} ج.م</td>
                        </tr>
                      )}
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-left text-[#71717a]">الإجمالي الكلي:</td>
                        <td className="px-4 py-6 text-3xl text-[#f97316]">{viewInvoice.total_amount.toLocaleString()} ج.م</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="flex gap-4" data-html2canvas-ignore>
                  <button 
                    onClick={() => {
                      setActivityLogDocumentId(viewInvoice.id);
                      setIsActivityLogOpen(true);
                    }}
                    className="flex-1 py-4 bg-emerald-50 text-emerald-600 rounded-2xl font-bold hover:bg-emerald-100 transition-all flex items-center justify-center gap-2 border border-emerald-100"
                  >
                    <History size={20} />
                    سجل النشاط
                  </button>
                  <button 
                    onClick={() => exportToPDF(viewInvoice)}
                    className="flex-1 py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all flex items-center justify-center gap-2"
                  >
                    <Download size={20} />
                    تحميل PDF
                  </button>
                  <button 
                    onClick={() => setViewInvoice(null)}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
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
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">رقم الهاتف</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <input
                        type="text"
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={supplierFormData.mobile}
                        onChange={(e) => setSupplierFormData({ ...supplierFormData, mobile: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">البريد الإلكتروني</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 text-zinc-400" size={18} />
                    <input
                      type="email"
                      className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={supplierFormData.email}
                      onChange={(e) => setSupplierFormData({ ...supplierFormData, email: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">العنوان</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 text-zinc-400" size={18} />
                    <textarea
                      className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      rows={2}
                      value={supplierFormData.address}
                      onChange={(e) => setSupplierFormData({ ...supplierFormData, address: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">رصيد أول المدة</label>
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
                  <div className="space-y-1">
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
          <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-4xl md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-4 md:p-6 border-b border-zinc-50 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg md:text-xl font-bold text-zinc-900">إضافة صنف جديد</h3>
              <button onClick={() => setIsProductModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 p-2 hover:bg-zinc-100 rounded-xl transition-all"><X size={24} /></button>
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              <form onSubmit={handleProductSubmit} className="p-4 md:p-8 space-y-5 flex-1 overflow-y-auto pb-32 md:pb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">كود الصنف</label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <input
                        required
                        type="text"
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-mono"
                        value={productFormData.code}
                        onChange={(e) => setProductFormData({ ...productFormData, code: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">اسم الصنف</label>
                    <div className="relative">
                      <Package className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <input
                        required
                        type="text"
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={productFormData.name}
                        onChange={(e) => setProductFormData({ ...productFormData, name: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">نوع الصنف</label>
                  <div className="relative">
                    <Layers className="absolute left-3 top-3 text-zinc-400" size={18} />
                    <select
                      required
                      className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none"
                      value={productFormData.type}
                      onChange={(e) => setProductFormData({ ...productFormData, type: e.target.value as any })}
                    >
                      <option value="product">منتج</option>
                      <option value="service">خدمة</option>
                      <option value="commodity">سلعة</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">سعر البيع</label>
                    <div className="relative">
                      <Tag className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <input
                        required
                        type="number"
                        step="0.01"
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={productFormData.sale_price}
                        onChange={(e) => setProductFormData({ ...productFormData, sale_price: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">سعر التكلفة</label>
                    <div className="relative">
                      <Tag className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <input
                        required
                        type="number"
                        step="0.01"
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={productFormData.cost_price}
                        onChange={(e) => setProductFormData({ ...productFormData, cost_price: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">الوصف</label>
                  <textarea
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    rows={2}
                    value={productFormData.description}
                    onChange={(e) => setProductFormData({ ...productFormData, description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">المرفق (صورة أو PDF)</label>
                    <div className="relative group">
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleProductFileChange}
                        className="hidden"
                        id="purchase-product-attachment"
                      />
                      <label 
                        htmlFor="purchase-product-attachment"
                        className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-zinc-50 border border-zinc-200 border-dashed rounded-xl cursor-pointer hover:bg-zinc-100 hover:border-emerald-500 transition-all"
                      >
                        <Paperclip size={18} className="text-zinc-400 group-hover:text-emerald-500" />
                        <span className="text-sm text-zinc-500 group-hover:text-emerald-900 font-bold">
                          {productFormData.image_url ? 'تغيير المرفق' : 'اختر ملفاً...'}
                        </span>
                      </label>
                    </div>
                    {productFormData.image_url && (
                      <div className="mt-2 relative flex justify-center bg-white p-2 rounded-lg border border-zinc-100 overflow-hidden">
                        <button 
                          type="button"
                          onClick={() => setProductFormData({ ...productFormData, image_url: '' })}
                          className="absolute top-1 right-1 text-red-500 hover:bg-red-50 p-1 rounded-full bg-white/80 backdrop-blur-sm shadow-sm z-10"
                        >
                          <X size={14} />
                        </button>
                        {productFormData.image_url.startsWith('data:application/pdf') ? (
                          <div className="flex flex-col items-center gap-1">
                            <FileText size={24} className="text-red-500" />
                            <span className="text-[10px] font-bold text-zinc-500">PDF</span>
                          </div>
                        ) : (
                          <img 
                            src={productFormData.image_url} 
                            alt="Preview" 
                            className="h-10 w-auto rounded object-contain"
                            referrerPolicy="no-referrer"
                          />
                        )}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">الباركود (اختياري)</label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <input
                        type="text"
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={productFormData.barcode}
                        onChange={(e) => setProductFormData({ ...productFormData, barcode: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">حساب الإيرادات</label>
                    <select
                      required
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={productFormData.revenue_account_id}
                      onChange={(e) => setProductFormData({ ...productFormData, revenue_account_id: e.target.value })}
                    >
                      <option value="">اختر الحساب...</option>
                      {accounts.map(account => (
                        <option key={account.id} value={account.id}>
                          {account.code} - {account.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">حساب التكلفة</label>
                    <select
                      required
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={productFormData.cost_account_id}
                      onChange={(e) => setProductFormData({ ...productFormData, cost_account_id: e.target.value })}
                    >
                      <option value="">اختر الحساب...</option>
                      {accounts.map(account => (
                        <option key={account.id} value={account.id}>
                          {account.code} - {account.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                  >
                    حفظ الصنف
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsProductModalOpen(false)}
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

      {/* Add Expense Category Modal */}
      {isExpenseCategoryModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-4xl md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-4 md:p-6 border-b border-zinc-50 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg md:text-xl font-bold text-zinc-900">إضافة تصنيف مصروفات جديد</h3>
              <button onClick={() => setIsExpenseCategoryModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 p-2 hover:bg-zinc-100 rounded-xl transition-all"><X size={24} /></button>
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              <form onSubmit={handleExpenseCategorySubmit} className="p-4 md:p-8 space-y-5 flex-1 overflow-y-auto pb-32 md:pb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">كود التصنيف</label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <input
                        required
                        type="text"
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-mono"
                        value={expenseCategoryFormData.code}
                        onChange={(e) => setExpenseCategoryFormData({ ...expenseCategoryFormData, code: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">اسم التصنيف</label>
                    <div className="relative">
                      <Layers className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <input
                        required
                        type="text"
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={expenseCategoryFormData.name}
                        onChange={(e) => setExpenseCategoryFormData({ ...expenseCategoryFormData, name: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">الوصف</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 text-zinc-400" size={18} />
                    <textarea
                      className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      rows={3}
                      value={expenseCategoryFormData.description}
                      onChange={(e) => setExpenseCategoryFormData({ ...expenseCategoryFormData, description: e.target.value })}
                    />
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                  >
                    حفظ التصنيف
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsExpenseCategoryModalOpen(false)}
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

      {/* Add Payment Method Modal */}
      {isPaymentMethodModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-6xl md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-4 md:p-6 border-b border-zinc-50 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg md:text-xl font-bold text-zinc-900">إضافة طريقة دفع جديدة</h3>
              <button onClick={() => setIsPaymentMethodModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 p-2 hover:bg-zinc-100 rounded-xl transition-all"><X size={24} /></button>
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              <form onSubmit={handlePaymentMethodSubmit} className="p-4 md:p-8 space-y-5 flex-1 overflow-y-auto pb-32 md:pb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">كود الطريقة</label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <input
                        required
                        type="text"
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={paymentMethodFormData.code}
                        onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, code: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">اسم الطريقة</label>
                    <div className="relative">
                      <Wallet className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <input
                        required
                        type="text"
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={paymentMethodFormData.name}
                        onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, name: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">النوع</label>
                    <div className="relative">
                      <Layers className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <select
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none"
                        value={paymentMethodFormData.type}
                        onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, type: e.target.value as any })}
                      >
                        <option value="cash">نقدي (خزينة)</option>
                        <option value="bank">بنكي</option>
                        <option value="wallet">محفظة إلكترونية</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">الحساب المحاسبي</label>
                    <select
                      required
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={paymentMethodFormData.account_id}
                      onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, account_id: e.target.value })}
                    >
                      <option value="">اختر الحساب...</option>
                      {accounts.map(account => (
                        <option key={account.id} value={account.id}>
                          {account.code} - {account.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">الرصيد الافتتاحي</label>
                    <div className="relative">
                      <Wallet className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <input 
                        type="number" 
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={paymentMethodFormData.opening_balance}
                        onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, opening_balance: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">تاريخ الرصيد</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <input 
                        type="date" 
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={paymentMethodFormData.opening_balance_date}
                        onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, opening_balance_date: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {paymentMethodFormData.opening_balance !== 0 && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">حساب الطرف الآخر (للرصيد الافتتاحي)</label>
                      <select
                        required
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all border-emerald-200 bg-emerald-50/30"
                        value={paymentMethodFormData.counter_account_id}
                        onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, counter_account_id: e.target.value })}
                      >
                        <option value="">اختر حساب الطرف الآخر...</option>
                        {accounts.map(account => (
                          <option key={account.id} value={account.id}>
                            {account.code} - {account.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {paymentMethodFormData.counter_account_id && paymentMethodFormData.account_id && (
                      <JournalEntryPreview 
                        title="معاينة قيد الرصيد الافتتاحي"
                        items={[
                          {
                            account_name: accounts.find(a => a.id === paymentMethodFormData.account_id)?.name || 'حساب طريقة الدفع',
                            debit: paymentMethodFormData.opening_balance > 0 ? paymentMethodFormData.opening_balance : 0,
                            credit: paymentMethodFormData.opening_balance < 0 ? Math.abs(paymentMethodFormData.opening_balance) : 0,
                            description: 'رصيد افتتاحي'
                          },
                          {
                            account_name: accounts.find(a => a.id === paymentMethodFormData.counter_account_id)?.name || 'حساب الطرف الآخر',
                            debit: paymentMethodFormData.opening_balance < 0 ? Math.abs(paymentMethodFormData.opening_balance) : 0,
                            credit: paymentMethodFormData.opening_balance > 0 ? paymentMethodFormData.opening_balance : 0,
                            description: `رصيد افتتاحي لطريقة الدفع: ${paymentMethodFormData.name}`
                          }
                        ]}
                      />
                    )}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">تفاصيل إضافية</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 text-zinc-400" size={18} />
                    <textarea
                      className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      rows={3}
                      value={paymentMethodFormData.details}
                      onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, details: e.target.value })}
                    />
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                  >
                    حفظ الطريقة
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsPaymentMethodModalOpen(false)}
                    className="px-8 py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all active:scale-95"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
              <div className="hidden md:block w-80 border-r border-zinc-100 bg-zinc-50/30">
                <InlineActivityLog category="payment_methods" documentId={undefined} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-zinc-900 mb-4">تأكيد الحذف</h3>
            <p className="text-zinc-500 mb-6">هل أنت متأكد من رغبتك في حذف هذه الفاتورة؟ لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setInvoiceToDelete(null);
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
        category="purchase_invoices"
        documentId={activityLogDocumentId}
      />
    </div>
  );
};
