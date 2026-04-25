import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Invoice, Customer, Product, InvoiceItem, Account, JournalEntry, JournalEntryItem, ActivityLog } from '../types';
import { Search, Plus, Trash2, X, Eye, Download, Sparkles, Mic, Image as ImageIcon, FileText, Pencil, History, Printer, ChevronLeft, ChevronRight, Maximize2, Minimize2, Hash, Wallet, Calendar, Package, Tag, Layers, Box, Paperclip, Phone, Mail, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Barcode from 'react-barcode';
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
import { usePermissions } from '../hooks/usePermissions';

import { useLanguage } from '../contexts/LanguageContext';

export const Invoices: React.FC = () => {
  const { t, dir } = useLanguage();
  const { user } = useAuth();
  const { canView, canCreate, canEdit, canDelete } = usePermissions('invoices');
  const { showNotification } = useNotification();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [activityLogDocumentId, setActivityLogDocumentId] = useState<string | undefined>(undefined);
  const [previewJournalEntry, setPreviewJournalEntry] = useState<JournalEntry | null>(null);
  const [previewActivityLog, setPreviewActivityLog] = useState<Partial<ActivityLog> | null>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);
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

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [paymentType, setPaymentType] = useState<'cash' | 'credit'>('credit');
  const [paymentMethodId, setPaymentMethodId] = useState<string | ''>('');
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    if (user) {
      const unsubInvoices = dbService.subscribe<Invoice>('invoices', user.company_id, setInvoices);
      const unsubCustomers = dbService.subscribe<Customer>('customers', user.company_id, setCustomers);
      const unsubProducts = dbService.subscribe<Product>('products', user.company_id, setProducts);
      const unsubPM = dbService.subscribe<any>('payment_methods', user.company_id, setPaymentMethods);
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
        unsubInvoices();
        unsubCustomers();
        unsubProducts();
        unsubPM();
        unsubAccounts();
      };
    }
  }, [user]);

  const generateInvoiceNumber = (dateStr: string) => {
    const month = dateStr.split('-')[1];
    const monthInvoices = invoices.filter(inv => inv.date.startsWith(dateStr.slice(0, 7)));
    
    // Find the highest sequence number for this month
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
    return `INV-${month}-${nextNumber.toString().padStart(5, '0')}`;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportInvoicePDF = (invoice: Invoice) => {
    if (invoiceRef.current) {
      exportToPDFUtil(invoiceRef.current, {
        filename: `Invoice_${invoice.invoice_number}`,
        reportTitle: `فاتورة مبيعات رقم ${invoice.invoice_number}`,
        orientation: 'portrait'
      });
    }
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
      setInvoiceNumber(generateInvoiceNumber(date));
    }
  }, [date, invoices, isModalOpen, editingInvoice, user]);

  useEffect(() => {
    if (!isModalOpen || !user) {
      setPreviewJournalEntry(null);
      setPreviewActivityLog(null);
      return;
    }

    const generatePreview = () => {
      const subtotal = (items || []).reduce((sum, item) => sum + item.total, 0);
      const total_amount = subtotal - discount;
      if (subtotal <= 0) {
        setPreviewJournalEntry(null);
        setPreviewActivityLog(null);
        return;
      }

      const customer = customers.find(c => c.id === selectedCustomerId);
      const invoice_number = editingInvoice?.invoice_number || 'INV-PREVIEW';

      // Preview Activity Log
      setPreviewActivityLog({
        action: editingInvoice ? 'تعديل فاتورة' : 'إضافة فاتورة',
        details: editingInvoice 
          ? `تعديل فاتورة رقم: ${invoice_number} للعميل ${customer?.name || '...'}`
          : `إضافة فاتورة جديدة للعميل ${customer?.name || '...'} بمبلغ ${total_amount.toLocaleString()}`,
        timestamp: new Date().toISOString()
      });

      // Preview Journal Entry
      const journalItems: JournalEntryItem[] = [];

      // Debit: Customer or Payment Method
      let debitAccountId = '';
      let debitAccountName = '';

      if (paymentType === 'cash') {
        const pm = paymentMethods.find(p => p.id === paymentMethodId);
        debitAccountId = pm?.account_id || '';
        debitAccountName = pm?.account_name || '';
        
        if (!debitAccountId) {
          const fallbackAccount = accounts.find(a => 
            a.name.includes('نقدية') || a.name.includes('خزينة') || a.name.includes('صندوق')
          );
          debitAccountId = fallbackAccount?.id || 'cash_account_default';
          debitAccountName = fallbackAccount?.name || 'حساب النقدية (افتراضي)';
        }
      } else {
        debitAccountId = customer?.account_id || '';
        debitAccountName = customer?.account_name || '';
        
        if (!debitAccountId) {
          const fallbackAccount = accounts.find(a => a.name.includes('عملاء'));
          debitAccountId = fallbackAccount?.id || 'customers_account_default';
          debitAccountName = fallbackAccount?.name || 'حساب العملاء (افتراضي)';
        }
      }

      journalItems.push({
        account_id: debitAccountId,
        account_name: debitAccountName,
        debit: total_amount,
        credit: 0,
        description: `فاتورة مبيعات رقم ${invoice_number} - ${customer?.name || '...'}`
      });

      // Debit: Discount Account (if any)
      if (discount > 0) {
        const discountAccount = accounts.find(a => a.id === settings?.customer_discount_account_id) || 
                                accounts.find(a => a.name.includes('خصم مسموح به') || a.name.includes('خصم مبيعات'));
        journalItems.push({
          account_id: discountAccount?.id || 'sales_discount_default',
          account_name: discountAccount?.name || 'حساب الخصم المسموح به (افتراضي)',
          debit: discount,
          credit: 0,
          description: `خصم مسموح به - فاتورة رقم ${invoice_number}`
        });
      }

      // Credit: Sales Accounts (per product)
      (items || []).forEach(item => {
        const product = products.find(p => p.id === item.product_id);
        let creditAccountId = product?.revenue_account_id || '';
        let creditAccountName = product?.revenue_account_name || '';

        if (!creditAccountId) {
          const fallbackAccount = accounts.find(a => 
            a.name.includes('مبيعات') || a.name.includes('إيراد')
          );
          creditAccountId = fallbackAccount?.id || 'sales_account_default';
          creditAccountName = fallbackAccount?.name || 'حساب المبيعات (افتراضي)';
        }

        journalItems.push({
          account_id: creditAccountId,
          account_name: creditAccountName,
          debit: 0,
          credit: item.total,
          description: `مبيعات صنف: ${item.product_name} - فاتورة ${invoice_number}`
        });
      });

      setPreviewJournalEntry({
        id: 'preview',
        date,
        reference_number: invoice_number,
        reference_id: 'preview',
        reference_type: 'invoice',
        description: `قيد فاتورة مبيعات رقم ${invoice_number}`,
        items: journalItems,
        total_debit: total_amount,
        total_credit: total_amount,
        company_id: user.company_id,
        created_at: new Date().toISOString(),
        created_by: user.id
      });
    };

    generatePreview();
  }, [isModalOpen, items, discount, selectedCustomerId, paymentType, paymentMethodId, date, user, customers, products, paymentMethods, accounts, editingInvoice, settings]);

  const addItem = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    setItems(prev => [...prev, {
      product_id: product.id,
      product_name: product.name,
      product_code: product.code,
      product_image_url: product.image_url,
      quantity: 1,
      unit_price: product.sale_price,
      total: product.sale_price
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

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    setItems(prev => {
      const newItems = [...prev];
      const item = { ...newItems[index], [field]: value };
      
      if (field === 'product_id') {
        const product = products.find(p => p.id === value);
        if (product) {
          item.product_name = product.name;
          item.product_image_url = product.image_url;
          item.unit_price = product.sale_price;
          item.total = (item.quantity || 0) * (item.unit_price || 0);
        } else {
          item.product_name = '';
          item.product_image_url = '';
          item.unit_price = 0;
          item.total = 0;
        }
      }
      
      if (field === 'quantity' || field === 'unit_price') {
        item.total = (item.quantity || 0) * (item.unit_price || 0);
      }
      
      newItems[index] = item;
      return newItems;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!selectedCustomerId) {
      showNotification('يرجى اختيار العميل', 'error');
      return;
    }
    
    const validItems = items.filter(item => item.product_id);
    if (validItems.length === 0) {
      showNotification('يرجى إضافة أصناف مكتملة للفاتورة', 'error');
      return;
    }

    if (paymentType === 'cash' && !paymentMethodId) {
      showNotification('يرجى اختيار طريقة السداد النقدي', 'error');
      return;
    }

    try {
      const subtotal = validItems.reduce((sum, item) => sum + item.total, 0);
      const total_amount = subtotal - discount;
      const customer = customers.find(c => c.id === selectedCustomerId);
      const paymentMethod = paymentMethods.find(pm => pm.id === paymentMethodId);
      
      const invoiceData = { 
        customer_id: selectedCustomerId, 
        customer_name: customer?.name || '',
        date, 
        items: validItems,
        subtotal,
        discount,
        total_amount,
        payment_type: paymentType,
        payment_method_id: paymentType === 'cash' ? paymentMethodId : null,
        payment_method_name: paymentType === 'cash' ? (paymentMethod?.name || '') : null,
        company_id: user.company_id
      };

      let id = editingInvoice?.id;
      if (editingInvoice) {
        const fieldsToTrack = [
          { field: 'invoice_number', label: 'رقم الفاتورة' },
          { field: 'customer_id', label: 'العميل' },
          { field: 'date', label: 'التاريخ' },
          { field: 'total_amount', label: 'المبلغ الإجمالي' },
          { field: 'payment_type', label: 'نوع الدفع' },
          { field: 'payment_method_id', label: 'طريقة الدفع' }
        ];
        await dbService.updateWithLog(
          'invoices', 
          editingInvoice.id, 
          { ...invoiceData, invoice_number: invoiceNumber }, 
          { id: user.id, username: user.username, company_id: user.company_id },
          'تعديل فاتورة',
          'invoices',
          fieldsToTrack
        );
      } else {
        id = await dbService.add('invoices', { ...invoiceData, invoice_number: invoiceNumber });
      }

      // Create/Update Journal Entry
      const journalItems: JournalEntryItem[] = [];

      // ALWAYS Debit: Customer Account first (for the invoice part)
      let customerAccountId = customer?.account_id || '';
        let customerAccountName = customer?.account_name || '';
        
        if (!customerAccountId) {
          const fallbackAccount = accounts.find(a => a.name.includes('عملاء'));
          customerAccountId = fallbackAccount?.id || 'customers_account_default';
          customerAccountName = fallbackAccount?.name || 'حساب العملاء (افتراضي)';
        }

        // Line 1: Dr. Customer
        journalItems.push({
          account_id: customerAccountId,
          account_name: customerAccountName,
          debit: total_amount,
          credit: 0,
          description: `فاتورة مبيعات رقم ${invoiceNumber} - ${customer?.name}`,
          customer_id: selectedCustomerId,
          customer_name: customer?.name
        });

        // Line 1.5: Dr. Discount Account (if any)
        if (discount > 0) {
          const discountAccount = accounts.find(a => a.id === settings?.customer_discount_account_id) || 
                                  accounts.find(a => a.name.includes('خصم مسموح به') || a.name.includes('خصم مبيعات'));
          journalItems.push({
            account_id: discountAccount?.id || 'sales_discount_default',
            account_name: discountAccount?.name || 'حساب الخصم المسموح به (افتراضي)',
            debit: discount,
            credit: 0,
            description: `خصم مسموح به - فاتورة رقم ${invoiceNumber}`
          });
        }

        // Line 2: Cr. Sales Accounts (per product)
        (items || []).forEach(item => {
          const product = products.find(p => p.id === item.product_id);
          let creditAccountId = product?.revenue_account_id || '';
          let creditAccountName = product?.revenue_account_name || '';

          if (!creditAccountId) {
            // Fallback: Try to find a sales/revenue account
            const fallbackAccount = accounts.find(a => 
              a.name.includes('مبيعات') || a.name.includes('إيراد')
            );
            creditAccountId = fallbackAccount?.id || 'sales_account_default';
            creditAccountName = fallbackAccount?.name || 'حساب المبيعات (افتراضي)';
          }

          journalItems.push({
            account_id: creditAccountId,
            account_name: creditAccountName,
            debit: 0,
            credit: item.total,
            description: `مبيعات صنف: ${item.product_name} - فاتورة ${invoiceNumber}`
          });
        });

        // If Cash, add the payment lines (Dr. Cash / Cr. Customer)
        if (paymentType === 'cash') {
          const pm = paymentMethods.find(p => p.id === paymentMethodId);
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

          // Line 3: Dr. Cash/Bank
          journalItems.push({
            account_id: cashAccountId,
            account_name: cashAccountName,
            debit: total_amount,
            credit: 0,
            description: `تحصيل فاتورة مبيعات رقم ${invoiceNumber} - ${customer?.name}`
          });

          // Line 4: Cr. Customer
          journalItems.push({
            account_id: customerAccountId,
            account_name: customerAccountName,
            debit: 0,
            credit: total_amount,
            description: `سداد فاتورة مبيعات رقم ${invoiceNumber} - ${customer?.name}`,
            customer_id: selectedCustomerId,
            customer_name: customer?.name
          });
        }

        if (journalItems.length > 0 && id) {
          const journalEntryData: Omit<JournalEntry, 'id'> = {
            date,
            reference_number: invoiceNumber,
            reference_id: id,
            reference_type: 'invoice',
            description: t('invoices.journal_description', { number: invoiceNumber }),
            items: journalItems,
            total_debit: journalItems.reduce((sum, item) => sum + item.debit, 0),
            total_credit: journalItems.reduce((sum, item) => sum + item.credit, 0),
            company_id: user.company_id,
            created_at: new Date().toISOString(),
            created_by: user.id
          };

          const existingEntry = await dbService.getJournalEntryByReference(id, user.company_id);
          if (existingEntry) {
            await dbService.updateJournalEntry(existingEntry.id, journalEntryData);
          } else {
            await dbService.createJournalEntry(journalEntryData);
          }
        }

        if (!editingInvoice && id) {
          await dbService.logActivity(user.id, user.username, user.company_id, t('invoices.log_add'), t('invoices.log_add_msg', { number: invoiceNumber }), 'invoices', id);
        }
      closeModal();
      showNotification(editingInvoice ? t('invoices.invoice_updated') : t('invoices.invoice_saved'));
    } catch (e) {
      console.error(e);
      showNotification(t('common.server_error'), 'error');
    }
  };

  const handleDelete = async (id: string) => {
    setInvoiceToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!invoiceToDelete || !user) return;
    try {
      const invoice = invoices.find(inv => inv.id === invoiceToDelete);
      await dbService.delete('invoices', invoiceToDelete);
      await dbService.deleteJournalEntryByReference(invoiceToDelete, user.company_id);
      await dbService.logActivity(user.id, user.username, user.company_id, t('invoices.log_delete'), t('invoices.log_delete_msg', { number: invoice?.invoice_number }), 'invoices', invoiceToDelete);
      setIsDeleteModalOpen(false);
      setInvoiceToDelete(null);
    } catch (e) {
      console.error(e);
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

      await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة عميل', `إضافة عميل جديد من الفاتورة: ${customerFormData.name}`, ['customers', 'invoices']);
      
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
      const revenueAccount = accounts.find(a => a.id === productFormData.revenue_account_id);
      const costAccount = accounts.find(a => a.id === productFormData.cost_account_id);
      
      const newProduct = {
        ...productFormData,
        revenue_account_name: revenueAccount?.name || '',
        cost_account_name: costAccount?.name || '',
        company_id: user.company_id
      };
      const productId = await dbService.add('products', newProduct);
      await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة صنف', `إضافة صنف جديد من الفاتورة: ${productFormData.name}`, ['products', 'invoices']);
      
      addItem(productId);
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

  const handlePaymentMethodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const selectedAccount = accounts.find(a => a.id === paymentMethodFormData.account_id);
      const newPaymentMethod = {
        ...paymentMethodFormData,
        account_name: selectedAccount?.name || '',
        company_id: user.company_id
      };
      const pmId = await dbService.add('payment_methods', newPaymentMethod);
      await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة طريقة دفع', `إضافة طريقة دفع جديدة من الفاتورة: ${paymentMethodFormData.name}`, ['payment_methods', 'invoices'], pmId);
      
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

      setPaymentMethodId(pmId);
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

  const exportToPDF = async (invoice: Invoice) => {
    const element = invoiceRef.current;
    if (!element || !viewInvoice) {
      showNotification('حدث خطأ أثناء تحميل الفاتورة', 'error');
      return;
    }
    
    try {
      await exportToPDFUtil(element, {
        filename: `Invoice-${viewInvoice.invoice_number}.pdf`,
        margin: 10,
        orientation: 'portrait',
        reportTitle: `فاتورة مبيعات رقم ${viewInvoice.invoice_number}`
      });
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء تصدير PDF', 'error');
    }
  };

  const handleExportExcel = () => {
    const formattedData = formatDataForExcel(filteredInvoices, {
      'invoice_number': 'رقم الفاتورة',
      'customer_name': 'العميل',
      'date': 'التاريخ',
      'total_amount': 'المبلغ الإجمالي',
      'payment_type': 'طريقة الدفع'
    });
    exportToExcel(formattedData, { filename: 'Invoices_Report', sheetName: 'الفواتير' });
  };

  const handleExportPDF = async () => {
    if (tableRef.current) {
      await exportToPDFUtil(tableRef.current, { 
        filename: 'Invoices_Report', 
        orientation: 'landscape',
        reportTitle: 'قائمة الفواتير'
      });
    }
  };

  const openModal = () => {
    setEditingInvoice(null);
    setSelectedCustomerId('');
    const newDate = new Date().toISOString().slice(0, 10);
    setDate(newDate);
    setInvoiceNumber(generateInvoiceNumber(newDate));
    setItems([]);
    setPaymentType('credit');
    setPaymentMethodId('');
    setIsModalOpen(true);
    setIsFullScreen(false);
  };

  const handleViewInvoice = (invoice: Invoice) => {
    setViewInvoice(invoice);
  };

  const openEditModal = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setSelectedCustomerId(invoice.customer_id);
    setDate(invoice.date);
    setInvoiceNumber(invoice.invoice_number);
    setItems(invoice.items || []);
    setDiscount(invoice.discount || 0);
    setPaymentType(invoice.payment_type || 'credit');
    setPaymentMethodId(invoice.payment_method_id || '');
    setIsModalOpen(true);
    setIsFullScreen(false);
  };

  const handleNextInvoice = () => {
    if (!editingInvoice) return;
    const currentIndex = invoices.findIndex(inv => inv.id === editingInvoice.id);
    if (currentIndex < invoices.length - 1) {
      openEditModal(invoices[currentIndex + 1]);
    }
  };

  const handlePrevInvoice = () => {
    if (!editingInvoice) return;
    const currentIndex = invoices.findIndex(inv => inv.id === editingInvoice.id);
    if (currentIndex > 0) {
      openEditModal(invoices[currentIndex - 1]);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingInvoice(null);
    setSelectedCustomerId('');
    setDate(new Date().toISOString().slice(0, 10));
    setItems([]);
    setDiscount(0);
    setPaymentType('credit');
    setPaymentMethodId('');
    setIsFullScreen(false);
  };

  const filteredInvoices = invoices.filter(i => 
    i.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-zinc-500 gap-4">
        <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-400">
          <Lock size={40} />
        </div>
        <h3 className="text-xl font-bold">عذراً، ليس لديك صلاحية للوصول إلى هذه الصفحة</h3>
        <p className="text-sm">يرجى التواصل مع مدير النظام للحصول على الصلاحيات اللازمة.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">{t('invoices.title')}</h2>
          <p className="text-zinc-500">{t('invoices.subtitle')}</p>
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
          {canCreate && (
            <button 
              onClick={openModal}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-200"
            >
              <Plus size={20} />
              {t('invoices.add_invoice')}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-50 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className={`absolute ${dir === 'rtl' ? 'left-3' : 'right-3'} top-3 text-zinc-400`} size={18} />
            <input
              type="text"
              placeholder={t('invoices.search_placeholder')}
              className={`w-full ${dir === 'rtl' ? 'pl-10 pr-4' : 'pr-10 pl-4'} py-2 bg-zinc-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div ref={tableRef} id="invoices-list-table" className="overflow-x-auto hidden md:block">
          <table className="w-full">
            <thead>
              <tr className="bg-zinc-50/50 text-zinc-500 text-xs uppercase tracking-wider">
                <th className={`px-6 py-4 font-bold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('invoices.column_number')}</th>
                <th className={`px-6 py-4 font-bold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('invoices.column_customer')}</th>
                <th className={`px-6 py-4 font-bold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('invoices.column_date')}</th>
                <th className={`px-6 py-4 font-bold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('invoices.column_amount')}</th>
                <th className={`px-6 py-4 font-bold ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>{t('invoices.column_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-zinc-50/50 transition-colors group">
                  <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                    <span className="font-mono text-xs bg-emerald-50 px-2 py-1 rounded text-emerald-700 font-bold">{inv.invoice_number}</span>
                  </td>
                  <td className={`px-6 py-4 font-bold text-zinc-900 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{inv.customer_name}</td>
                  <td className={`px-6 py-4 text-zinc-500 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{inv.date}</td>
                  <td className={`px-6 py-4 font-bold text-zinc-900 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{inv.total_amount.toLocaleString()} {t('invoices.currency')}</td>
                  <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>
                    <div className={`flex items-center ${dir === 'rtl' ? 'justify-start' : 'justify-end'} gap-2 opacity-0 group-hover:opacity-100 transition-opacity`}>
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
                        onClick={() => handleViewInvoice(inv)}
                        className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all no-pdf"
                        title={t('common.view')}
                      >
                        <Eye size={18} />
                      </button>
                      {canEdit && (
                        <button 
                          onClick={() => openEditModal(inv)}
                          className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all no-pdf"
                          title={t('common.edit')}
                        >
                          <Pencil size={18} />
                        </button>
                      )}
                      {canDelete && (
                        <button 
                          onClick={() => handleDelete(inv.id)}
                          className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all no-pdf"
                          title={t('common.delete')}
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredInvoices.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-500 italic">{t('common.no_data')}</td>
                </tr>
              )}
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
                  <h4 className="font-bold text-zinc-900 text-lg">{inv.customer_name}</h4>
                </div>
                <div className={`${dir === 'rtl' ? 'text-left' : 'text-right'}`}>
                  <p className="font-bold text-emerald-600 text-lg">{inv.total_amount.toLocaleString()} {t('invoices.currency')}</p>
                  <span className="text-xs text-zinc-400">{inv.date}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button 
                  onClick={() => handleViewInvoice(inv)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-zinc-50 text-zinc-600 rounded-2xl text-sm font-bold border border-zinc-100 active:scale-95 transition-transform"
                >
                  <Eye size={18} /> عرض
                </button>
                {canEdit && (
                  <button 
                    onClick={() => openEditModal(inv)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-50 text-blue-600 rounded-2xl text-sm font-bold border border-blue-100 active:scale-95 transition-transform"
                  >
                    <Pencil size={18} /> تعديل
                  </button>
                )}
                {canDelete && (
                  <button 
                    onClick={() => handleDelete(inv.id)}
                    className="p-3 bg-red-50 text-red-600 rounded-2xl border border-red-100 active:scale-95 transition-transform"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <div className={`fixed inset-0 z-[60] flex items-center justify-center ${isFullScreen ? 'p-0' : 'md:p-4'} bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200`}>
          <div className={`bg-white w-full h-full ${isFullScreen ? 'md:h-full md:max-w-none md:rounded-none' : 'md:h-auto md:max-w-6xl md:rounded-3xl'} shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col ${isFullScreen ? 'md:max-h-none' : 'md:max-h-[90vh]'}`}>
            <div className="p-4 md:p-6 border-b border-zinc-50 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-4">
                <h3 className="text-lg md:text-xl font-bold text-zinc-900">{editingInvoice ? 'تعديل الفاتورة' : 'إنشاء فاتورة جديدة'}</h3>
                {editingInvoice && (
                  <div className="flex items-center gap-2 bg-zinc-100 p-1 rounded-xl">
                    <button 
                      type="button"
                      onClick={handlePrevInvoice}
                      className="flex items-center gap-1 px-3 py-1.5 hover:bg-white rounded-lg transition-all text-zinc-600 disabled:opacity-30 text-xs font-bold"
                      disabled={invoices.findIndex(inv => inv.id === editingInvoice.id) === 0}
                    >
                      <ChevronRight size={16} />
                      السابق
                    </button>
                    <button 
                      type="button"
                      onClick={handleNextInvoice}
                      className="flex items-center gap-1 px-3 py-1.5 hover:bg-white rounded-lg transition-all text-zinc-600 disabled:opacity-30 text-xs font-bold"
                      disabled={invoices.findIndex(inv => inv.id === editingInvoice.id) === invoices.length - 1}
                    >
                      التالي
                      <ChevronLeft size={16} />
                    </button>
                  </div>
                )}
                <button 
                  type="button"
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="hidden md:flex p-2 hover:bg-zinc-100 rounded-xl transition-all text-zinc-600"
                >
                  {isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                </button>
                <button 
                  type="button"
                  onClick={() => setShowSidePanel(!showSidePanel)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${showSidePanel ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-zinc-100 text-zinc-600 border border-zinc-200 hover:bg-zinc-200'}`}
                >
                  <History size={14} />
                  قيد اليومية \ سجل التعديلات
                </button>
              </div>
              <button onClick={closeModal} className="p-2 text-zinc-400 hover:text-zinc-600"><X size={24} /></button>
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
                          category="invoices" 
                          previewJournalEntry={previewJournalEntry}
                          previewActivityLog={previewActivityLog}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex-1 p-4 md:p-6 space-y-6 overflow-y-auto pb-32 md:pb-6">
                <div className="space-y-6">
                  {/* AI Tools */}
                  <SmartAIInput 
                    onDataExtracted={applyAiData}
                    transactionType="sales_invoice"
                  />

                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                      <div>
                        <label className="block text-xs md:text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('invoices.column_number')}</label>
                        <input
                          required
                          type="text"
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-base font-mono"
                          value={invoiceNumber}
                          onChange={(e) => setInvoiceNumber(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs md:text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('invoices.form_customer')}</label>
                        <select 
                          required
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-base"
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
                          {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          <option value="new_customer" className="font-bold text-emerald-600">+ {t('customers.add')}</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs md:text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('invoices.form_date')}</label>
                        <input
                          required
                          type="date"
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-base"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                      <div>
                        <label className="block text-xs md:text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('invoices.form_payment_type')}</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button 
                            type="button"
                            onClick={() => setPaymentType('cash')}
                            className={`py-3 rounded-xl font-bold transition-all ${paymentType === 'cash' ? 'bg-zinc-900 text-white shadow-lg' : 'bg-zinc-50 text-zinc-500 border border-zinc-200 hover:bg-zinc-100'}`}
                          >
                            {t('invoices.payment_cash')}
                          </button>
                          <button 
                            type="button"
                            onClick={() => setPaymentType('credit')}
                            className={`py-3 rounded-xl font-bold transition-all ${paymentType === 'credit' ? 'bg-zinc-900 text-white shadow-lg' : 'bg-zinc-50 text-zinc-500 border border-zinc-200 hover:bg-zinc-100'}`}
                          >
                            {t('invoices.payment_credit')}
                          </button>
                        </div>
                      </div>

                      {paymentType === 'cash' && (
                        <div>
                          <label className="block text-xs md:text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">{t('invoices.form_payment_method')}</label>
                          <select 
                            required
                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-base"
                            value={paymentMethodId}
                            onChange={(e) => {
                              if (e.target.value === 'new_payment_method') {
                                setIsPaymentMethodModalOpen(true);
                              } else {
                                setPaymentMethodId(e.target.value);
                              }
                            }}
                          >
                            <option value="">{t('common.select_method')}</option>
                            {paymentMethods.map(pm => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
                            <option value="new_payment_method" className="font-bold text-emerald-600">+ {t('payment_methods.add')}</option>
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-zinc-900 text-lg">{t('invoices.form_items')}</h4>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={addEmptyRow}
                            className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-sm font-bold hover:bg-emerald-100 transition-colors flex items-center gap-2"
                          >
                            <Plus size={16} />
                            {t('invoices.add_item')}
                          </button>
                          <select 
                            className="px-4 py-2 bg-zinc-100 rounded-xl text-sm font-bold text-zinc-600 outline-none"
                            onChange={(e) => {
                              if (e.target.value === 'new_product') {
                                setIsProductModalOpen(true);
                              } else if (e.target.value) {
                                addItem(e.target.value);
                              }
                              e.target.value = "";
                            }}
                          >
                            <option value="">+ {t('common.select_product')}</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sale_price} {t('invoices.currency')})</option>)}
                            <option value="new_product" className="font-bold text-emerald-600">+ {t('products.add')}</option>
                          </select>
                        </div>
                      </div>

                      <div className="border border-zinc-100 rounded-2xl overflow-hidden overflow-x-auto">
                        <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'} text-sm min-w-[400px]`}>
                          <thead className="bg-zinc-50 text-zinc-500 uppercase text-[9px] font-bold tracking-widest">
                            <tr>
                              <th className="px-1 py-1 w-12 text-center">{t('products.column_image')}</th>
                              <th className="px-1 py-1">{t('invoices.column_product')}</th>
                              <th className="px-1 py-1 w-16 text-center">{t('invoices.column_quantity')}</th>
                              <th className="px-1 py-1 w-24 text-center">{t('invoices.column_price')}</th>
                              <th className={`px-1 py-1 w-24 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>{t('invoices.column_total')}</th>
                              <th className="px-1 py-1 w-8"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-50">
                            {items.map((item, index) => (
                              <tr key={index} className="hover:bg-zinc-50/50 transition-colors group">
                                <td className="px-1 py-0.5 text-center">
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
                                <td className="px-1 py-0.5">
                                  <select 
                                    className="w-full bg-transparent outline-none font-bold text-zinc-900 appearance-none cursor-pointer text-xs"
                                    value={item.product_id}
                                    onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                                  >
                                    <option value="">{t('common.select_product')}</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                  </select>
                                </td>
                                <td className="px-1 py-0.5">
                                  <input 
                                    type="number" 
                                    className="w-full bg-zinc-50 border border-zinc-100 rounded focus:ring-1 focus:ring-emerald-500 px-1 py-0.5 text-xs outline-none text-center font-mono"
                                    value={isNaN(item.quantity) ? '' : item.quantity}
                                    onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                  />
                                </td>
                                <td className="px-1 py-0.5">
                                  <input 
                                    type="number" 
                                    className="w-full bg-zinc-50 border border-zinc-100 rounded focus:ring-1 focus:ring-emerald-500 px-1 py-0.5 text-xs outline-none text-center font-mono"
                                    value={isNaN(item.unit_price) ? '' : item.unit_price}
                                    onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                                  />
                                </td>
                                <td className="px-1 py-0.5 text-left font-mono font-bold text-zinc-900 text-xs">
                                  {item.total.toLocaleString()}
                                </td>
                                <td className="px-1 py-0.5 text-center">
                                  <button 
                                    onClick={() => removeItem(index)}
                                    className="p-1 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded transition-all opacity-0 group-hover:opacity-100"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {items.length === 0 && (
                              <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-zinc-400 italic">لا توجد أصناف مضافة بعد.</td>
                              </tr>
                            )}
                          </tbody>
                      <tfoot className="bg-zinc-50/50 font-bold">
                        <tr>
                          <td colSpan={3} className={`px-2 py-2 ${dir === 'rtl' ? 'text-left' : 'text-right'} text-zinc-500`}>{t('invoices.summary_subtotal')}:</td>
                          <td className="px-2 py-2 text-base text-zinc-900 font-mono">{items.reduce((sum, i) => sum + i.total, 0).toLocaleString()}</td>
                          <td></td>
                        </tr>
                        <tr>
                          <td colSpan={3} className={`px-2 py-2 ${dir === 'rtl' ? 'text-left' : 'text-right'} text-zinc-500 flex items-center gap-2`}>
                            <span>{t('invoices.summary_discount')}:</span>
                            <input 
                              type="number" 
                              className="w-24 bg-white border border-zinc-200 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                              value={discount}
                              onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                            />
                          </td>
                          <td className="px-2 py-2 text-base text-red-600 font-mono">-{discount.toLocaleString()}</td>
                          <td></td>
                        </tr>
                        <tr>
                          <td colSpan={3} className={`px-2 py-2 ${dir === 'rtl' ? 'text-left' : 'text-right'} text-zinc-500`}>{t('invoices.summary_total')}:</td>
                          <td className="px-2 py-2 text-lg text-emerald-600 font-mono">{(items.reduce((sum, i) => sum + i.total, 0) - discount).toLocaleString()} {t('invoices.currency')}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                        </table>
                      </div>
                    </div>

                    <div className="pt-4 flex gap-4 sticky bottom-0 bg-white pb-4 md:pb-0">
                      <button 
                        type="button"
                        onClick={closeModal}
                        className="flex-1 py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all"
                      >
                        {t('common.cancel')}
                      </button>
                      <button 
                        type="submit"
                        className="flex-[2] py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                      >
                        {editingInvoice ? t('common.save') : t('common.save')}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewInvoice && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center md:p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full h-full md:h-auto md:max-w-6xl md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col md:max-h-[90vh]">
            <div className="p-4 md:p-6 border-b border-zinc-50 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg font-bold text-zinc-900">{t('invoices.view_invoice')}</h3>
              <button onClick={() => setViewInvoice(null)} className="p-2 text-zinc-400 hover:text-zinc-600"><X size={24} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row h-full">
              <div ref={invoiceRef} id="invoice-capture-area" className="flex-1 p-6 md:p-8 space-y-8 bg-white overflow-y-auto" style={{ color: '#18181b' }}>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-2xl md:text-3xl font-bold text-[#18181b] italic serif">{t('invoices.invoice')}</h3>
                    <p className="text-[#71717a] font-mono text-sm md:text-base">{viewInvoice.invoice_number}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <p className="text-xs font-bold text-[#a1a1aa] uppercase tracking-widest mb-1">{t('invoices.invoice_to')}</p>
                    <p className="text-xl font-bold text-[#18181b]">{viewInvoice.customer_name}</p>
                  </div>
                  <div className={dir === 'rtl' ? 'text-left' : 'text-right'}>
                    <p className="text-xs font-bold text-[#a1a1aa] uppercase tracking-widest mb-1">{t('invoices.column_date')}</p>
                    <p className="text-lg font-medium text-[#18181b]">{viewInvoice.date}</p>
                  </div>
                </div>

                <div className="border border-[#f4f4f5] rounded-2xl overflow-hidden">
                  <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'} text-sm`}>
                    <thead className="bg-[#fafafa] text-[#71717a] uppercase text-[10px] font-bold tracking-widest">
                      <tr>
                        <th className="px-4 py-3 w-16 text-center">{t('products.column_image')}</th>
                        <th className="px-4 py-3">{t('invoices.column_product')}</th>
                        <th className="px-4 py-3 w-24">{t('invoices.column_quantity')}</th>
                        <th className="px-4 py-3 w-32">{t('invoices.column_price')}</th>
                        <th className="px-4 py-3 w-32">{t('invoices.column_total')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#fafafa]">
                      {viewInvoice.items?.map((item, index) => (
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
                          <td className="px-4 py-3 text-[#71717a]">{item.unit_price.toLocaleString()} {t('invoices.currency')}</td>
                          <td className="px-4 py-3 font-bold text-[#18181b]">{item.total.toLocaleString()} {t('invoices.currency')}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-[#fafafa] font-bold text-sm">
                      <tr>
                        <td colSpan={3} className={`px-4 py-2 ${dir === 'rtl' ? 'text-left' : 'text-right'} text-[#71717a]`}>{t('invoices.summary_subtotal')}:</td>
                        <td className="px-4 py-2 text-[#18181b]">{viewInvoice.subtotal?.toLocaleString()} {t('invoices.currency')}</td>
                      </tr>
                      {viewInvoice.discount > 0 && (
                        <tr>
                          <td colSpan={3} className={`px-4 py-2 ${dir === 'rtl' ? 'text-left' : 'text-right'} text-[#71717a]`}>{t('invoices.summary_discount')}:</td>
                          <td className="px-4 py-2 text-red-600">-{viewInvoice.discount.toLocaleString()} {t('invoices.currency')}</td>
                        </tr>
                      )}
                      <tr className="text-lg bg-[#f4f4f5]">
                        <td colSpan={3} className={`px-4 py-3 ${dir === 'rtl' ? 'text-left' : 'text-right'} text-[#18181b]`}>{t('invoices.summary_total')}:</td>
                        <td className="px-4 py-3 text-[#18181b]">{viewInvoice.total_amount?.toLocaleString()} {t('invoices.currency')}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="hidden lg:block w-80 border-r border-zinc-100 bg-zinc-50/30">
                <InlineActivityLog category="invoices" documentId={viewInvoice.id} />
              </div>
            </div>
            
            <div className="p-4 md:p-6 border-t border-zinc-50 flex items-center justify-between bg-zinc-50/50">
              <div className="flex gap-2">
                <button 
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-6 py-3 bg-white text-zinc-700 border border-zinc-200 rounded-2xl font-bold hover:bg-zinc-50 transition-all active:scale-95 shadow-sm"
                >
                  <Printer size={20} />
                  طباعة
                </button>
                <button 
                  onClick={() => handleExportInvoicePDF(viewInvoice)}
                  className="flex items-center gap-2 px-6 py-3 bg-white text-zinc-700 border border-zinc-200 rounded-2xl font-bold hover:bg-zinc-50 transition-all active:scale-95 shadow-sm"
                >
                  <Download size={20} />
                  PDF
                </button>
              </div>
              <button 
                onClick={() => setViewInvoice(null)}
                className="px-8 py-3 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all active:scale-95 shadow-lg shadow-zinc-200"
              >
                إغلاق
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
              <h3 className="text-lg md:text-xl font-bold text-zinc-900">إضافة عميل جديد</h3>
              <button onClick={() => setIsCustomerModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 p-2 hover:bg-zinc-100 rounded-xl transition-all"><X size={24} /></button>
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              <form onSubmit={handleCustomerSubmit} className="p-4 md:p-8 space-y-5 flex-1 overflow-y-auto pb-32 md:pb-8">
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">اسم العميل</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <input
                        required
                        type="text"
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={customerFormData.name}
                        onChange={(e) => setCustomerFormData({ ...customerFormData, name: e.target.value })}
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
                        value={customerFormData.mobile}
                        onChange={(e) => setCustomerFormData({ ...customerFormData, mobile: e.target.value })}
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
                        value={customerFormData.email}
                        onChange={(e) => setCustomerFormData({ ...customerFormData, email: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">العنوان</label>
                    <textarea
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      rows={2}
                      value={customerFormData.address}
                      onChange={(e) => setCustomerFormData({ ...customerFormData, address: e.target.value })}
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
                          value={customerFormData.opening_balance}
                          onChange={(e) => setCustomerFormData({ ...customerFormData, opening_balance: Number(e.target.value) })}
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
                          value={customerFormData.opening_balance_date}
                          onChange={(e) => setCustomerFormData({ ...customerFormData, opening_balance_date: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">الحساب المحاسبي</label>
                    <select
                      required
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={customerFormData.account_id}
                      onChange={(e) => setCustomerFormData({ ...customerFormData, account_id: e.target.value })}
                    >
                      <option value="">اختر الحساب...</option>
                      {accounts.map(account => (
                        <option key={account.id} value={account.id}>
                          {account.code} - {account.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {customerFormData.opening_balance !== 0 && (
                    <div className="animate-in slide-in-from-top-2 duration-200">
                      <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">حساب مقابل رصيد أول المدة</label>
                      <select
                        required
                        className="w-full px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                        value={customerFormData.counter_account_id}
                        onChange={(e) => setCustomerFormData({ ...customerFormData, counter_account_id: e.target.value })}
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
                    حفظ العميل
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsCustomerModalOpen(false)}
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
                        id="invoice-product-attachment"
                      />
                      <label 
                        htmlFor="invoice-product-attachment"
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
                    {productFormData.barcode && (
                      <div className="mt-2 flex justify-center bg-white p-2 rounded-lg border border-zinc-100 overflow-hidden">
                        <Barcode 
                          value={productFormData.barcode} 
                          width={1} 
                          height={40} 
                          fontSize={10}
                          background="transparent"
                        />
                      </div>
                    )}
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
        category="invoices" 
        isOpen={isActivityLogOpen} 
        onClose={() => {
          setIsActivityLogOpen(false);
          setActivityLogDocumentId(undefined);
        }} 
        documentId={activityLogDocumentId}
      />
    </div>
  );
};
