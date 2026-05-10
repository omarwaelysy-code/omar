import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Supplier, Product, PaymentMethod, ExpenseCategory, Account, JournalEntry, JournalEntryItem } from '../types';
import { 
  Search, Plus, Trash2, X, ShoppingCart, User, CreditCard, 
  Calendar, Hash, Package, Save, FileText, Pencil, Download, 
  Eye, History, Printer, ArrowRight, ArrowLeft, Minimize2, 
  Maximize2, Phone, Mail, MapPin, Wallet, Layers, Paperclip, 
  Tag, Box, LayoutGrid, List
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
import { TransactionManager } from '../services/TransactionManager';
import { InvoiceSchema, JournalEntrySchema } from '../lib/schemas';
import { ExportButtons } from '../components/ExportButtons';
import { ActivityLog } from '../types';
import { formatNumber, formatDate } from '../utils/formatUtils';
import { useViewPreference } from '../hooks/useViewPreference';

export const PurchaseInvoices: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
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
  const [view, setView] = useViewPreference('purchase_invoices', 'table');

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
        action: editingInvoice ? t('pi.log_edit') : t('pi.log_add'),
        details: editingInvoice 
          ? t('pi.log_edit_details', { number: invoice_number, supplier: supplier?.name || '...' })
          : t('pi.log_add_details', { supplier: supplier?.name || '...', amount: formatNumber(total_amount) }),
        created_at: new Date().toISOString()
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
            const fallbackAccount = accounts.find(a => a.name.includes('مشتريات') || a.name.toLowerCase().includes('purchase'));
            debitAccountId = fallbackAccount?.id || 'purchase_account_default';
            debitAccountName = fallbackAccount?.name || t('pi.purchase_account_default');
          }
        } else {
          const category = categories.find(c => c.id === item.expense_category_id);
          debitAccountId = category?.account_id || '';
          debitAccountName = category?.account_name || '';
          
          if (!debitAccountId) {
            const fallbackAccount = accounts.find(a => a.name.includes('مصروف') || a.name.toLowerCase().includes('expense'));
            debitAccountId = fallbackAccount?.id || 'expense_account_default';
            debitAccountName = fallbackAccount?.name || t('pi.expense_account_default');
          }
        }

        journalItems.push({
          account_id: debitAccountId,
          account_name: debitAccountName,
          debit: item.total,
          credit: 0,
          description: t('pi.purchase_description', { name: item.product_name || item.category_name, number: invoice_number })
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
            a.name.includes('نقدية') || a.name.includes('خزينة') || a.name.includes('صندوق') ||
            a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('safe') || a.name.toLowerCase().includes('fund')
          );
          creditAccountId = fallbackAccount?.id || 'cash_account_default';
          creditAccountName = fallbackAccount?.name || t('pi.cash_account_default');
        }
      } else {
        creditAccountId = supplier?.account_id || '';
        creditAccountName = supplier?.account_name || '';
        
        if (!creditAccountId) {
          const fallbackAccount = accounts.find(a => a.name.includes('موردين') || a.name.toLowerCase().includes('supplier'));
          creditAccountId = fallbackAccount?.id || 'suppliers_account_default';
          creditAccountName = fallbackAccount?.name || t('pi.suppliers_account_default');
        }
      }

      journalItems.push({
        account_id: creditAccountId,
        account_name: creditAccountName,
        debit: 0,
        credit: total_amount,
        description: t('pi.invoice_description', { number: invoice_number, supplier: supplier?.name || '...' })
      });

      // Credit: Discount Account (if any)
      if (invoiceData.discount > 0) {
        const discountAccount = accounts.find(a => a.id === settings?.supplier_discount_account_id) || 
                                accounts.find(a => a.name.includes('خصم مكتسب') || a.name.includes('خصم مشتريات') ||
                                             a.name.toLowerCase().includes('discount earned') || a.name.toLowerCase().includes('purchase discount'));
        journalItems.push({
          account_id: discountAccount?.id || 'purchase_discount_default',
          account_name: discountAccount?.name || t('pi.discount_account_default'),
          debit: 0,
          credit: invoiceData.discount,
          description: t('pi.discount_description', { number: invoice_number })
        });
      }

      setPreviewJournalEntry({
        id: 'preview',
        date: invoiceData.date,
        reference_number: invoice_number,
        reference_id: 'preview',
        reference_type: 'purchase_invoice',
        description: t('pi.journal_description', { number: invoice_number }),
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
      showNotification(t('common.error_loading_invoice'), 'error');
      return;
    }
    
    try {
      await exportToPDFUtil(element, {
        filename: `Purchase-Invoice-${invoice.invoice_number}.pdf`,
        margin: 10,
        orientation: 'portrait',
        reportTitle: t('pi.invoice_description', { number: invoice.invoice_number, supplier: invoice.supplier_name })
      });
    } catch (e) {
      console.error('PDF Export Error:', e);
      showNotification(t('common.error_export_pdf'), 'error');
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
          unit_price: item.cost_price,
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
            description: t('common.opening_balance_desc', { name: supplierFormData.name }),
            supplier_id: supplierId,
            supplier_name: supplierFormData.name
          },
          {
            account_id: supplierFormData.counter_account_id,
            account_name: counterAccount?.name || '',
            debit: supplierFormData.opening_balance > 0 ? supplierFormData.opening_balance : 0,
            credit: supplierFormData.opening_balance < 0 ? Math.abs(supplierFormData.opening_balance) : 0,
            description: t('common.opening_balance_desc', { name: supplierFormData.name }),
            supplier_id: supplierId,
            supplier_name: supplierFormData.name
          }
        ];

        const journalEntry: Omit<JournalEntry, 'id'> = {
          date: supplierFormData.opening_balance_date,
          reference_number: `OB-${code}`,
          reference_id: supplierId,
          reference_type: 'opening_balance',
          description: t('common.opening_balance_log', { name: supplierFormData.name }),
          items: journalItems,
          total_debit: Math.abs(supplierFormData.opening_balance),
          total_credit: Math.abs(supplierFormData.opening_balance),
          company_id: user.company_id,
          created_at: new Date().toISOString(),
          created_by: user.id
        };
        await dbService.createJournalEntry(journalEntry);
      }

      await dbService.logActivity(user.id, user.username, user.company_id, t('suppliers.add_supplier_log'), t('pi.add_supplier_log_via_pi', { name: supplierFormData.name }), ['suppliers', 'purchase_invoices']);
      
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
      showNotification(t('suppliers.add_success'));
    } catch (e) {
      console.error(e);
      showNotification(t('suppliers.add_error'), 'error');
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
      await dbService.logActivity(user.id, user.username, user.company_id, t('products.add_item_log'), t('pi.add_product_log_via_pi', { name: productFormData.name }), ['products', 'purchase_invoices']);
      
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
      showNotification(t('products.add_success'));
    } catch (e) {
      console.error(e);
      showNotification(t('products.add_error'), 'error');
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
        showNotification(t('common.image_too_large_warning'), 'info');
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
      await dbService.logActivity(user.id, user.username, user.company_id, t('pi.add_expense_category_log'), t('pi.add_expense_category_log_via_pi', { name: expenseCategoryFormData.name }), ['expense_categories', 'purchase_invoices']);
      
      setIsExpenseCategoryModalOpen(false);
      setExpenseCategoryFormData({
        code: '',
        name: '',
        description: ''
      });
      showNotification(t('pi.add_expense_category_success'));
    } catch (e) {
      console.error(e);
      showNotification(t('pi.add_expense_category_error'), 'error');
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
      await dbService.logActivity(user.id, user.username, user.company_id, t('payment.add_method_log'), t('pi.add_payment_method_log_via_pi', { name: paymentMethodFormData.name }), ['payment_methods', 'purchase_invoices'], pmId);
      
      // Create journal entry for opening balance if not zero
      if (paymentMethodFormData.opening_balance !== 0 && paymentMethodFormData.account_id && paymentMethodFormData.counter_account_id) {
        const absBalance = Math.abs(paymentMethodFormData.opening_balance);
        const isNegative = paymentMethodFormData.opening_balance < 0;
        const counterAccount = accounts.find(a => a.id === paymentMethodFormData.counter_account_id);

        await dbService.add('journal_entries', {
          company_id: user.company_id,
          date: paymentMethodFormData.opening_balance_date,
          description: t('common.opening_balance_log', { name: paymentMethodFormData.name }),
          reference_id: pmId,
          reference_type: 'opening_balance',
          items: [
            {
              account_id: paymentMethodFormData.account_id,
              account_name: selectedAccount?.name || '',
              debit: isNegative ? 0 : absBalance,
              credit: isNegative ? absBalance : 0,
              description: t('common.opening_balance')
            },
            {
              account_id: paymentMethodFormData.counter_account_id,
              account_name: counterAccount?.name || t('common.opening_balance_account'),
              debit: isNegative ? absBalance : 0,
              credit: isNegative ? 0 : absBalance,
              description: t('common.opening_balance_log', { name: paymentMethodFormData.name }),
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
      showNotification(t('payment.add_success'));
    } catch (e) {
      console.error(e);
      showNotification(t('payment.add_error'), 'error');
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
      showNotification(t('pi.error_no_items'), 'error');
      return;
    }

    try {
      const supplier = suppliers.find(s => s.id === invoiceData.supplier_id);
      const paymentMethod = paymentMethods.find(pm => pm.id === invoiceData.payment_method_id);
      
      const subtotal = Number(validItems.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.cost_price || 0)), 0)) || 0;
      const discount_amount = Number(invoiceData.discount) || 0;
      const total_amount = Number(subtotal - discount_amount) || 0;
      const invoice_number = editingInvoice?.invoice_number || invoiceNumber;

      const data = {
        invoice_number,
        supplier_id: invoiceData.supplier_id,
        supplier_name: supplier?.name || '',
        date: invoiceData.date, 
        subtotal,
        discount_amount,
        total_amount,
        items: validItems.map(item => ({
          product_id: item.product_id || '',
          expense_category_id: item.expense_category_id || '',
          product_name: item.product_name || '',
          category_name: item.category_name || '',
          quantity: Number(item.quantity) || 0,
          unit_price: Number(item.cost_price) || 0,
          total: (Number(item.quantity) || 0) * (Number(item.cost_price) || 0)
        })),
        payment_type: invoiceData.payment_type,
        payment_method_id: invoiceData.payment_type === 'cash' ? (invoiceData.payment_method_id || null) : null,
        payment_method_name: invoiceData.payment_type === 'cash' ? (paymentMethod?.name || '') : null,
        company_id: user.company_id,
        created_at: new Date().toISOString(),
        created_by: user.id
      };

      // Journal items generation
      const journalItems: any[] = [];
      let supplierAccountId = supplier?.account_id || '';
      let supplierAccountName = supplier?.account_name || '';
      if (!supplierAccountId) {
        const fallback = accounts.find(a => a.name.includes('موردين') || a.name.toLowerCase().includes('supplier'));
        supplierAccountId = fallback?.id || 'suppliers_account_default';
        supplierAccountName = fallback?.name || t('pi.suppliers_account_default');
      }

      journalItems.push({
        account_id: supplierAccountId,
        account_name: supplierAccountName,
        debit: 0,
        credit: total_amount,
        description: t('pi.invoice_description', { number: invoice_number, supplier: supplier?.name }),
        supplier_id: invoiceData.supplier_id,
        supplier_name: supplier?.name
      });

      if (invoiceData.discount > 0) {
        const discountAccount = accounts.find(a => a.id === settings?.supplier_discount_account_id) || 
                                accounts.find(a => a.name.includes('خصم مكتسب') || a.name.includes('خصم مشتريات') ||
                                             a.name.toLowerCase().includes('discount earned') || a.name.toLowerCase().includes('purchase discount'));
        journalItems.push({
          account_id: discountAccount?.id || 'purchase_discount_default',
          account_name: discountAccount?.name || t('pi.discount_account_default'),
          debit: 0,
          credit: invoiceData.discount,
          description: t('pi.discount_description', { number: invoice_number })
        });
      }

      validItems.forEach(item => {
        let debitAccountId = '';
        let debitAccountName = '';

        if (invoiceData.purchase_type === 'items') {
          const product = products.find(p => p.id === item.product_id);
          debitAccountId = product?.cost_account_id || '';
          debitAccountName = product?.cost_account_name || '';
          if (!debitAccountId) {
            const fallback = accounts.find(a => a.name.includes('مشتريات') || a.name.includes('تكلفة') || a.name.toLowerCase().includes('purchase'));
            debitAccountId = fallback?.id || 'purchase_account_default';
            debitAccountName = fallback?.name || t('pi.purchase_account_default');
          }
        } else {
          const category = categories.find(c => c.id === item.expense_category_id);
          debitAccountId = (category as any)?.account_id || '';
          debitAccountName = (category as any)?.account_name || '';
          if (!debitAccountId) {
            const fallback = accounts.find(a => (category && a.name.includes(category.name)) || a.name.includes('مصروفات') || a.name.toLowerCase().includes('expense'));
            debitAccountId = fallback?.id || 'expense_account_default';
            debitAccountName = fallback?.name || t('pi.expense_account_default');
          }
        }
        journalItems.push({
          account_id: debitAccountId,
          account_name: debitAccountName,
          debit: item.total,
          credit: 0,
          description: t('pi.purchase_description', { name: item.product_name || item.category_name, number: invoice_number })
        });
      });

      if (invoiceData.payment_type === 'cash') {
        const pm = paymentMethods.find(p => p.id === invoiceData.payment_method_id);
        let cashAccountId = pm?.account_id || '';
        let cashAccountName = pm?.account_name || '';
        if (!cashAccountId) {
          const fallback = accounts.find(a => 
            a.name.includes('نقدية') || a.name.includes('خزينة') || a.name.includes('صندوق') ||
            a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('safe') || a.name.toLowerCase().includes('fund')
          );
          cashAccountId = fallback?.id || 'cash_account_default';
          cashAccountName = fallback?.name || t('pi.cash_account_default');
        }
        journalItems.push({
          account_id: cashAccountId,
          account_name: cashAccountName,
          debit: 0,
          credit: total_amount,
          description: t('pi.payment_description', { number: invoice_number, supplier: supplier?.name })
        });
        journalItems.push({
          account_id: supplierAccountId,
          account_name: supplierAccountName,
          debit: total_amount,
          credit: 0,
          description: t('pi.settlement_description', { number: invoice_number, supplier: supplier?.name }),
          supplier_id: invoiceData.supplier_id,
          supplier_name: supplier?.name
        });
      }

      const total_debit = journalItems.reduce((sum, item) => sum + item.debit, 0);
      const total_credit = journalItems.reduce((sum, item) => sum + item.credit, 0);

      const journalEntryData = {
        date: invoiceData.date,
        reference_number: invoice_number,
        reference_type: 'purchase_invoice',
        description: t('pi.journal_description', { number: invoice_number }),
        items: journalItems,
        total_debit,
        total_credit,
        company_id: user.company_id,
        created_at: new Date().toISOString(),
        created_by: user.id
      };

      if (editingInvoice) {
        await dbService.deleteJournalEntryByReference(editingInvoice.id, user.company_id);
      }

      await TransactionManager.saveWithAccounting(
        'purchase_invoices',
        data,
        InvoiceSchema,
        journalEntryData,
        JournalEntrySchema
      );

      showNotification(editingInvoice ? t('pi.edit_success') : t('pi.add_success'), 'success');
      closeModal();

      if (!editingInvoice) {
        dbService.logActivity(user.id, user.username, user.company_id, t('pi.log_add'), t('pi.log_add_activity', { number: invoice_number }), 'purchase_invoices');
      }

    } catch (e: any) {
      console.error('Save failed:', e);
      showNotification(e.message || t('pi.save_error'), 'error');
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
      await dbService.logActivity(user.id, user.username, user.company_id, t('pi.log_delete'), t('pi.log_delete_activity', { number: invoice?.invoice_number }), 'purchase_invoices', invoiceToDelete);
      showNotification(t('common.delete_success'), 'success');
      setIsDeleteModalOpen(false);
      setInvoiceToDelete(null);
    } catch (e: any) {
      console.error(e);
      showNotification(e.message || t('common.delete_error'), 'error');
    }
  };

  const openModal = async (invoice?: any) => {
    if (invoice) {
      console.log('[EDIT] Opening edit modal for purchase invoice ID:', invoice.id);
      try {
        const fullData = await dbService.get<any>('purchase_invoices', invoice.id);
        console.log('[EDIT] Purchase invoice details from API:', fullData);
        
        if (!fullData) throw new Error('Purchase invoice not found');

        setEditingInvoice(fullData);
        setInvoiceData({
          supplier_id: fullData.supplier_id.toString(),
          date: fullData.date ? fullData.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
          payment_type: fullData.payment_type || 'cash',
          payment_method_id: fullData.payment_method_id?.toString() || '',
          notes: fullData.notes || '',
          discount: fullData.discount || 0,
          purchase_type: fullData.items?.[0]?.product_id ? 'items' : 'expenses'
        });
        setItems((fullData.items || []).map((item: any) => ({
          product_id: item.product_id?.toString(),
          expense_category_id: item.expense_category_id?.toString(),
          product_name: item.product_name,
          category_name: item.category_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total
        })));
        setInvoiceNumber(fullData.invoice_number);
        console.log('[EDIT] Form updated with purchase invoice:', fullData.id);
      } catch (error: any) {
        console.error('[EDIT] Error loading purchase invoice:', error);
        showNotification('فشل تحميل بيانات فاتورة الشراء', 'error');
        return;
      }
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
      'invoice_number': t('pi.invoice_number'),
      'supplier_name': t('pi.supplier'),
      'date': t('common.date'),
      'total_amount': t('pi.total_amount'),
      'purchase_type': t('pi.purchase_type')
    });
    exportToExcel(formattedData, { filename: 'Purchase_Invoices_Report', sheetName: t('pi.title') });
  };

  const handleExportPDF = async () => {
    if (tableRef.current) {
      await exportToPDFUtil(tableRef.current, { 
        filename: 'Purchase_Invoices_Report', 
        orientation: 'landscape',
        reportTitle: t('pi.report_title')
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
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">{t('pi.title')}</h2>
          <p className="text-zinc-500">{t('pi.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => setIsActivityLogOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-zinc-600 border border-zinc-200 rounded-2xl font-bold hover:bg-zinc-50 transition-all active:scale-95 shadow-sm"
            title={t('common.audit_log')}
          >
            <History size={20} />
            <span className="hidden md:inline">{t('common.audit_log')}</span>
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
            {t('pi.add_invoice')}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-50 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className={`absolute ${t('dir') === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
            <input
              type="text"
              placeholder={t('pi.search_placeholder')}
              className={`w-full ${t('dir') === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2 bg-zinc-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex bg-zinc-100 p-1 rounded-xl">
            <button
              onClick={() => setView('table')}
              className={`p-2 rounded-lg transition-all ${view === 'table' ? 'bg-white text-emerald-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
              title={t('dir') === 'rtl' ? 'عرض الجدول' : 'Table View'}
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setView('card')}
              className={`p-2 rounded-lg transition-all ${view === 'card' ? 'bg-white text-emerald-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
              title={t('dir') === 'rtl' ? 'عرض الكروت' : 'Card View'}
            >
              <LayoutGrid size={18} />
            </button>
          </div>
        </div>

        {view === 'table' ? (
          <div ref={tableRef} id="purchase-invoices-list-table" className="overflow-x-auto hidden md:block">
            <table className={`w-full ${t('dir') === 'rtl' ? 'text-right' : 'text-left'}`}>
              <thead>
                <tr className="bg-zinc-50/50 text-zinc-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-bold">{t('pi.invoice_number')}</th>
                  <th className="px-6 py-4 font-bold">{t('pi.supplier')}</th>
                  <th className="px-6 py-4 font-bold">{t('common.date')}</th>
                  <th className="px-6 py-4 font-bold">{t('pi.total_amount')}</th>
                  <th className={`px-6 py-4 font-bold ${t('dir') === 'rtl' ? 'text-left' : 'text-right'}`}>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-400 italic">{t('pi.no_invoices')}</td>
                  </tr>
                ) : filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-zinc-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs bg-emerald-50 px-2 py-1 rounded text-emerald-700 font-bold">{inv.invoice_number}</span>
                    </td>
                    <td className="px-6 py-4 font-bold text-zinc-900">{inv.supplier_name}</td>
                    <td className="px-6 py-4 text-zinc-500">{formatDate(inv.date)}</td>
                    <td className="px-6 py-4 font-bold text-zinc-900">{formatNumber(inv.total_amount)} {t('common.currency')}</td>
                    <td className={`px-6 py-4 ${t('dir') === 'rtl' ? 'text-left' : 'text-right'}`}>
                      <div className={`flex items-center ${t('dir') === 'rtl' ? 'justify-start' : 'justify-end'} gap-2 opacity-0 group-hover:opacity-100 transition-opacity`}>
                        <button 
                          onClick={() => {
                            setActivityLogDocumentId(inv.id);
                            setIsActivityLogOpen(true);
                          }}
                          className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all no-pdf"
                          title={t('common.activity_log')}
                        >
                          <History size={18} />
                        </button>
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
        ) : (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredInvoices.map((inv) => (
              <div key={inv.id} className="p-6 bg-zinc-50/50 rounded-3xl border border-zinc-100 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5 transition-all group relative overflow-hidden">
                <div className="absolute top-4 left-4 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => setViewInvoice(inv)}
                    className="p-2 bg-white text-emerald-500 rounded-xl border border-emerald-50 shadow-sm hover:bg-emerald-50 transition-all font-bold"
                  >
                    <Eye size={16} />
                  </button>
                  <button 
                    onClick={() => openModal(inv)}
                    className="p-2 bg-white text-blue-500 rounded-xl border border-blue-50 shadow-sm hover:bg-blue-50 transition-all font-bold"
                  >
                    <Pencil size={16} />
                  </button>
                  <button 
                    onClick={() => handleDelete(inv.id)}
                    className="p-2 bg-white text-red-500 rounded-xl border border-red-50 shadow-sm hover:bg-red-50 transition-all font-bold"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="flex justify-between items-start">
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-[10px] bg-white px-2 py-1 rounded text-emerald-700 font-bold w-fit border border-emerald-100">{inv.invoice_number}</span>
                    <h4 className="font-bold text-zinc-900 group-hover:text-emerald-700 transition-colors text-xl mt-1 tracking-tight">{inv.supplier_name}</h4>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-200/50 mt-4">
                  <div className="space-y-1">
                    <p className="text-zinc-400 text-[10px] uppercase font-black tracking-widest">{t('common.date')}</p>
                    <p className="text-zinc-900 font-bold text-sm tracking-tight">{formatDate(inv.date)}</p>
                  </div>
                  <div className="space-y-1 text-left">
                    <p className="text-zinc-400 text-[10px] uppercase font-black tracking-widest">{t('pi.total_amount')}</p>
                    <p className="font-black text-2xl tracking-tighter text-emerald-600">
                      {formatNumber(inv.total_amount)} <span className="text-sm font-bold">{t('common.currency')}</span>
                    </p>
                  </div>
                  <div className="col-span-2 space-y-1 mt-1 pt-3 border-t border-zinc-200/50 flex justify-end">
                    <button 
                      onClick={() => {
                        setActivityLogDocumentId(inv.id);
                        setIsActivityLogOpen(true);
                      }}
                      className="p-2 text-zinc-400 hover:text-emerald-500 bg-white border border-zinc-100 rounded-xl transition-all"
                      title={t('common.activity_log')}
                    >
                      <History size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {filteredInvoices.length === 0 && (
              <div className="col-span-full p-12 text-center text-zinc-500 font-bold italic">{t('pi.no_invoices')}</div>
            )}
          </div>
        )}

        {/* Mobile List View */}
        <div className="md:hidden divide-y divide-zinc-50">
          {filteredInvoices.map((inv) => (
            <div key={inv.id} className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[10px] bg-emerald-50 px-2 py-1 rounded text-emerald-700 font-bold w-fit">{inv.invoice_number}</span>
                  <h4 className="font-bold text-zinc-900 text-lg">{inv.supplier_name}</h4>
                </div>
                <div className={t('dir') === 'rtl' ? 'text-left' : 'text-right'}>
                  <p className="font-bold text-emerald-600 text-lg">{formatNumber(inv.total_amount)} {t('common.currency')}</p>
                  <span className="text-xs text-zinc-400">{formatDate(inv.date)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button 
                  onClick={() => setViewInvoice(inv)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-zinc-50 text-zinc-600 rounded-2xl text-sm font-bold border border-zinc-100 active:scale-95 transition-transform"
                >
                  <Eye size={18} /> {t('common.view')}
                </button>
                <button 
                  onClick={() => openModal(inv)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-50 text-blue-600 rounded-2xl text-sm font-bold border border-blue-100 active:scale-95 transition-transform"
                >
                  <Pencil size={18} /> {t('common.edit')}
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
            <div className="p-8 text-center text-zinc-500 italic">{t('pi.no_invoices')}</div>
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
                  <h3 className="text-xl font-bold text-zinc-900">{editingInvoice ? t('pi.edit_invoice') : t('pi.add_invoice')}</h3>
                  <p className="text-sm text-zinc-500">{t('pi.modal_subtitle')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {editingInvoice && (
                  <div className="flex items-center gap-1 mr-4">
                    <button
                      onClick={handleBackInvoice}
                      disabled={purchaseInvoices.findIndex(inv => inv.id === editingInvoice.id) === purchaseInvoices.length - 1}
                      className="p-2 hover:bg-zinc-200 rounded-xl transition-all disabled:opacity-30"
                      title={t('common.previous')}
                    >
                      {t('dir') === 'rtl' ? <ArrowRight size={20} /> : <ArrowLeft size={20} />}
                    </button>
                    <button
                      onClick={handleNextInvoice}
                      disabled={purchaseInvoices.findIndex(inv => inv.id === editingInvoice.id) === 0}
                      className="p-2 hover:bg-zinc-200 rounded-xl transition-all disabled:opacity-30"
                      title={t('common.next')}
                    >
                      {t('dir') === 'rtl' ? <ArrowLeft size={20} /> : <ArrowRight size={20} />}
                    </button>
                  </div>
                )}
                <button 
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="p-2 hover:bg-zinc-200 rounded-xl transition-all text-zinc-500"
                  title={isFullScreen ? t('common.minimize') : t('common.maximize')}
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
                    initial={{ x: t('dir') === 'rtl' ? '100%' : '-100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: t('dir') === 'rtl' ? '100%' : '-100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className={`absolute inset-y-0 ${t('dir') === 'rtl' ? 'right-0 border-l' : 'left-0 border-r'} z-50 w-full lg:w-80 shadow-2xl lg:shadow-none lg:relative lg:inset-auto`}
                  >
                    <div className="h-full bg-white border-zinc-100 flex flex-col">
                      <div className="p-4 border-b border-zinc-100 flex items-center justify-between lg:hidden">
                        <h3 className="font-bold text-zinc-900">{t('common.audit_log')}</h3>
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
                          {t('pi.purchase_items')}
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
                          {t('pi.purchase_expenses')}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div>
                          <label className="block text-sm font-bold text-zinc-700 mb-2 uppercase tracking-tighter">{t('pi.supplier')}</label>
                          <div className="relative">
                            <User className={`absolute ${t('dir') === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
                            <select 
                              required
                              className={`w-full ${t('dir') === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none`}
                              value={invoiceData.supplier_id}
                              onChange={(e) => {
                                if (e.target.value === 'new_supplier') {
                                  setIsSupplierModalOpen(true);
                                } else {
                                  setInvoiceData({...invoiceData, supplier_id: e.target.value});
                                }
                              }}
                            >
                              <option value="">{t('pi.select_supplier')}</option>
                              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                              <option value="new_supplier" className="font-bold text-emerald-600">+ {t('suppliers.add_new')}</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-zinc-700 mb-2 uppercase tracking-tighter">{t('common.date')}</label>
                          <div className="relative">
                            <Calendar className={`absolute ${t('dir') === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
                            <input 
                              required
                              type="date" 
                              className={`w-full ${t('dir') === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
                              value={invoiceData.date}
                              onChange={(e) => setInvoiceData({...invoiceData, date: e.target.value})}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-zinc-700 mb-2 uppercase tracking-tighter">{t('pi.payment_type')}</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button 
                              type="button"
                              onClick={() => setInvoiceData({...invoiceData, payment_type: 'cash'})}
                              className={`py-3 rounded-xl font-bold transition-all ${invoiceData.payment_type === 'cash' ? 'bg-zinc-900 text-white shadow-lg' : 'bg-zinc-50 text-zinc-500 border border-zinc-200 hover:bg-zinc-100'}`}
                            >
                              {t('pi.cash')}
                            </button>
                            <button 
                              type="button"
                              onClick={() => setInvoiceData({...invoiceData, payment_type: 'credit'})}
                              className={`py-3 rounded-xl font-bold transition-all ${invoiceData.payment_type === 'credit' ? 'bg-zinc-900 text-white shadow-lg' : 'bg-zinc-50 text-zinc-500 border border-zinc-200 hover:bg-zinc-100'}`}
                            >
                              {t('pi.credit')}
                            </button>
                          </div>
                        </div>

                        {invoiceData.payment_type === 'cash' && (
                          <div>
                            <label className="block text-sm font-bold text-zinc-700 mb-2 uppercase tracking-tighter">{t('pi.payment_method')}</label>
                            <div className="relative">
                              <CreditCard className={`absolute ${t('dir') === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
                              <select 
                                required
                                className={`w-full ${t('dir') === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none`}
                                value={invoiceData.payment_method_id}
                                onChange={(e) => {
                                  if (e.target.value === 'new_payment_method') {
                                    setIsPaymentMethodModalOpen(true);
                                  } else {
                                    setInvoiceData({...invoiceData, payment_method_id: e.target.value});
                                  }
                                }}
                              >
                                <option value="">{t('pi.select_payment_method')}</option>
                                {paymentMethods.map(pm => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
                                <option value="new_payment_method" className="font-bold text-emerald-600">+ {t('payment_methods.add_new')}</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-zinc-700 mb-2 uppercase tracking-tighter">{t('common.notes')}</label>
                        <textarea 
                          rows={2}
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none"
                          placeholder={t('pi.notes_placeholder')}
                          value={invoiceData.notes}
                          onChange={(e) => setInvoiceData({...invoiceData, notes: e.target.value})}
                        />
                      </div>

                      <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-zinc-50 flex items-center justify-between bg-zinc-50/50">
                          <div className="flex items-center gap-4">
                            <h3 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
                              {invoiceData.purchase_type === 'items' ? <Package size={24} className="text-emerald-500" /> : <FileText size={24} className="text-emerald-500" />}
                              {invoiceData.purchase_type === 'items' ? t('pi.invoice_items') : t('pi.expense_items')}
                            </h3>
                            <button 
                              type="button"
                              onClick={() => setShowSidePanel(!showSidePanel)}
                              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${showSidePanel ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-zinc-100 text-zinc-600 border border-zinc-200 hover:bg-zinc-200'}`}
                            >
                              <History size={14} />
                              {t('pi.toggle_side_panel')}
                            </button>
                          </div>
                          <button 
                            type="button"
                            onClick={addItem}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all active:scale-95"
                          >
                            <Plus size={18} />
                            {t('common.add')} {invoiceData.purchase_type === 'items' ? t('pi.item') : t('pi.expense_item')}
                          </button>
                        </div>

                        <div className="overflow-x-auto">
                          <table className={`w-full ${t('dir') === 'rtl' ? 'text-right' : 'text-left'} border-collapse`}>
                            <thead>
                              <tr className="bg-zinc-50/30 border-b border-zinc-100">
                                <th className="px-3 py-2 text-xs font-bold text-zinc-500 uppercase tracking-tighter w-12 text-center">{t('common.image')}</th>
                                <th className="px-3 py-2 text-xs font-bold text-zinc-500 uppercase tracking-tighter">{invoiceData.purchase_type === 'items' ? t('pi.item') : t('pi.expense_item')}</th>
                                <th className="px-3 py-2 text-xs font-bold text-zinc-500 uppercase tracking-tighter w-24 text-center">{t('pi.quantity')}</th>
                                <th className="px-3 py-2 text-xs font-bold text-zinc-500 uppercase tracking-tighter w-32 text-center">{t('pi.price')}</th>
                                <th className="px-3 py-2 text-xs font-bold text-zinc-500 uppercase tracking-tighter w-32 text-center">{t('pi.total')}</th>
                                <th className="px-3 py-2 text-xs font-bold text-zinc-500 uppercase tracking-tighter w-12"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-50">
                              {items.length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-400 italic">{t('pi.no_items_added')}</td>
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
                                        className={`w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${t('dir') === 'rtl' ? 'text-right' : 'text-left'}`}
                                        value={item.product_id || ''}
                                        onChange={(e) => {
                                          if (e.target.value === 'new_product') {
                                            setIsProductModalOpen(true);
                                          } else {
                                            updateItem(index, 'product_id', e.target.value);
                                          }
                                        }}
                                      >
                                        <option value="">{t('pi.select_item')}</option>
                                        {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                                        <option value="new_product" className="font-bold text-emerald-600">+ {t('products.add_new')}</option>
                                      </select>
                                    ) : (
                                      <select 
                                        required
                                        className={`w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${t('dir') === 'rtl' ? 'text-right' : 'text-left'}`}
                                        value={item.expense_category_id || ''}
                                        onChange={(e) => {
                                          if (e.target.value === 'new_expense_category') {
                                            setIsExpenseCategoryModalOpen(true);
                                          } else {
                                            updateItem(index, 'expense_category_id', e.target.value);
                                          }
                                        }}
                                      >
                                        <option value="">{t('pi.select_expense_item')}</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                                        <option value="new_expense_category" className="font-bold text-emerald-600">+ {t('expense_categories.add_new')}</option>
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
                                    {formatNumber(item.total || 0)}
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
                                <td colSpan={3} className={`px-3 py-2 ${t('dir') === 'rtl' ? 'text-left' : 'text-right'} text-zinc-500`}>{t('pi.subtotal')}:</td>
                                <td className="px-3 py-2 text-base text-zinc-900 font-mono text-center">{formatNumber(calculateSubtotal())}</td>
                                <td></td>
                              </tr>
                              <tr className="bg-zinc-50/50 font-bold">
                                <td colSpan={3} className={`px-3 py-2 ${t('dir') === 'rtl' ? 'text-left' : 'text-right'} text-zinc-500 flex items-center justify-end gap-2`}>
                                  <span>{t('pi.discount')}:</span>
                                  <input 
                                    type="number" 
                                    className="w-24 bg-white border border-zinc-200 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-orange-500 font-mono"
                                    value={invoiceData.discount}
                                    onChange={(e) => setInvoiceData({ ...invoiceData, discount: parseFloat(e.target.value) || 0 })}
                                  />
                                </td>
                                <td className="px-3 py-2 text-base text-red-600 font-mono text-center">-{formatNumber(invoiceData.discount)}</td>
                                <td></td>
                              </tr>
                              <tr className="bg-zinc-900 text-white">
                                <td colSpan={3} className={`px-6 py-4 ${t('dir') === 'rtl' ? 'text-left' : 'text-right'} font-bold text-lg`}>{t('pi.grand_total')}:</td>
                                <td colSpan={2} className="px-6 py-4 font-bold text-2xl text-emerald-400">
                                  {formatNumber(calculateTotal())} {t('common.currency')}
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
                        {editingInvoice ? t('pi.edit_invoice') : t('pi.add_invoice')}
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
              <h3 className="text-lg font-bold text-zinc-900">{t('pi.view_invoice')}</h3>
              <button onClick={() => setViewInvoice(null)} className="p-2 text-zinc-400 hover:text-zinc-600"><X size={24} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row h-full">
              {/* Side Panel for Activity Log and Journal Entry */}
              <TransactionSidePanel 
                documentId={viewInvoice.id} 
                category="purchase_invoices" 
              />

              <div ref={invoiceRef} id="purchase-invoice-capture-area" className={`flex-1 p-6 md:p-8 space-y-8 bg-white overflow-y-auto ${t('dir') === 'rtl' ? 'text-right' : 'text-left'}`} style={{ color: '#18181b' }}>
                <div className={`flex justify-between items-start ${t('dir') === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                  <div>
                    <h3 className="text-2xl md:text-3xl font-bold text-[#18181b] italic serif">{t('pi.title')}</h3>
                    <p className="text-[#71717a] font-mono text-sm md:text-base">{viewInvoice.invoice_number}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <p className="text-xs font-bold text-[#a1a1aa] uppercase tracking-widest mb-1">{t('pi.invoice_from')}</p>
                    <p className="text-xl font-bold text-[#18181b]">{viewInvoice.supplier_name}</p>
                  </div>
                  <div className={t('dir') === 'rtl' ? 'text-left' : 'text-right'}>
                    <p className="text-xs font-bold text-[#a1a1aa] uppercase tracking-widest mb-1">{t('common.date')}</p>
                    <p className="text-lg font-medium text-[#18181b]">{formatDate(viewInvoice.date)}</p>
                  </div>
                </div>

                <div className="border border-[#f4f4f5] rounded-2xl overflow-hidden">
                  <table className={`w-full ${t('dir') === 'rtl' ? 'text-right' : 'text-left'} text-sm`}>
                    <thead className="bg-[#fafafa] text-[#71717a] uppercase text-[10px] font-bold tracking-widest">
                      <tr>
                        <th className="px-4 py-3 w-16 text-center">{t('common.image')}</th>
                        <th className="px-4 py-3">{t('pi.item')} / {t('pi.expense_category')}</th>
                        <th className="px-4 py-3 w-24">{t('pi.quantity')}</th>
                        <th className="px-4 py-3 w-32">{t('pi.price')}</th>
                        <th className="px-4 py-3 w-32">{t('pi.total')}</th>
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
                          <td className="px-4 py-3 text-[#71717a]">{formatNumber(item.price || item.cost_price || 0)} {t('common.currency')}</td>
                          <td className="px-4 py-3 font-bold text-[#18181b]">{formatNumber(item.total)} {t('common.currency')}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-[#fafafa] font-bold">
                      <tr>
                        <td colSpan={3} className={`px-4 py-2 ${t('dir') === 'rtl' ? 'text-left' : 'text-right'} text-[#71717a]`}>{t('pi.subtotal')}:</td>
                        <td className="px-4 py-2 text-[#18181b]">{formatNumber(viewInvoice.subtotal || viewInvoice.total_amount || 0)} {t('common.currency')}</td>
                      </tr>
                      {viewInvoice.discount > 0 && (
                        <tr>
                          <td colSpan={3} className={`px-4 py-2 ${t('dir') === 'rtl' ? 'text-left' : 'text-right'} text-[#71717a]`}>{t('pi.discount')}:</td>
                          <td className="px-4 py-2 text-red-600">-{formatNumber(viewInvoice.discount)} {t('common.currency')}</td>
                        </tr>
                      )}
                      <tr>
                        <td colSpan={3} className={`px-4 py-6 ${t('dir') === 'rtl' ? 'text-left' : 'text-right'} text-[#71717a]`}>{t('pi.grand_total')}:</td>
                        <td className="px-4 py-6 text-3xl text-[#f97316]">{formatNumber(viewInvoice.total_amount)} {t('common.currency')}</td>
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
                    {t('common.audit_log')}
                  </button>
                  <button 
                    onClick={() => exportToPDF(viewInvoice)}
                    className="flex-1 py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all flex items-center justify-center gap-2"
                  >
                    <Download size={20} />
                    {t('common.download_pdf')}
                  </button>
                  <button 
                    onClick={() => setViewInvoice(null)}
                    className="flex-1 py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all"
                  >
                    {t('common.close')}
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
              <h3 className="text-lg md:text-xl font-bold text-zinc-900">{t('suppliers.add_new')}</h3>
              <button onClick={() => setIsSupplierModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 p-2 hover:bg-zinc-100 rounded-xl transition-all"><X size={24} /></button>
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              <form onSubmit={handleSupplierSubmit} className={`p-4 md:p-8 space-y-5 flex-1 overflow-y-auto pb-32 md:pb-8 ${t('dir') === 'rtl' ? 'text-right' : 'text-left'}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('suppliers.name')}</label>
                    <div className="relative">
                      <User className={`absolute ${t('dir') === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
                      <input
                        required
                        type="text"
                        className={`w-full ${t('dir') === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
                        value={supplierFormData.name}
                        onChange={(e) => setSupplierFormData({ ...supplierFormData, name: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('suppliers.phone')}</label>
                    <div className="relative">
                      <Phone className={`absolute ${t('dir') === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
                      <input
                        type="text"
                        className={`w-full ${t('dir') === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
                        value={supplierFormData.mobile}
                        onChange={(e) => setSupplierFormData({ ...supplierFormData, mobile: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('suppliers.email')}</label>
                  <div className="relative">
                    <Mail className={`absolute ${t('dir') === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
                    <input
                      type="email"
                      className={`w-full ${t('dir') === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
                      value={supplierFormData.email}
                      onChange={(e) => setSupplierFormData({ ...supplierFormData, email: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('suppliers.address')}</label>
                  <div className="relative">
                    <MapPin className={`absolute ${t('dir') === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
                    <textarea
                      className={`w-full ${t('dir') === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
                      rows={2}
                      value={supplierFormData.address}
                      onChange={(e) => setSupplierFormData({ ...supplierFormData, address: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('suppliers.opening_balance')}</label>
                    <div className="relative">
                      <Wallet className={`absolute ${t('dir') === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
                      <input 
                        type="number" 
                        className={`w-full ${t('dir') === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
                        value={supplierFormData.opening_balance}
                        onChange={(e) => setSupplierFormData({ ...supplierFormData, opening_balance: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('suppliers.balance_date')}</label>
                    <div className="relative">
                      <Calendar className={`absolute ${t('dir') === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
                      <input 
                        type="date" 
                        className={`w-full ${t('dir') === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
                        value={supplierFormData.opening_balance_date}
                        onChange={(e) => setSupplierFormData({ ...supplierFormData, opening_balance_date: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('suppliers.accounting_account')}</label>
                    <select
                      required
                      className={`w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${t('dir') === 'rtl' ? 'text-right' : 'text-left'}`}
                      value={supplierFormData.account_id}
                      onChange={(e) => setSupplierFormData({ ...supplierFormData, account_id: e.target.value })}
                    >
                      <option value="">{t('suppliers.select_account')}</option>
                      {accounts.map(account => (
                        <option key={account.id} value={account.id}>
                          {account.code} - {account.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {supplierFormData.opening_balance !== 0 && (
                    <div className="animate-in slide-in-from-top-2 duration-200">
                      <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('suppliers.opening_balance_counter_account')}</label>
                      <select
                        required
                        className={`w-full px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all ${t('dir') === 'rtl' ? 'text-right' : 'text-left'}`}
                        value={supplierFormData.counter_account_id}
                        onChange={(e) => setSupplierFormData({ ...supplierFormData, counter_account_id: e.target.value })}
                      >
                        <option value="">{t('common.select_counter_account')}</option>
                        {accounts.map(account => (
                          <option key={account.id} value={account.id}>
                            {account.code} - {account.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-orange-600 mt-1 font-medium">{t('suppliers.counter_account_note')}</p>
                    </div>
                  )}
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                  >
                    {t('suppliers.save')}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsSupplierModalOpen(false)}
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
          <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-4xl md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-4 md:p-6 border-b border-zinc-50 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg md:text-xl font-bold text-zinc-900">{t('products.add_new')}</h3>
              <button onClick={() => setIsProductModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 p-2 hover:bg-zinc-100 rounded-xl transition-all"><X size={24} /></button>
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              <form onSubmit={handleProductSubmit} className={`p-4 md:p-8 space-y-5 flex-1 overflow-y-auto pb-32 md:pb-8 ${t('dir') === 'rtl' ? 'text-right' : 'text-left'}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('products.code')}</label>
                    <div className="relative">
                      <Hash className={`absolute ${t('dir') === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
                      <input
                        required
                        type="text"
                        className={`w-full ${t('dir') === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-mono`}
                        value={productFormData.code}
                        onChange={(e) => setProductFormData({ ...productFormData, code: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('products.name')}</label>
                    <div className="relative">
                      <Package className={`absolute ${t('dir') === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
                      <input
                        required
                        type="text"
                        className={`w-full ${t('dir') === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
                        value={productFormData.name}
                        onChange={(e) => setProductFormData({ ...productFormData, name: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('products.type')}</label>
                  <div className="relative">
                    <Layers className={`absolute ${t('dir') === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
                    <select
                      required
                      className={`w-full ${t('dir') === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none ${t('dir') === 'rtl' ? 'text-right' : 'text-left'}`}
                      value={productFormData.type}
                      onChange={(e) => setProductFormData({ ...productFormData, type: e.target.value as any })}
                    >
                      <option value="product">{t('products.product')}</option>
                      <option value="service">{t('products.service')}</option>
                      <option value="commodity">{t('products.commodity')}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('products.sale_price')}</label>
                    <div className="relative">
                      <Tag className={`absolute ${t('dir') === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
                      <input
                        required
                        type="number"
                        step="0.01"
                        className={`w-full ${t('dir') === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
                        value={productFormData.sale_price}
                        onChange={(e) => setProductFormData({ ...productFormData, sale_price: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('products.cost_price')}</label>
                    <div className="relative">
                      <Tag className={`absolute ${t('dir') === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
                      <input
                        required
                        type="number"
                        step="0.01"
                        className={`w-full ${t('dir') === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
                        value={productFormData.cost_price}
                        onChange={(e) => setProductFormData({ ...productFormData, cost_price: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('products.description')}</label>
                  <textarea
                    className={`w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${t('dir') === 'rtl' ? 'text-right' : 'text-left'}`}
                    rows={2}
                    value={productFormData.description}
                    onChange={(e) => setProductFormData({ ...productFormData, description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('products.attachment')}</label>
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
                          {productFormData.image_url ? t('products.change_attachment') : t('products.select_file')}
                        </span>
                      </label>
                    </div>
                    {productFormData.image_url && (
                      <div className="mt-2 relative flex justify-center bg-white p-2 rounded-lg border border-zinc-100 overflow-hidden">
                        <button 
                          type="button"
                          onClick={() => setProductFormData({ ...productFormData, image_url: '' })}
                          className={`absolute top-1 ${t('dir') === 'rtl' ? 'left-1' : 'right-1'} text-red-500 hover:bg-red-50 p-1 rounded-full bg-white/80 backdrop-blur-sm shadow-sm z-10`}
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
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('products.barcode')}</label>
                    <div className="relative">
                      <Hash className={`absolute ${t('dir') === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
                      <input
                        type="text"
                        className={`w-full ${t('dir') === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
                        value={productFormData.barcode}
                        onChange={(e) => setProductFormData({ ...productFormData, barcode: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('products.revenue_account')}</label>
                    <select
                      required
                      className={`w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${t('dir') === 'rtl' ? 'text-right' : 'text-left'}`}
                      value={productFormData.revenue_account_id}
                      onChange={(e) => setProductFormData({ ...productFormData, revenue_account_id: e.target.value })}
                    >
                      <option value="">{t('suppliers.select_account')}</option>
                      {accounts.map(account => (
                        <option key={account.id} value={account.id}>
                          {account.code} - {account.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('products.cost_account')}</label>
                    <select
                      required
                      className={`w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${t('dir') === 'rtl' ? 'text-right' : 'text-left'}`}
                      value={productFormData.cost_account_id}
                      onChange={(e) => setProductFormData({ ...productFormData, cost_account_id: e.target.value })}
                    >
                      <option value="">{t('suppliers.select_account')}</option>
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
                    {t('products.save')}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsProductModalOpen(false)}
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

      {/* Add Expense Category Modal */}
      {isExpenseCategoryModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-4xl md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-4 md:p-6 border-b border-zinc-50 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg md:text-xl font-bold text-zinc-900">{t('expense_categories.add_new')}</h3>
              <button onClick={() => setIsExpenseCategoryModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 p-2 hover:bg-zinc-100 rounded-xl transition-all"><X size={24} /></button>
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              <form onSubmit={handleExpenseCategorySubmit} className={`p-4 md:p-8 space-y-5 flex-1 overflow-y-auto pb-32 md:pb-8 ${t('dir') === 'rtl' ? 'text-right' : 'text-left'}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('expense_categories.code')}</label>
                    <div className="relative">
                      <Hash className={`absolute ${t('dir') === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
                      <input
                        required
                        type="text"
                        className={`w-full ${t('dir') === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-mono`}
                        value={expenseCategoryFormData.code}
                        onChange={(e) => setExpenseCategoryFormData({ ...expenseCategoryFormData, code: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('expense_categories.name')}</label>
                    <div className="relative">
                      <Layers className={`absolute ${t('dir') === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
                      <input
                        required
                        type="text"
                        className={`w-full ${t('dir') === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
                        value={expenseCategoryFormData.name}
                        onChange={(e) => setExpenseCategoryFormData({ ...expenseCategoryFormData, name: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('expense_categories.description')}</label>
                  <div className="relative">
                    <FileText className={`absolute ${t('dir') === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
                    <textarea
                      className={`w-full ${t('dir') === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
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
                    {t('expense_categories.save')}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsExpenseCategoryModalOpen(false)}
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

      {/* Add Payment Method Modal */}
      {isPaymentMethodModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-6xl md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-4 md:p-6 border-b border-zinc-50 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg md:text-xl font-bold text-zinc-900">{t('payment_methods.add_new')}</h3>
              <button onClick={() => setIsPaymentMethodModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 p-2 hover:bg-zinc-100 rounded-xl transition-all"><X size={24} /></button>
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              <form onSubmit={handlePaymentMethodSubmit} className={`p-4 md:p-8 space-y-5 flex-1 overflow-y-auto pb-32 md:pb-8 ${t('dir') === 'rtl' ? 'text-right' : 'text-left'}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('payment_methods.code')}</label>
                    <div className="relative">
                      <Hash className={`absolute ${t('dir') === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
                      <input
                        required
                        type="text"
                        className={`w-full ${t('dir') === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
                        value={paymentMethodFormData.code}
                        onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, code: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('payment_methods.name')}</label>
                    <div className="relative">
                      <Wallet className={`absolute ${t('dir') === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
                      <input
                        required
                        type="text"
                        className={`w-full ${t('dir') === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
                        value={paymentMethodFormData.name}
                        onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, name: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('payment_methods.type')}</label>
                    <div className="relative">
                      <Layers className={`absolute ${t('dir') === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
                      <select
                        className={`w-full ${t('dir') === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none ${t('dir') === 'rtl' ? 'text-right' : 'text-left'}`}
                        value={paymentMethodFormData.type}
                        onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, type: e.target.value as any })}
                      >
                        <option value="cash">{t('payment_methods.cash_box')}</option>
                        <option value="bank">{t('payment_methods.bank')}</option>
                        <option value="wallet">{t('payment_methods.wallet')}</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('payment_methods.accounting_account')}</label>
                    <select
                      required
                      className={`w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${t('dir') === 'rtl' ? 'text-right' : 'text-left'}`}
                      value={paymentMethodFormData.account_id}
                      onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, account_id: e.target.value })}
                    >
                      <option value="">{t('suppliers.select_account')}</option>
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
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('payment_methods.opening_balance')}</label>
                    <div className="relative">
                      <Wallet className={`absolute ${t('dir') === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
                      <input 
                        type="number" 
                        className={`w-full ${t('dir') === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
                        value={paymentMethodFormData.opening_balance}
                        onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, opening_balance: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('payment_methods.balance_date')}</label>
                    <div className="relative">
                      <Calendar className={`absolute ${t('dir') === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
                      <input 
                        type="date" 
                        className={`w-full ${t('dir') === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
                        value={paymentMethodFormData.opening_balance_date}
                        onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, opening_balance_date: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {paymentMethodFormData.opening_balance !== 0 && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('payment_methods.counter_account')}</label>
                      <select
                        required
                        className={`w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all border-emerald-200 bg-emerald-50/30 ${t('dir') === 'rtl' ? 'text-right' : 'text-left'}`}
                        value={paymentMethodFormData.counter_account_id}
                        onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, counter_account_id: e.target.value })}
                      >
                        <option value="">{t('common.select_counter_account')}</option>
                        {accounts.map(account => (
                          <option key={account.id} value={account.id}>
                            {account.code} - {account.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {paymentMethodFormData.counter_account_id && paymentMethodFormData.account_id && (
                      <JournalEntryPreview 
                        title={t('payment_methods.opening_balance_preview')}
                        items={[
                          {
                            account_name: accounts.find(a => a.id === paymentMethodFormData.account_id)?.name || t('payment_methods.payment_method_account'),
                            debit: paymentMethodFormData.opening_balance > 0 ? paymentMethodFormData.opening_balance : 0,
                            credit: paymentMethodFormData.opening_balance < 0 ? Math.abs(paymentMethodFormData.opening_balance) : 0,
                            description: t('payment_methods.opening_balance')
                          },
                          {
                            account_name: accounts.find(a => a.id === paymentMethodFormData.counter_account_id)?.name || t('payment_methods.counter_account_placeholder'),
                            debit: paymentMethodFormData.opening_balance < 0 ? Math.abs(paymentMethodFormData.opening_balance) : 0,
                            credit: paymentMethodFormData.opening_balance > 0 ? paymentMethodFormData.opening_balance : 0,
                            description: t('payment_methods.opening_balance_method_desc', { name: paymentMethodFormData.name })
                          }
                        ]}
                      />
                    )}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('payment_methods.additional_details')}</label>
                  <div className="relative">
                    <FileText className={`absolute ${t('dir') === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
                    <textarea
                      className={`w-full ${t('dir') === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
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
                    {t('payment_methods.save')}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsPaymentMethodModalOpen(false)}
                    className="px-8 py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all active:scale-95"
                  >
                    {t('common.cancel')}
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
            <h3 className={`text-xl font-bold text-zinc-900 mb-4 ${t('dir') === 'rtl' ? 'text-right' : 'text-left'}`}>{t('pi.confirm_delete_title')}</h3>
            <p className={`text-zinc-500 mb-6 ${t('dir') === 'rtl' ? 'text-right' : 'text-left'}`}>{t('pi.confirm_delete_desc')}</p>
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setInvoiceToDelete(null);
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
        category="purchase_invoices"
        documentId={activityLogDocumentId}
      />
    </div>
  );
};
