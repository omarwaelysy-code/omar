import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Customer, Account, JournalEntry, AttachmentItem } from '../types';
import { getDefaultAccount, getCompatibleAccounts, useDefaultAccounts } from '../utils/defaultAccountsHelper';
import { 
  Search, Plus, Edit2, Trash2, X, History, FileText, User, 
  Hash, Box, Wallet, Calendar, Phone, Mail, MapPin, Lock,
  LayoutGrid, List, ChevronRight, ChevronLeft, AlertCircle, CreditCard, FileUp, Paperclip, Building2,
  Eye, ChevronDown, CheckSquare, Square
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { dbService } from '../services/dbService';
import { PageActivityLog } from '../components/PageActivityLog';
import { InlineActivityLog } from '../components/InlineActivityLog';
import { JournalEntryPreview } from '../components/JournalEntryPreview';
import { ExportButtons } from '../components/ExportButtons';
import { exportToExcel, formatDataForExcel } from '../utils/excelUtils';
import { exportToPDF as exportToPDFUtil, printElement } from '../utils/pdfUtils';
import { useRef } from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { formatNumber } from '../utils/formatUtils';
import { useViewPreference } from '../hooks/useViewPreference';
import { FormattedNumberInput } from '../components/FormattedNumberInput';
import { ExcelImportWizard } from '../components/ExcelImportWizard';
import { AttachmentsManager } from '../components/common/AttachmentsManager';

export const Customers: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { showNotification } = useNotification();
  const { canView, canCreate, canEdit, canDelete } = usePermissions('customers');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const { defaultAccountMap } = useDefaultAccounts(user?.company_id);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [activityLogDocumentId, setActivityLogDocumentId] = useState<string | undefined>(undefined);
  const tableRef = useRef<HTMLTableElement>(null);
  const [view, setView] = useViewPreference('customers', 'table');
  const [showImportWizard, setShowImportWizard] = useState(false);

  // Column Visibility & Selection
  const DEFAULT_CUSTOMER_COLUMNS: { [key: string]: boolean } = {
    code: true,
    manual_code: true,
    name: true,
    mobile: true,
    payment_method: true,
    tax_number: true,
    commercial_register: true,
    credit_limit: true,
    status: true,
    current_balance: true
  };

  const [visibleColumns, setVisibleColumns] = useState<{ [key: string]: boolean }>(() => {
    try {
      const saved = localStorage.getItem('customers_visible_columns');
      return saved ? { ...DEFAULT_CUSTOMER_COLUMNS, ...JSON.parse(saved) } : DEFAULT_CUSTOMER_COLUMNS;
    } catch {
      return DEFAULT_CUSTOMER_COLUMNS;
    }
  });
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
  const columnSelectorRef = useRef<HTMLDivElement>(null);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (columnSelectorRef.current && !columnSelectorRef.current.contains(e.target as Node)) {
        setIsColumnSelectorOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleColumn = (key: string) => {
    setVisibleColumns(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem('customers_visible_columns', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const [formData, setFormData] = useState({ 
    name: '', 
    mobile: '', 
    email: '', 
    manual_code: '',
    tax_number: '',
    commercial_register: '',
    address: '',
    opening_balance: 0,
    opening_balance_date: new Date().toISOString().slice(0, 10),
    account_id: '',
    account_name: '',
    counter_account_id: '',
    payment_method: 'credit',
    credit_limit: 0,
    payment_terms: 'due_on_receipt',
    payment_terms_days: 0,
    advance_percentage: 0,
    is_active: true,
    attachments: [] as AttachmentItem[]
  });

  const [invoices, setInvoices] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);

  useEffect(() => {
    if (user?.company_id) {
      const unsubscribe = dbService.subscribe<Customer>('customers', user.company_id, (data) => {
        setCustomers(data);
        setLoading(false);
      });

      const unsubscribeAccounts = dbService.subscribe<Account>('accounts', user.company_id, (data) => {
        setAccounts(data);
      });



      const unsubscribeEntries = dbService.subscribe<JournalEntry>('journal_entries', user.company_id, setEntries);
      const unsubscribeInvoices = dbService.subscribe<any>('invoices', user.company_id, setInvoices);
      const unsubscribeReturns = dbService.subscribe<any>('returns', user.company_id, setReturns);
      const unsubscribeReceipts = dbService.subscribe<any>('receipt_vouchers', user.company_id, setReceipts);
      const unsubscribeDiscounts = dbService.subscribe<any>('customer_discounts', user.company_id, setDiscounts);

      return () => {
        unsubscribe();
        unsubscribeAccounts();
        unsubscribeEntries();
        unsubscribeInvoices();
        unsubscribeReturns();
        unsubscribeReceipts();
        unsubscribeDiscounts();
      };
    }
  }, [user?.company_id]);

  // Enterprise Auto-population: Ensure default accounts are immediately populated when adding a new customer
  useEffect(() => {
    if (isModalOpen && !editingCustomer && accounts.length > 0) {
      setFormData(prev => {
        let changed = false;
        const updates: Partial<Customer> = {};
        if (!prev.account_id) {
          const acc = getDefaultAccount('customer', defaultAccountMap, accounts);
          if (acc) { updates.account_id = acc.id; updates.account_name = acc.name; changed = true; }
        }
        if (!prev.counter_account_id) {
          const acc = getDefaultAccount('opening_balance', defaultAccountMap, accounts);
          if (acc) { updates.counter_account_id = acc.id; changed = true; }
        }
        return changed ? { ...prev, ...updates } : prev;
      });
    }
  }, [isModalOpen, editingCustomer, accounts, defaultAccountMap]);

  // Enterprise Audit Trail Lock: check if customer has recorded transactions
  const isCustomerAccountLocked = useMemo(() => {
    if (!editingCustomer) return false;
    return Boolean(
      invoices.some((inv: any) => inv.customer_id === editingCustomer.id) ||
      receipts.some((r: any) => r.customer_id === editingCustomer.id) ||
      returns.some((ret: any) => ret.customer_id === editingCustomer.id) ||
      entries.some((je: any) => je.items?.some((i: any) => (i.customer_id === editingCustomer.id || i.sub_account_id === editingCustomer.id) && je.reference_type !== 'opening_balance'))
    );
  }, [editingCustomer, invoices, receipts, returns, entries]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      // Phone number validation: optional, but if provided must start with 0 and be 11 digits
      if (formData.mobile && formData.mobile.trim()) {
        const phoneRegex = /^0\d{10}$/;
        if (!phoneRegex.test(formData.mobile.trim())) {
          showNotification('رقم الهاتف يجب أن يبدأ بـ 0 ويتكون من 11 رقم', 'error');
          return;
        }
      }

      if (!formData.account_id) {
        showNotification('يجب اختيار الحساب المحاسبي للعميل', 'error');
        return;
      }

      if (editingCustomer && isCustomerAccountLocked && formData.account_id !== editingCustomer.account_id) {
        showNotification(
          language === 'ar'
            ? 'لا يمكن تعديل الحساب المحاسبي للعميل لوجود معاملات مالية مسجلة بالفعل - للحفاظ على مسار التدقيق ونزاهة الدفاتر.'
            : 'Cannot modify linked account because transactions are already recorded on this customer.',
          'error'
        );
        return;
      }

      let finalAccountId = formData.account_id;
      let finalCounterAccountId = formData.counter_account_id;

      const account1 = accounts.find(a => a.id === finalAccountId);
      const account2 = accounts.find(a => a.id === finalCounterAccountId);

      const isAccountCustomer = (acc: any) => acc && (acc.name.includes('عملاء') || acc.name.includes('العملاء') || acc.code?.startsWith('12'));
      const isAccountOpening = (acc: any) => acc && (acc.name.includes('رصيد') || acc.name.includes('ميزانية') || acc.name.includes('رأس') || acc.name.includes('راس') || acc.code?.startsWith('3'));

      if (isAccountOpening(account1) && isAccountCustomer(account2)) {
        finalAccountId = formData.counter_account_id;
        finalCounterAccountId = formData.account_id;
      }

      const selectedAccount = accounts.find(a => a.id === finalAccountId);
      const validCustomerUsages = ['customer', 'accounts_receivable'];

      if (!selectedAccount || !validCustomerUsages.includes(selectedAccount.account_usage || '')) {
        showNotification('خطأ: يجب أن يكون الحساب المحاسبي للعميل من قسم (أوراق القبض والعملاء) بـ استخدام (عملاء)', 'error');
        return;
      }

      const dataToSave = {
        ...formData,
        account_id: finalAccountId,
        counter_account_id: finalCounterAccountId,
        account_name: selectedAccount?.name || '',
        company_id: user.company_id
      };

      let id: string;
      if (editingCustomer) {
        const fieldsToTrack = [
          { field: 'name', label: 'اسم العميل' },
          { field: 'manual_code', label: 'كود يدوي' },
          { field: 'mobile', label: 'رقم الهاتف' },
          { field: 'email', label: 'البريد الإلكتروني' },
          { field: 'tax_number', label: 'الرقم الضريبي' },
          { field: 'commercial_register', label: 'السجل التجاري' },
          { field: 'address', label: 'العنوان' },
          { field: 'opening_balance', label: 'رصيد أول' },
          { field: 'opening_balance_date', label: 'تاريخ الرصيد' },
          { field: 'account_name', label: 'الحساب المحاسبي' },
          { field: 'counter_account_id', label: 'حساب الطرف الآخر' },
          { field: 'payment_method', label: 'طريقة السداد' },
          { field: 'credit_limit', label: 'حد الائتمان' },
          { field: 'payment_terms', label: 'شروط السداد' },
          { field: 'payment_terms_days', label: 'أيام شروط السداد' },
          { field: 'advance_percentage', label: 'نسبة الدفعة المقدمة' },
          { field: 'is_active', label: 'نشط' },
          { field: 'attachments', label: 'المرفقات' }
        ];
        await dbService.updateWithLog(
          'customers', 
          editingCustomer.id, 
          dataToSave,
          { id: user.id, username: user.username, company_id: user.company_id },
          'تعديل عميل',
          'customers',
          fieldsToTrack
        );
        id = editingCustomer.id;
      } else {
        // Generate sequential code: cust 00001
        const maxCodeNum = customers.reduce((max, c) => {
          if (!c.code) return max;
          const match = c.code.match(/cust (\d+)/i);
          if (match) {
            const num = parseInt(match[1], 10);
            return Math.max(max, num);
          }
          return max;
        }, 0);
        const nextNumber = maxCodeNum + 1;
        const code = `cust ${nextNumber.toString().padStart(5, '0')}`;

        id = await dbService.add('customers', { 
          ...dataToSave, 
          code,
          company_id: user.company_id 
        });
      }

      // Success notification and modal close early
      showNotification(editingCustomer ? 'تم تحديث بيانات العميل بنجاح' : 'تم إضافة العميل بنجاح', 'success');
      closeModal();

      // Background post-save hooks
      try {
        if (editingCustomer) {
          // Always handle journal entry to ensure consistency
          await dbService.deleteJournalEntryByReference(id, user.company_id);
          if (editingCustomer.code && editingCustomer.code !== id) {
            await dbService.deleteJournalEntryByReference(editingCustomer.code, user.company_id);
          }
        } else {
          await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة عميل', `إضافة عميل جديد: ${formData.name}`, 'customers', id);
        }

        // Create Journal Entry if balance is not zero
        const openingBal = parseFloat(String(formData.opening_balance || 0).replace(/,/g, '')) || 0;
        if (Math.abs(openingBal) > 0.0001) {
          const counterAccount = accounts.find(a => a.id === finalCounterAccountId);
          const absBalance = Math.abs(openingBal);
          const isNegative = openingBal < 0;

          const existingJe = editingCustomer?.id ? entries.find(e => 
            (e.reference_id === editingCustomer.id || (editingCustomer.code && e.reference_number === editingCustomer.code)) && 
            e.reference_type === 'opening_balance'
          ) : null;

          await dbService.add('journal_entries', {
            company_id: user.company_id,
            date: formData.opening_balance_date,
            description: `رصيد افتتاحي للعميل: ${formData.name}`,
            reference_id: id,
            reference_type: 'opening_balance',
            reference_number: existingJe?.reference_number || undefined,
            items: [
              {
                account_id: finalAccountId,
                account_name: selectedAccount?.name || '',
                debit: isNegative ? 0 : absBalance,
                credit: isNegative ? absBalance : 0,
                description: `رصيد افتتاحي: ${formData.name}`,
                customer_id: id,
                customer_name: formData.name
              },
              {
                account_id: finalCounterAccountId,
                account_name: counterAccount?.name || '',
                debit: isNegative ? absBalance : 0,
                credit: isNegative ? 0 : absBalance,
                description: `الطرف المقابل للرصيد الافتتاحي: ${formData.name}`
              }
            ],
            total_debit: absBalance,
            total_credit: absBalance,
            created_at: new Date().toISOString(),
            created_by: user.id
          });
        }

        const refreshedEntries = await dbService.listAll<any>('journal_entries');
        setEntries(refreshedEntries || []);
      } catch (postError) {
        console.error('Post-save operations failed:', postError);
      }
    } catch (e: any) {
      console.error(e);
      showNotification(e.message || 'حدث خطأ أثناء حفظ البيانات', 'error');
    }
  };

  const handleDelete = (id: string) => {
    setCustomerToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!customerToDelete || !user) return;
    try {
      const customer = customers.find(c => c.id === customerToDelete);
      
      // Check for associated transactions to prevent foreign key errors
      const hasInvoices = invoices.some(i => i.customer_id === customerToDelete);
      const hasReturns = returns.some(r => r.customer_id === customerToDelete);
      const hasReceipts = receipts.some(r => r.customer_id === customerToDelete);
      const hasDiscounts = discounts.some(d => d.customer_id === customerToDelete);

      if (hasInvoices || hasReturns || hasReceipts || hasDiscounts) {
        showNotification(
          language === 'ar' 
            ? 'لا يمكن حذف العميل لوجود معاملات مالية (فواتير، مرتجعات، أو سندات) مرتبطة به.' 
            : 'Cannot delete customer because there are associated transactions (invoices, returns, or vouchers).',
          'error'
        );
        setIsDeleteModalOpen(false);
        setCustomerToDelete(null);
        return;
      }
      
      // Delete associated journal entry first
      await dbService.deleteJournalEntryByReference(customerToDelete, user.company_id);
      
      await dbService.delete('customers', customerToDelete);
      await dbService.logActivity(user.id, user.username, user.company_id, 'حذف عميل', `حذف العميل: ${customer?.name}`, 'customers');
      showNotification('تم حذف العميل بنجاح', 'success');
      setIsDeleteModalOpen(false);
      setCustomerToDelete(null);
    } catch (e: any) {
      console.error(e);
      showNotification(e.message || 'حدث خطأ أثناء حذف العميل', 'error');
    }
  };

  const openModal = async (customer: Customer | null = null) => {
    if (customer) {

      try {
        const fullData = await dbService.get<Customer>('customers', customer.id);

        if (!fullData) throw new Error('Customer not found');

        setEditingCustomer(fullData);
        setFormData({ 
          name: fullData.name, 
          manual_code: fullData.manual_code || '',
          mobile: fullData.mobile,
          email: fullData.email || '',
          tax_number: fullData.tax_number || '',
          commercial_register: fullData.commercial_register || '',
          address: fullData.address || '',
          opening_balance: parseFloat(String(fullData.opening_balance || 0).replace(/,/g, '')) || 0,
          opening_balance_date: (fullData.opening_balance_date || new Date().toISOString()).slice(0, 10),
          account_id: fullData.account_id || '',
          account_name: fullData.account_name || '',
          counter_account_id: fullData.counter_account_id || '',
          payment_method: fullData.payment_method || 'credit',
          credit_limit: fullData.credit_limit || 0,
          payment_terms: fullData.payment_terms || 'due_on_receipt',
          payment_terms_days: fullData.payment_terms_days || 0,
          advance_percentage: fullData.advance_percentage || 0,
          is_active: fullData.is_active !== false,
          attachments: Array.isArray(fullData.attachments) ? fullData.attachments : []
        });

      } catch (error: any) {
        console.error('[EDIT] Error loading customer:', error);
        showNotification('فشل تحميل بيانات العميل', 'error');
        return;
      }
    } else {
      const defaultAccount = getDefaultAccount('customer', defaultAccountMap, accounts);
      const defaultCounterAccount = getDefaultAccount('opening_balance', defaultAccountMap, accounts);
      setEditingCustomer(null);
      setFormData({ 
        name: '', 
        manual_code: '',
        mobile: '', 
        email: '', 
        tax_number: '',
        commercial_register: '',
        address: '',
        opening_balance: 0,
        opening_balance_date: new Date().toISOString().slice(0, 10),
        account_id: defaultAccount?.id || '',
        account_name: defaultAccount?.name || '',
        counter_account_id: defaultCounterAccount?.id || '',
        payment_method: 'credit',
        credit_limit: 0,
        payment_terms: 'due_on_receipt',
        payment_terms_days: 0,
        advance_percentage: 0,
        is_active: true,
        attachments: []
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCustomer(null);
  };

  const getCustomerBalance = (customerId: string) => {
    let balance = 0;
    entries.forEach((je: any) => {
      je.items?.forEach((item: any) => {
        // Only count lines that affect the customer's specific account
        if (item.customer_id === customerId) {
          balance += (item.debit || 0) - (item.credit || 0);
        }
      });
    });
    return balance;
  };

  const formatBalance = (value: number) => {
    const formatted = formatNumber(Math.abs(value));
    if (value > 0) return `+${formatted}`;
    if (value < 0) return `-${formatted}`;
    return '0';
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.manual_code && c.manual_code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const isAllSelected = useMemo(() => {
    return filteredCustomers.length > 0 && filteredCustomers.every(c => selectedCustomerIds.includes(c.id));
  }, [filteredCustomers, selectedCustomerIds]);

  const isIndeterminate = useMemo(() => {
    return selectedCustomerIds.length > 0 && !isAllSelected;
  }, [selectedCustomerIds, isAllSelected]);

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedCustomerIds([]);
    } else {
      setSelectedCustomerIds(filteredCustomers.map(c => c.id));
    }
  };

  const toggleSelectCustomer = (id: string) => {
    setSelectedCustomerIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const totalBalance = useMemo(() => {
    const list = selectedCustomerIds.length > 0
      ? filteredCustomers.filter(c => selectedCustomerIds.includes(c.id))
      : filteredCustomers;
    return list.reduce((sum, c) => sum + getCustomerBalance(c.id), 0);
  }, [filteredCustomers, selectedCustomerIds, entries]);

  const customerColumnLabels: Record<string, string> = {
    code: t('customers.column_code'),
    manual_code: language === 'ar' ? 'كود يدوي' : 'Manual Code',
    name: t('customers.column_name'),
    mobile: language === 'ar' ? 'الهاتف' : 'Phone',
    payment_method: language === 'ar' ? 'طريقة السداد' : 'Payment Method',
    tax_number: language === 'ar' ? 'الرقم الضريبي' : 'Tax Number',
    commercial_register: language === 'ar' ? 'السجل التجاري' : 'CR Number',
    credit_limit: language === 'ar' ? 'حد الائتمان' : 'Credit Limit',
    status: language === 'ar' ? 'الحالة' : 'Status',
    current_balance: language === 'ar' ? 'الرصيد الحالي' : 'Current Balance'
  };

  const handleExportExcel = () => {
    const allHeaders: Record<string, { label: string; format?: (c: Customer) => any }> = {
      code: { label: t('customers.column_code'), format: (c) => c.code },
      manual_code: { label: language === 'ar' ? 'كود يدوي' : 'Manual Code', format: (c) => c.manual_code || '-' },
      name: { label: t('customers.column_name'), format: (c) => c.name },
      mobile: { label: language === 'ar' ? 'الهاتف' : 'Phone', format: (c) => c.mobile || '-' },
      payment_method: { 
        label: language === 'ar' ? 'طريقة السداد' : 'Payment Method', 
        format: (c) => c.payment_method === 'cash' ? (language === 'ar' ? 'نقدي' : 'Cash') :
                       c.payment_method === 'credit' ? (language === 'ar' ? 'آجل' : 'Credit') :
                       c.payment_method === 'installments' ? (language === 'ar' ? 'دفعات' : 'Installments') : (c.payment_method || '-')
      },
      tax_number: { label: language === 'ar' ? 'الرقم الضريبي' : 'Tax Number', format: (c) => c.tax_number || '-' },
      commercial_register: { label: language === 'ar' ? 'السجل التجاري' : 'CR Number', format: (c) => c.commercial_register || '-' },
      credit_limit: { label: language === 'ar' ? 'حد الائتمان' : 'Credit Limit', format: (c) => c.credit_limit || 0 },
      status: { label: language === 'ar' ? 'الحالة' : 'Status', format: (c) => c.is_active !== false ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'غير نشط' : 'Inactive') },
      current_balance: { label: language === 'ar' ? 'الرصيد الحالي' : 'Current Balance', format: (c) => getCustomerBalance(c.id) }
    };

    const activeHeaders: Record<string, string> = {};
    Object.keys(visibleColumns).forEach(k => {
      if (visibleColumns[k] !== false && allHeaders[k]) {
        activeHeaders[k] = allHeaders[k].label;
      }
    });

    const dataset = (selectedCustomerIds.length > 0 
      ? filteredCustomers.filter(c => selectedCustomerIds.includes(c.id))
      : filteredCustomers
    ).map(c => {
      const row: any = {};
      Object.keys(visibleColumns).forEach(k => {
        if (visibleColumns[k] !== false && allHeaders[k]) {
          row[k] = allHeaders[k].format ? allHeaders[k].format(c) : (c as any)[k];
        }
      });
      return row;
    });

    const formattedData = formatDataForExcel(dataset, activeHeaders);
    exportToExcel(formattedData, { filename: 'Customers_List', sheetName: t('customers.title') });
  };

  const handleExportPDF = async () => {
    if (tableRef.current) {
      await exportToPDFUtil(tableRef.current, { 
        filename: 'Customers_List',
        reportTitle: t('customers.list_title'),
        orientation: 'landscape'
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedCustomerIds.length === 0) return;
    
    const safeToDelete: string[] = [];
    const blocked: { name: string; reason: string }[] = [];

    for (const id of selectedCustomerIds) {
      const customer = customers.find(c => c.id === id);
      const custName = customer?.name || id;

      const hasInvoices = invoices.some(i => i.customer_id === id);
      const hasReturns = returns.some(r => r.customer_id === id);
      const hasReceipts = receipts.some(r => r.customer_id === id);
      const hasDiscounts = discounts.some(d => d.customer_id === id);
      const hasJE = entries.some(je => je.items?.some((i: any) => (i.customer_id === id || i.sub_account_id === id) && je.reference_type !== 'opening_balance'));

      if (hasInvoices || hasReturns || hasReceipts || hasDiscounts || hasJE) {
        blocked.push({ name: custName, reason: 'معاملات مسجلة' });
      } else {
        safeToDelete.push(id);
      }
    }

    if (blocked.length > 0 && safeToDelete.length === 0) {
      showNotification(
        language === 'ar'
          ? `لا يمكن حذف أي من العملاء المحددين (${blocked.length}) لوجود حركات ومعاملات مالية مسجلة عليهم: ${blocked.map(b => b.name).join('، ')}`
          : `Cannot delete selected customers (${blocked.length}) because they have associated transactions: ${blocked.map(b => b.name).join(', ')}`,
        'error'
      );
      return;
    }

    const confirmMsg = blocked.length > 0
      ? (language === 'ar'
          ? `تنبيه: يوجد (${blocked.length}) عميل مرتبط بمعاملات وفواتير ولا يمكن حذفهم حفاظاً على الدفاتر: (${blocked.map(b => b.name).join('، ')}).\n\nهل ترغب في حذف باقي العملاء (${safeToDelete.length}) غير المرتبطين بأي حركات نهائياً؟`
          : `Notice: ${blocked.length} customers have transactions and cannot be deleted. Do you want to delete the remaining ${safeToDelete.length} customer(s)?`)
      : (language === 'ar'
          ? `هل أنت متأكد من حذف ${safeToDelete.length} عميل محدد؟`
          : `Are you sure you want to delete ${safeToDelete.length} selected customer(s)?`);

    if (!window.confirm(confirmMsg)) return;

    try {
      for (const id of safeToDelete) {
        await dbService.deleteJournalEntryByReference(id, user!.company_id);
        await dbService.delete('customers', id);
      }
      setSelectedCustomerIds([]);
      showNotification(
        language === 'ar'
          ? `تم حذف ${safeToDelete.length} عميل بنجاح`
          : `Successfully deleted ${safeToDelete.length} customer(s)`,
        'success'
      );
    } catch (err: any) {
      showNotification(err.message || 'حدث خطأ أثناء الحذف', 'error');
    }
  };

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-zinc-500 gap-4" dir={dir}>
        <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-400">
          <Lock size={40} />
        </div>
        <h3 className="text-xl font-bold">{language === 'ar' ? 'عذراً، ليس لديك صلاحية للوصول إلى هذه الصفحة' : 'Sorry, you do not have permission to access this page'}</h3>
        <p className="text-sm">{language === 'ar' ? 'يرجى التواصل مع مدير النظام للحصول على الصلاحيات اللازمة.' : 'Please contact the system administrator to obtain the necessary permissions.'}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-2 animate-in fade-in duration-500 overflow-hidden w-full px-1 sm:px-3 py-1" dir={dir}>
      {!isModalOpen && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-1 py-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-emerald-500/20 flex-shrink-0">
              <User size={18} />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-slate-900 leading-tight">{t('customers.title')}</h2>
              <p className="text-slate-500 font-medium text-xs">{t('customers.subtitle')}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button 
              onClick={() => setIsActivityLogOpen(true)}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white text-slate-600 border border-slate-200 rounded-lg font-bold text-xs hover:bg-slate-50 transition-all active:scale-95 shadow-xs"
              title={language === 'ar' ? 'سجل النشاط' : 'Activity Log'}
            >
              <History size={15} />
              <span className="hidden md:inline">{language === 'ar' ? 'سجل النشاط' : 'Activity Log'}</span>
            </button>
            <ExportButtons 
              onExportExcel={handleExportExcel} 
              onExportPDF={handleExportPDF} 
              onPrint={() => printElement(tableRef.current, t('customers.list_title'))}
            />

            {/* Column Customization Dropdown (أعمدة الجدول) */}
            <div className="relative" ref={columnSelectorRef}>
              <button
                type="button"
                onClick={() => setIsColumnSelectorOpen(!isColumnSelectorOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all shadow-xs active:scale-95"
              >
                <Eye size={14} className="text-slate-400" />
                <span>{language === 'ar' ? 'أعمدة الجدول' : 'Table Columns'}</span>
                <ChevronDown size={14} className="text-slate-400" />
              </button>
              
              {isColumnSelectorOpen && (
                <div className="absolute top-full mt-1.5 right-0 bg-white border border-slate-200 rounded-xl shadow-xl p-3 z-50 min-w-[210px] max-h-[320px] overflow-y-auto space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider pb-1 border-b border-slate-100 flex items-center justify-between">
                    <span>{language === 'ar' ? 'تخصيص الأعمدة' : 'Customize Columns'}</span>
                    <span className="text-[9px] text-emerald-600 font-bold">{Object.values(visibleColumns).filter(Boolean).length} / {Object.keys(customerColumnLabels).length}</span>
                  </div>
                  {Object.entries(customerColumnLabels).map(([colKey, label]) => (
                    <label key={colKey} className="flex items-center gap-2 p-1 hover:bg-slate-50 rounded-lg cursor-pointer text-xs font-bold text-slate-700 transition-colors">
                      <input
                        type="checkbox"
                        checked={visibleColumns[colKey] !== false}
                        onChange={() => toggleColumn(colKey)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {canDelete && selectedCustomerIds.length > 0 && (
              <button
                type="button"
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-lg font-bold text-xs hover:bg-rose-700 transition-all shadow-sm active:scale-95 animate-in fade-in"
                title={language === 'ar' ? 'حذف المحدد' : 'Delete Selected'}
              >
                <Trash2 size={14} />
                <span>{language === 'ar' ? `حذف المحدد (${selectedCustomerIds.length})` : `Delete (${selectedCustomerIds.length})`}</span>
              </button>
            )}

            {canCreate && (
              <button
                onClick={() => setShowImportWizard(true)}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white text-emerald-700 border border-emerald-300 rounded-lg font-bold text-xs hover:bg-emerald-50 transition-all active:scale-95 shadow-xs"
                title="استيراد من Excel"
              >
                <FileUp size={15} />
                <span className="hidden md:inline">استيراد Excel</span>
              </button>
            )}
            {canCreate && (
              <button 
                onClick={() => openModal()}
                className={`flex items-center justify-center gap-1.5 px-4 py-1.5 bg-emerald-600 text-white rounded-lg font-bold text-xs hover:bg-emerald-700 transition-all shadow-md shadow-emerald-500/20 active:scale-95 border border-emerald-500/50 ${isModalOpen ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <Plus size={16} />
                {t('customers.add')}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row gap-2 overflow-hidden pb-1">
        {/* Main List Column */}
        <div className={`flex-1 flex flex-col transition-all duration-500 ease-in-out ${isModalOpen ? 'hidden' : 'w-full'}`}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col h-full">
            <div className="p-2 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-50/30 flex-wrap">
              <div className="flex items-center gap-2 flex-1 min-w-[250px]">
                <div className="relative flex-1 group">
                  <Search className={`absolute ${dir === 'rtl' ? 'right-2.5' : 'left-2.5'} top-2 text-slate-400 group-focus-within:text-emerald-500 transition-colors pointer-events-none`} size={15} />
                  <input
                    type="text"
                    placeholder={t('customers.search_placeholder')}
                    className={`w-full ${dir === 'rtl' ? 'pr-8 pl-3' : 'pl-8 pr-3'} py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none transition-all font-bold text-xs text-slate-900 placeholder:text-slate-400`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 shadow-inner">
                  <button
                    onClick={() => setView('table')}
                    className={`p-1.5 rounded-md transition-all ${view === 'table' ? 'bg-white text-emerald-600 shadow-xs border border-slate-100' : 'text-slate-500 hover:text-slate-700'}`}
                    title={language === 'ar' ? 'عرض الجدول' : 'Table View'}
                  >
                    <List size={16} />
                  </button>
                  <button
                    onClick={() => setView('card')}
                    className={`p-1.5 rounded-md transition-all ${view === 'card' ? 'bg-white text-emerald-600 shadow-xs border border-slate-100' : 'text-slate-500 hover:text-slate-700'}`}
                    title={language === 'ar' ? 'عرض الكروت' : 'Card View'}
                  >
                    <LayoutGrid size={16} />
                  </button>
                </div>
              </div>

              {/* Total Balance Badge (إجمالي الرصيد الحالي / المحدد) */}
              <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50/90 border border-emerald-200/70 rounded-lg shadow-2xs">
                <Wallet size={14} className="text-emerald-600 shrink-0" />
                <span className="text-[11px] font-bold text-slate-600 whitespace-nowrap">
                  {selectedCustomerIds.length > 0 
                    ? (language === 'ar' ? `إجمالي رصيد المحدد (${selectedCustomerIds.length}):` : `Selected Balance (${selectedCustomerIds.length}):`)
                    : (language === 'ar' ? 'إجمالي الرصيد الحالي:' : 'Total Current Balance:')
                  }
                </span>
                <span className={`text-xs font-black font-mono px-2 py-0.5 rounded ${totalBalance >= 0 ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                  {formatBalance(totalBalance)} {language === 'ar' ? 'ج.م' : 'EGP'}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {view === 'table' ? (
                <div className="hidden md:block overflow-x-auto h-full">
                  <table ref={tableRef} className="w-full text-xs">
                    <thead className="sticky top-0 bg-white/95 backdrop-blur-md z-10 border-b border-slate-100">
                      <tr className="text-slate-500 text-[10px] uppercase font-black tracking-wider whitespace-nowrap">
                        <th className="px-2 py-1.5 w-8 text-center">
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
                            checked={isAllSelected}
                            ref={input => {
                              if (input) input.indeterminate = isIndeterminate;
                            }}
                            onChange={toggleSelectAll}
                            title={language === 'ar' ? 'تحديد الكل' : 'Select All'}
                          />
                        </th>
                        {visibleColumns.code !== false && (
                          <th className={`px-2 py-1.5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.column_code')}</th>
                        )}
                        {visibleColumns.manual_code !== false && (
                          <th className={`px-2 py-1.5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{language === 'ar' ? 'كود يدوي' : 'Manual Code'}</th>
                        )}
                        {visibleColumns.name !== false && (
                          <th className={`px-2 py-1.5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.column_name')}</th>
                        )}
                        {visibleColumns.mobile !== false && (
                          <th className={`px-2 py-1.5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{language === 'ar' ? 'الهاتف' : 'Phone'}</th>
                        )}
                        {visibleColumns.payment_method !== false && (
                          <th className={`px-2 py-1.5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{language === 'ar' ? 'طريقة السداد' : 'Payment Method'}</th>
                        )}
                        {visibleColumns.tax_number !== false && (
                          <th className={`px-2 py-1.5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{language === 'ar' ? 'الرقم الضريبي' : 'Tax Number'}</th>
                        )}
                        {visibleColumns.commercial_register !== false && (
                          <th className={`px-2 py-1.5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{language === 'ar' ? 'السجل التجاري' : 'CR Number'}</th>
                        )}
                        {visibleColumns.credit_limit !== false && (
                          <th className={`px-2 py-1.5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{language === 'ar' ? 'حد الائتمان' : 'Credit Limit'}</th>
                        )}
                        {visibleColumns.status !== false && (
                          <th className={`px-2 py-1.5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{language === 'ar' ? 'الحالة' : 'Status'}</th>
                        )}
                        {visibleColumns.current_balance !== false && (
                          <th className={`px-2 py-1.5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>الرصيد الحالي</th>
                        )}
                        <th className={`px-2 py-1.5 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>{t('invoices.column_actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredCustomers.map((customer) => (
                        <tr 
                          key={customer.id} 
                          onClick={() => openModal(customer)}
                          className={`hover:bg-emerald-50/40 transition-all group cursor-pointer border-transparent border-x-2 ${editingCustomer?.id === customer.id ? 'bg-emerald-50/80 border-emerald-500' : ''} ${selectedCustomerIds.includes(customer.id) ? 'bg-emerald-50/30' : ''}`}
                        >
                          <td className="px-2 py-1.5 w-8 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
                              checked={selectedCustomerIds.includes(customer.id)}
                              onChange={() => toggleSelectCustomer(customer.id)}
                            />
                          </td>
                          {visibleColumns.code !== false && (
                            <td className={`px-2 py-1.5 ${dir === 'rtl' ? 'text-right' : 'text-left'} whitespace-nowrap`}>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-bold border border-slate-200 group-hover:border-emerald-200 group-hover:text-emerald-700 transition-all">{customer.code}</span>
                                {customer.attachments && customer.attachments.length > 0 && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200" title={language === 'ar' ? `${customer.attachments.length} مرفق` : `${customer.attachments.length} attachments`}>
                                    <Paperclip size={10} className="text-emerald-600" />
                                    <span>{customer.attachments.length}</span>
                                  </span>
                                )}
                              </div>
                            </td>
                          )}
                          {visibleColumns.manual_code !== false && (
                            <td className={`px-2 py-1.5 ${dir === 'rtl' ? 'text-right' : 'text-left'} whitespace-nowrap`}>
                              {customer.manual_code ? (
                                <span className="font-mono text-[10px] bg-slate-50 px-1.5 py-0.5 rounded text-slate-700 font-bold border border-slate-200">{customer.manual_code}</span>
                              ) : (
                                <span className="text-slate-300 text-xs font-mono">-</span>
                              )}
                            </td>
                          )}
                          {visibleColumns.name !== false && (
                            <td className={`px-2 py-1.5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                              <span className={`font-bold text-xs text-slate-900 group-hover:text-emerald-700 transition-colors ${editingCustomer?.id === customer.id ? 'text-emerald-700' : ''}`}>{customer.name}</span>
                            </td>
                          )}
                          {visibleColumns.mobile !== false && (
                            <td className={`px-2 py-1.5 ${dir === 'rtl' ? 'text-right' : 'text-left'} whitespace-nowrap`}>
                              {customer.mobile ? (
                                <span className="text-xs text-slate-600 font-mono dir-ltr inline-block font-medium">{customer.mobile}</span>
                              ) : (
                                <span className="text-slate-300 text-xs font-mono">-</span>
                              )}
                            </td>
                          )}
                          {visibleColumns.payment_method !== false && (
                            <td className={`px-2 py-1.5 ${dir === 'rtl' ? 'text-right' : 'text-left'} whitespace-nowrap`}>
                              {customer.payment_method ? (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                                  {customer.payment_method === 'cash' ? (language === 'ar' ? 'نقدي' : 'Cash') :
                                   customer.payment_method === 'credit' ? (language === 'ar' ? 'آجل' : 'Credit') :
                                   customer.payment_method === 'installments' ? (language === 'ar' ? 'دفعات' : 'Installments') : 
                                   (language === 'ar' ? 'أخرى' : 'Other')}
                                </span>
                              ) : (
                                <span className="text-slate-300 text-xs font-mono">-</span>
                              )}
                            </td>
                          )}
                          {visibleColumns.tax_number !== false && (
                            <td className={`px-2 py-1.5 ${dir === 'rtl' ? 'text-right' : 'text-left'} whitespace-nowrap`}>
                              {customer.tax_number ? (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200/20 dir-ltr font-mono">
                                  {customer.tax_number}
                                </span>
                              ) : (
                                <span className="text-slate-300 text-xs font-mono">-</span>
                              )}
                            </td>
                          )}
                          {visibleColumns.commercial_register !== false && (
                            <td className={`px-2 py-1.5 ${dir === 'rtl' ? 'text-right' : 'text-left'} whitespace-nowrap`}>
                              {customer.commercial_register ? (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200/30 dir-ltr font-mono">
                                  {customer.commercial_register}
                                </span>
                              ) : (
                                <span className="text-slate-300 text-xs font-mono">-</span>
                              )}
                            </td>
                          )}
                          {visibleColumns.credit_limit !== false && (
                            <td className={`px-2 py-1.5 ${dir === 'rtl' ? 'text-right' : 'text-left'} whitespace-nowrap`}>
                              {customer.credit_limit > 0 ? (
                                <span className="text-[11px] font-bold px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200/20 font-mono">
                                  {formatNumber(customer.credit_limit)}
                                </span>
                              ) : (
                                <span className="text-slate-300 text-xs font-mono">-</span>
                              )}
                            </td>
                          )}
                          {visibleColumns.status !== false && (
                            <td className={`px-2 py-1.5 ${dir === 'rtl' ? 'text-right' : 'text-left'} whitespace-nowrap`}>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${customer.is_active !== false ? 'bg-emerald-50 text-emerald-700 border-emerald-200/20' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                {customer.is_active !== false ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'غير نشط' : 'Inactive')}
                              </span>
                            </td>
                          )}
                          {visibleColumns.current_balance !== false && (
                            <td className={`px-2 py-1.5 ${dir === 'rtl' ? 'text-right' : 'text-left'} whitespace-nowrap`}>
                              <span className={`font-bold text-xs px-2 py-0.5 rounded-md ${getCustomerBalance(customer.id) >= 0 ? 'bg-emerald-100/70 text-emerald-800' : 'bg-rose-100/70 text-rose-800'} border border-emerald-200/20 font-mono`}>
                                {formatBalance(getCustomerBalance(customer.id))}
                              </span>
                            </td>
                          )}
                          <td className={`px-2 py-1.5 ${dir === 'rtl' ? 'text-left' : 'text-right'} whitespace-nowrap`}>
                            <div className={`flex items-center ${dir === 'rtl' ? 'justify-start' : 'justify-end'} gap-1 opacity-0 group-hover:opacity-100 transition-all`}>
                               {canDelete && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleDelete(customer.id); }}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                  title="حذف"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                              <div className="p-1 text-emerald-500 bg-emerald-50 rounded-lg">
                                 {dir === 'rtl' ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredCustomers.length === 0 && !loading && (
                    <div className="p-10 text-center flex flex-col items-center gap-2">
                       <div className="w-12 h-12 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center">
                          <Search size={24} />
                       </div>
                       <p className="text-slate-400 font-bold text-xs">لم يتم العثور على أية نتائج</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {filteredCustomers.map((customer) => (
                    <div 
                      key={customer.id} 
                      onClick={() => openModal(customer)}
                      className={`p-3 space-y-2 rounded-xl border transition-all cursor-pointer group relative overflow-hidden ${editingCustomer?.id === customer.id ? 'bg-emerald-50/80 border-emerald-300 shadow-sm' : 'bg-white border-slate-200/80 hover:border-emerald-300 hover:shadow-sm'}`}
                    >
                      <div className="flex justify-between items-start relative z-10">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[9px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-bold w-fit border border-slate-200">{customer.code}</span>
                            {customer.attachments && customer.attachments.length > 0 && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[9px] font-bold border border-slate-200" title={language === 'ar' ? `${customer.attachments.length} مرفق` : `${customer.attachments.length} attachments`}>
                                <Paperclip size={9} className="text-emerald-600" />
                                <span>{customer.attachments.length}</span>
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors text-sm leading-tight">{customer.name}</h4>
                          <span className="text-[11px] text-slate-400 font-medium">{customer.mobile}</span>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {customer.payment_method && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                                {customer.payment_method === 'cash' ? (language === 'ar' ? 'نقدي' : 'Cash') :
                                 customer.payment_method === 'credit' ? (language === 'ar' ? 'آجل' : 'Credit') :
                                 customer.payment_method === 'installments' ? (language === 'ar' ? 'دفعات' : 'Installments') : 
                                 (language === 'ar' ? 'أخرى' : 'Other')}
                              </span>
                            )}
                            {customer.credit_limit > 0 && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-amber-50 text-amber-700 rounded border border-amber-200/20">
                                {language === 'ar' ? 'حد: ' : 'Limit: '}{formatNumber(customer.credit_limit)}
                              </span>
                            )}
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${customer.is_active !== false ? 'bg-emerald-50 text-emerald-700 border-emerald-200/20' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                              {customer.is_active !== false ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'غير نشط' : 'Inactive')}
                            </span>
                          </div>
                        </div>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-xs ${getCustomerBalance(customer.id) >= 0 ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                           <Wallet size={15} />
                        </div>
                      </div>
                      <div className="pt-2 border-t border-slate-100 flex justify-between items-end relative z-10">
                        <div>
                          <p className="text-slate-400 text-[9px] uppercase font-bold">الرصيد الحالي</p>
                          <p className={`font-black text-base leading-tight ${getCustomerBalance(customer.id) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {formatBalance(getCustomerBalance(customer.id))}
                          </p>
                        </div>
                        <div className="p-1 text-slate-300 group-hover:text-emerald-600 transition-colors">
                          {dir === 'rtl' ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Integrated Side Panel Form */}
      <AnimatePresence mode="wait">
        {isModalOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: 'spring', damping: 32, stiffness: 280 }}
            className="w-full flex flex-col md:flex-row h-full bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden relative z-[40]"
          >
              {/* Form Side */}
              <div className="flex-1 flex flex-col overflow-hidden bg-white">
                <div className={`px-4 py-2 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-20 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 bg-emerald-600 text-white rounded-lg flex items-center justify-center shadow-xs flex-shrink-0">
                       <User size={15} />
                    </div>
                    <div>
                       <h3 className="text-sm font-black text-slate-900 tracking-tight leading-none mb-0.5">{editingCustomer ? t('customers.edit') : t('customers.add')}</h3>
                       <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none">{editingCustomer?.code || 'CUSTOMER FLOW : NEW'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Active Status Switch in Header */}
                    <div className="flex items-center gap-1.5 bg-slate-100/80 px-2 py-1 rounded-lg border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-700">
                        {formData.is_active ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'غير نشط' : 'Inactive')}
                      </span>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                        className={`relative inline-flex h-4.5 w-8 items-center rounded-full transition-colors focus:outline-none ${formData.is_active ? 'bg-emerald-600' : 'bg-slate-300'}`}
                      >
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${formData.is_active ? (dir === 'rtl' ? '-translate-x-4' : 'translate-x-4') : (dir === 'rtl' ? '-translate-x-0.5' : 'translate-x-0.5')}`}
                        />
                      </button>
                    </div>
                    <button 
                      type="submit" 
                      form="customer-form"
                      className="px-4 py-1.5 bg-zinc-900 text-white rounded-lg font-bold hover:bg-zinc-800 transition-all active:scale-95 shadow-xs text-xs"
                    >
                      {editingCustomer ? (language === 'ar' ? 'تحديث' : 'Update') : (language === 'ar' ? 'حفظ العميل' : 'Save')}
                    </button>
                    <button onClick={closeModal} className="w-7 h-7 flex items-center justify-center bg-slate-50 text-slate-400 rounded-lg hover:bg-rose-50 hover:text-rose-500 transition-all border border-slate-200/60" title={language === 'ar' ? 'إغلاق' : 'Close'}>
                      <X size={15} />
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 md:p-4">
                  <form id="customer-form" onSubmit={handleSubmit} className="p-0.5">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-start">
                      {/* Column 1: Basic Information */}
                      <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-200/60 space-y-2.5">
                        <div className="flex items-center gap-1.5 border-b border-slate-200/60 pb-1.5">
                          <div className="w-5 h-5 bg-emerald-50 text-emerald-600 rounded flex items-center justify-center">
                            <User size={12} />
                          </div>
                          <h4 className="text-xs font-bold text-slate-800 leading-none uppercase">
                            {language === 'ar' ? 'البيانات الأساسية' : 'Basic Information'}
                          </h4>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {/* Name */}
                          <div className="space-y-0.5">
                            <label className="block text-[10px] font-bold text-slate-500 px-0.5 mb-0.5">{t('customers.form_name')}</label>
                            <input
                              required
                              type="text"
                              placeholder="John Doe / شركة السلام"
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 shadow-none transition-all focus:ring-1 focus:ring-emerald-500 outline-none placeholder:text-slate-400"
                              value={formData.name}
                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                          </div>

                          {/* Manual Code (كود يدوي) */}
                          <div className="space-y-0.5">
                            <label className="block text-[10px] font-bold text-slate-500 px-0.5 mb-0.5">
                              {language === 'ar' ? 'كود يدوي' : 'Manual Code'} <span className="text-[9px] text-slate-400 font-normal">({language === 'ar' ? 'اختياري' : 'Optional'})</span>
                            </label>
                            <div className="relative group">
                              <Hash className={`absolute ${dir === 'rtl' ? 'right-2.5' : 'left-2.5'} top-2 text-slate-400`} size={14} />
                              <input
                                type="text"
                                placeholder={language === 'ar' ? 'كود يدوي' : 'Manual Code'}
                                className={`w-full ${dir === 'rtl' ? 'pr-7 pl-2.5' : 'pl-7 pr-2.5'} py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-mono`}
                                value={formData.manual_code || ''}
                                onChange={(e) => setFormData({ ...formData, manual_code: e.target.value })}
                              />
                            </div>
                          </div>

                          {/* Code (if editing) */}
                          {editingCustomer && (
                            <div className="sm:col-span-2 space-y-0.5">
                              <label className="block text-[10px] font-bold text-slate-500 px-0.5 mb-0.5">{t('customers.column_code')}</label>
                              <div className="relative group">
                                <Hash className={`absolute ${dir === 'rtl' ? 'right-2.5' : 'left-2.5'} top-2 text-slate-400`} size={14} />
                                <input
                                  required
                                  readOnly
                                  type="text"
                                  className={`w-full ${dir === 'rtl' ? 'pr-7 pl-2.5' : 'pl-7 pr-2.5'} py-1.5 bg-slate-100 border border-slate-200 rounded-lg font-mono text-xs font-bold text-slate-500 cursor-not-allowed tracking-wider`}
                                  value={editingCustomer.code}
                                />
                              </div>
                            </div>
                          )}

                          {/* Mobile */}
                          <div className="space-y-0.5">
                            <label className="block text-[10px] font-bold text-slate-500 px-0.5 mb-0.5">
                              {t('customers.form_mobile')} <span className="text-[9px] text-slate-400 font-normal">({language === 'ar' ? 'اختياري' : 'Optional'})</span>
                            </label>
                            <div className="relative group">
                              <Phone className={`absolute ${dir === 'rtl' ? 'right-2.5' : 'left-2.5'} top-2 text-slate-400`} size={14} />
                              <input
                                type="tel"
                                maxLength={11}
                                placeholder="01234567890"
                                className={`w-full ${dir === 'rtl' ? 'pr-7 pl-2.5' : 'pl-7 pr-2.5'} py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-mono`}
                                value={formData.mobile}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/\D/g, '');
                                  setFormData({ ...formData, mobile: value });
                                }}
                              />
                            </div>
                          </div>

                          {/* Email */}
                          <div className="space-y-0.5">
                            <label className="block text-[10px] font-bold text-slate-500 px-0.5 mb-0.5">{t('customers.form_email')}</label>
                            <div className="relative group">
                              <Mail className={`absolute ${dir === 'rtl' ? 'right-2.5' : 'left-2.5'} top-2 text-slate-400`} size={14} />
                              <input
                                type="email"
                                placeholder="customer@example.com"
                                className={`w-full ${dir === 'rtl' ? 'pr-7 pl-2.5' : 'pl-7 pr-2.5'} py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-1 focus:ring-emerald-500 transition-all`}
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                              />
                            </div>
                          </div>

                          {/* Tax Number */}
                          <div className="space-y-0.5">
                            <label className="block text-[10px] font-bold text-slate-500 px-0.5 mb-0.5">{t('customers.form_tax_number')}</label>
                            <div className="relative group">
                              <FileText className={`absolute ${dir === 'rtl' ? 'right-2.5' : 'left-2.5'} top-2 text-slate-400`} size={14} />
                              <input
                                type="text"
                                placeholder={language === 'ar' ? 'الرقم الضريبي' : 'Tax Number'}
                                className={`w-full ${dir === 'rtl' ? 'pr-7 pl-2.5' : 'pl-7 pr-2.5'} py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-mono dir-ltr`}
                                value={formData.tax_number || ''}
                                onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })}
                              />
                            </div>
                          </div>

                          {/* Commercial Register */}
                          <div className="space-y-0.5">
                            <label className="block text-[10px] font-bold text-slate-500 px-0.5 mb-0.5">{language === 'ar' ? 'رقم السجل التجاري' : 'CR Number'}</label>
                            <div className="relative group">
                              <Building2 className={`absolute ${dir === 'rtl' ? 'right-2.5' : 'left-2.5'} top-2 text-slate-400`} size={14} />
                              <input
                                type="text"
                                placeholder={language === 'ar' ? 'رقم السجل التجاري' : 'Commercial Register'}
                                className={`w-full ${dir === 'rtl' ? 'pr-7 pl-2.5' : 'pl-7 pr-2.5'} py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-mono dir-ltr`}
                                value={formData.commercial_register || ''}
                                onChange={(e) => setFormData({ ...formData, commercial_register: e.target.value })}
                              />
                            </div>
                          </div>

                          {/* Address */}
                          <div className="sm:col-span-2 space-y-0.5">
                            <label className="block text-[10px] font-bold text-slate-500 px-0.5 mb-0.5">{t('customers.form_address')}</label>
                            <div className="relative group">
                              <MapPin className={`absolute ${dir === 'rtl' ? 'right-2.5' : 'left-2.5'} top-2 text-slate-400`} size={14} />
                              <input
                                placeholder={language === 'ar' ? 'العنوان التفصيلي للعميل' : 'Full Address'}
                                className={`w-full ${dir === 'rtl' ? 'pr-7 pl-2.5' : 'pl-7 pr-2.5'} py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-1 focus:ring-emerald-500 transition-all`}
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                              />
                            </div>
                          </div>

                          {/* GL Account */}
                          <div className="sm:col-span-2 space-y-0.5">
                            <div className="flex items-center justify-between mb-0.5 px-0.5">
                              <label className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                                {isCustomerAccountLocked && <Lock size={11} className="text-amber-500" />}
                                <span>{t('customers.form_account')}</span>
                              </label>
                              {isCustomerAccountLocked && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  <Lock size={9} />
                                  <span>{language === 'ar' ? 'مقفل لوجود حركات مسجلة' : 'Locked (Has transactions)'}</span>
                                </span>
                              )}
                            </div>
                            <div className="relative group">
                              {isCustomerAccountLocked ? (
                                <Lock className={`absolute ${dir === 'rtl' ? 'right-2.5' : 'left-2.5'} top-2 text-amber-500 pointer-events-none`} size={14} />
                              ) : (
                                <Box className={`absolute ${dir === 'rtl' ? 'right-2.5' : 'left-2.5'} top-2 text-slate-400 pointer-events-none`} size={14} />
                              )}
                              <select
                                required
                                disabled={isCustomerAccountLocked}
                                className={`w-full ${dir === 'rtl' ? 'pr-7 pl-2.5' : 'pl-7 pr-2.5'} py-1.5 border rounded-lg text-xs font-bold appearance-none outline-none transition-all ${
                                  isCustomerAccountLocked
                                    ? 'bg-slate-100/90 text-slate-500 border-slate-200 cursor-not-allowed font-medium'
                                    : 'bg-white border-slate-200 text-slate-900 focus:ring-1 focus:ring-emerald-500'
                                }`}
                                value={formData.account_id}
                                onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                              >
                                <option value="">{language === 'ar' ? 'اختر الحساب المحاسبي...' : 'Select account...'}</option>
                                {getCompatibleAccounts('customer', accounts, formData.account_id).map(account => (
                                  <option key={account.id} value={account.id}>{account.code} - {account.name}</option>
                                ))}
                              </select>
                            </div>
                            {isCustomerAccountLocked && (
                              <p className="text-[10px] font-medium text-amber-700 mt-1 flex items-center gap-1">
                                <span>🔒</span>
                                <span>{language === 'ar' ? 'لا يمكن تعديل الحساب المحاسبي بعد تسجيل معاملات مالية للعميل حفاظاً على مسار التدقيق.' : 'Linked account cannot be modified once transactions exist to preserve audit trail.'}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Column 2: Payment/Credit, Opening Balance, Attachments */}
                      <div className="space-y-3">
                        {/* Payment & Credit Settings Section */}
                        <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-200/60 space-y-2">
                          <div className="flex items-center gap-1.5 border-b border-slate-200/50 pb-1.5">
                            <div className="w-5 h-5 bg-emerald-600/10 text-emerald-700 rounded flex items-center justify-center">
                              <CreditCard size={12} />
                            </div>
                            <h4 className="text-xs font-bold text-slate-800 leading-none">
                              {language === 'ar' ? 'إعدادات السداد والائتمان' : 'Payment & Credit Settings'}
                            </h4>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {/* Payment Method */}
                            <div className="space-y-0.5">
                              <label className="block text-[10px] font-bold text-slate-500 px-0.5 mb-0.5">
                                {language === 'ar' ? 'طريقة السداد' : 'Payment Method'}
                              </label>
                              <div className="relative group">
                                <Wallet className={`absolute ${dir === 'rtl' ? 'right-2.5' : 'left-2.5'} top-2 text-slate-400 pointer-events-none`} size={14} />
                                <select
                                  className={`w-full ${dir === 'rtl' ? 'pr-7 pl-2.5' : 'pl-7 pr-2.5'} py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 appearance-none outline-none focus:ring-1 focus:ring-emerald-500`}
                                  value={formData.payment_method || 'credit'}
                                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                                >
                                  <option value="cash">{language === 'ar' ? 'نقدي' : 'Cash'}</option>
                                  <option value="credit">{language === 'ar' ? 'آجل' : 'Credit'}</option>
                                  <option value="installments">{language === 'ar' ? 'دفعات' : 'Installments'}</option>
                                  <option value="other">{language === 'ar' ? 'أخرى' : 'Other'}</option>
                                </select>
                              </div>
                            </div>

                            {/* Credit Limit */}
                            <div className="space-y-0.5">
                              <label className="block text-[10px] font-bold text-slate-500 px-0.5 mb-0.5">
                                {language === 'ar' ? 'حد الائتمان' : 'Credit Limit'}
                              </label>
                              <div className="relative group">
                                <FormattedNumberInput
                                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-1 focus:ring-emerald-500"
                                  value={formData.credit_limit || 0}
                                  onChange={(val) => setFormData({ ...formData, credit_limit: val })}
                                  dir={dir === 'rtl' ? 'rtl' : 'ltr'}
                                />
                              </div>
                            </div>

                            {/* Payment Terms */}
                            <div className="sm:col-span-2 space-y-0.5">
                              <label className="block text-[10px] font-bold text-slate-500 px-0.5 mb-0.5">
                                {language === 'ar' ? 'شروط السداد' : 'Payment Terms'}
                              </label>
                              <div className="relative group">
                                <Calendar className={`absolute ${dir === 'rtl' ? 'right-2.5' : 'left-2.5'} top-2 text-slate-400 pointer-events-none`} size={14} />
                                <select
                                  className={`w-full ${dir === 'rtl' ? 'pr-7 pl-2.5' : 'pl-7 pr-2.5'} py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 appearance-none outline-none focus:ring-1 focus:ring-emerald-500`}
                                  value={formData.payment_terms || 'due_on_receipt'}
                                  onChange={(e) => {
                                    const term = e.target.value;
                                    let days = 0;
                                    let pct = 0;
                                    if (term === 'net_7') days = 7;
                                    else if (term === 'net_15') days = 15;
                                    else if (term === 'net_30') days = 30;
                                    else if (term === 'net_45') days = 45;
                                    else if (term === 'net_60') days = 60;
                                    else if (term === 'net_90') days = 90;
                                    else if (term === 'net_180') days = 180;
                                    else if (term === 'advance_50_50') pct = 50;
                                    else if (term === 'advance') pct = 100;
                                    
                                    setFormData({ 
                                      ...formData, 
                                      payment_terms: term,
                                      payment_terms_days: days,
                                      advance_percentage: pct
                                    });
                                  }}
                                >
                                  <option value="cash">{language === 'ar' ? 'نقدي عند التسليم (Cash)' : 'Cash'}</option>
                                  <option value="due_on_receipt">{language === 'ar' ? 'مستحق فور استلام الفاتورة' : 'Due on Receipt'}</option>
                                  <option value="net_7">{language === 'ar' ? 'خلال 7 أيام (Net 7)' : 'Net 7'}</option>
                                  <option value="net_15">{language === 'ar' ? 'خلال 15 يوماً (Net 15)' : 'Net 15'}</option>
                                  <option value="net_30">{language === 'ar' ? 'خلال 30 يوماً (Net 30)' : 'Net 30'}</option>
                                  <option value="net_45">{language === 'ar' ? 'خلال 45 يوماً (Net 45)' : 'Net 45'}</option>
                                  <option value="net_60">{language === 'ar' ? 'خلال 60 يوماً (Net 60)' : 'Net 60'}</option>
                                  <option value="net_90">{language === 'ar' ? 'خلال 90 يوماً (Net 90)' : 'Net 90'}</option>
                                  <option value="net_180">{language === 'ar' ? 'خلال 180 يوماً (Net 180)' : 'Net 180'}</option>
                                  <option value="eom">{language === 'ar' ? 'نهاية الشهر (EOM)' : 'EOM'}</option>
                                  <option value="eom_30">{language === 'ar' ? 'السداد بعد 30 يوم من نهاية الشهر' : '30 Days EOM'}</option>
                                  <option value="advance">{language === 'ar' ? 'دفعة مقدمة 100%' : 'Advance (100%)'}</option>
                                  <option value="advance_50_50">{language === 'ar' ? '50% مقدم والباقي عند التسليم' : '50% Advance'}</option>
                                  <option value="custom">{language === 'ar' ? 'مخصص (أيام / نسب مخصصة)' : 'Custom'}</option>
                                </select>
                              </div>
                            </div>

                            {formData.payment_terms === 'custom' && (
                              <>
                                <div className="space-y-0.5">
                                  <label className="block text-[10px] font-bold text-slate-500 px-0.5 mb-0.5">
                                    {language === 'ar' ? 'فترة السداد بالأيام' : 'Days'}
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-1 focus:ring-emerald-500"
                                    value={formData.payment_terms_days || 0}
                                    onChange={(e) => setFormData({ ...formData, payment_terms_days: Number(e.target.value) })}
                                  />
                                </div>
                                <div className="space-y-0.5">
                                  <label className="block text-[10px] font-bold text-slate-500 px-0.5 mb-0.5">
                                    {language === 'ar' ? 'نسبة المقدم %' : 'Advance %'}
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-1 focus:ring-emerald-500"
                                    value={formData.advance_percentage || 0}
                                    onChange={(e) => setFormData({ ...formData, advance_percentage: Number(e.target.value) })}
                                  />
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Financial & Opening Balance Section */}
                        <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-200/60 space-y-2">
                          {(() => {
                            const openingBal = parseFloat(String(formData.opening_balance || 0).replace(/,/g, '')) || 0;
                            const hasOpeningBal = Math.abs(openingBal) > 0.0001;
                            const linkedJe = (editingCustomer?.id && hasOpeningBal) ? entries.find(e => 
                              (e.reference_id === editingCustomer.id || (editingCustomer.code && e.reference_number === editingCustomer.code)) && 
                              e.reference_type === 'opening_balance' &&
                              (Number(e.total_debit) > 0 || Number(e.total_credit) > 0)
                            ) : null;
                            return (
                              <div className="flex items-center justify-between border-b border-slate-200/50 pb-1.5 flex-wrap gap-2">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-5 h-5 bg-emerald-600/10 text-emerald-700 rounded flex items-center justify-center">
                                    <Wallet size={12} />
                                  </div>
                                  <h4 className="text-xs font-bold text-slate-800 leading-none">
                                    {language === 'ar' ? 'الرصيد الافتتاحي' : 'Opening Balance'}
                                  </h4>
                                </div>
                                {linkedJe?.entry_number && (
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-700 font-mono text-xs font-black shadow-xs">
                                    <FileText size={13} className="text-indigo-600" />
                                    <span>{language === 'ar' ? `رقم القيد: ${linkedJe.entry_number}` : `JE #: ${linkedJe.entry_number}`}</span>
                                  </div>
                                )}
                                {linkedJe?.reference_number && (
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 font-mono text-xs font-black shadow-xs">
                                    <Hash size={13} className="text-emerald-600" />
                                    <span>{language === 'ar' ? `رقم الحركة: ${linkedJe.reference_number}` : `Doc #: ${linkedJe.reference_number}`}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="space-y-0.5">
                              <label className="block text-[10px] font-bold text-slate-500 px-0.5 mb-0.5">{t('customers.form_opening_balance')}</label>
                              <div className="relative group">
                                <Wallet className={`absolute ${dir === 'rtl' ? 'right-2.5' : 'left-2.5'} top-2 text-emerald-500`} size={14} />
                                <FormattedNumberInput
                                  required
                                  className="w-full px-2.5 py-1.5 bg-white border border-emerald-200 rounded-lg text-xs font-black text-emerald-700 outline-none focus:ring-1 focus:ring-emerald-500 ps-7"
                                  value={formData.opening_balance}
                                  onChange={(val) => setFormData({ ...formData, opening_balance: val })}
                                  dir={dir === 'rtl' ? 'rtl' : 'ltr'}
                                />
                              </div>
                            </div>

                            <div className="space-y-0.5">
                              <label className="block text-[10px] font-bold text-slate-500 px-0.5 mb-0.5">{t('customers.form_balance_date')}</label>
                              <div className="relative group">
                                <Calendar className={`absolute ${dir === 'rtl' ? 'right-2.5' : 'left-2.5'} top-2 text-slate-400`} size={14} />
                                <input
                                  type="date"
                                  className={`w-full ${dir === 'rtl' ? 'pr-7 pl-2.5' : 'pl-7 pr-2.5'} py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-1 focus:ring-emerald-500`}
                                  value={formData.opening_balance_date}
                                  onChange={(e) => setFormData({ ...formData, opening_balance_date: e.target.value })}
                                />
                              </div>
                            </div>

                            {Math.abs(parseFloat(String(formData.opening_balance || 0).replace(/,/g, '')) || 0) > 0.0001 && (
                              <div className="sm:col-span-2 space-y-0.5">
                                <label className="block text-[10px] font-bold text-slate-500 px-0.5 mb-0.5">{t('customers.form_counter_account')}</label>
                                <div className="relative group">
                                  <Plus className={`absolute ${dir === 'rtl' ? 'right-2.5' : 'left-2.5'} top-2 text-slate-400`} size={14} />
                                  <select
                                    required
                                    className={`w-full ${dir === 'rtl' ? 'pr-7 pl-2.5' : 'pl-7 pr-2.5'} py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-1 focus:ring-emerald-500 appearance-none`}
                                    value={formData.counter_account_id}
                                    onChange={(e) => setFormData({ ...formData, counter_account_id: e.target.value })}
                                  >
                                    <option value="">{language === 'ar' ? 'اختر حساب الطرف الآخر...' : 'Select counter account...'}</option>
                                    {getCompatibleAccounts('opening_balance', accounts, formData.counter_account_id).map(account => (
                                      <option key={account.id} value={account.id}>{account.code} - {account.name}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            )}
                          </div>

                          {Math.abs(parseFloat(String(formData.opening_balance || 0).replace(/,/g, '')) || 0) > 0.0001 && formData.counter_account_id && (() => {
                            let finalAccountId = formData.account_id;
                            let finalCounterAccountId = formData.counter_account_id;

                            const account1 = accounts.find(a => a.id === finalAccountId);
                            const account2 = accounts.find(a => a.id === finalCounterAccountId);

                            const isAccountCustomer = (acc: any) => acc && (acc.name.includes('عملاء') || acc.name.includes('العملاء') || acc.code?.startsWith('12'));
                            const isAccountOpening = (acc: any) => acc && (acc.name.includes('رصيد') || acc.name.includes('ميزانية') || acc.name.includes('رأس') || acc.name.includes('راس') || acc.code?.startsWith('3'));

                            if (isAccountOpening(account1) && isAccountCustomer(account2)) {
                              finalAccountId = formData.counter_account_id;
                              finalCounterAccountId = formData.account_id;
                            }

                            const customerAccount = accounts.find(a => a.id === finalAccountId);
                            const counterAccount = accounts.find(a => a.id === finalCounterAccountId);

                            const openingBal = parseFloat(String(formData.opening_balance || 0).replace(/,/g, '')) || 0;
                            const hasOpeningBal = Math.abs(openingBal) > 0.0001;
                            const linkedJe = (editingCustomer?.id && hasOpeningBal) ? entries.find(e => 
                              (e.reference_id === editingCustomer.id || (editingCustomer.code && e.reference_number === editingCustomer.code)) && 
                              e.reference_type === 'opening_balance' &&
                              (Number(e.total_debit) > 0 || Number(e.total_credit) > 0)
                            ) : null;

                            return (
                              <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-200 shadow-inner">
                                <JournalEntryPreview 
                                  title={language === 'ar' ? 'معاينة قيد الرصيد' : 'Entry Preview'}
                                  entry_number={linkedJe?.entry_number}
                                  reference_number={linkedJe?.reference_number}
                                  items={[
                                    {
                                      account_code: customerAccount?.code || '',
                                      account_name: customerAccount?.name || '',
                                      debit: formData.opening_balance > 0 ? formData.opening_balance : 0,
                                      credit: formData.opening_balance < 0 ? Math.abs(formData.opening_balance) : 0,
                                      description: language === 'ar' ? `رصيد أول: ${formData.name}` : `Opening: ${formData.name}`
                                    },
                                    {
                                      account_code: counterAccount?.code || '',
                                      account_name: counterAccount?.name || '',
                                      debit: formData.opening_balance < 0 ? Math.abs(formData.opening_balance) : 0,
                                      credit: formData.opening_balance > 0 ? formData.opening_balance : 0,
                                      description: language === 'ar' ? `الطرف المقابل: ${formData.name}` : `Counter: ${formData.name}`
                                    }
                                  ]}
                                />
                              </div>
                            );
                          })()}
                        </div>

                        {/* Attachments Section */}
                        <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-200/60 space-y-2">
                          <AttachmentsManager
                            title={language === 'ar' ? 'المستندات والمرفقات' : 'Documents & Attachments'}
                            subtitle={language === 'ar' ? 'يمكن إرفاق صورة السجل التجاري، البطاقة الضريبية أو أية مستندات' : 'Attach tax card, CR, or any documents'}
                            attachments={formData.attachments}
                            onChange={(attachments) => setFormData({ ...formData, attachments })}
                          />
                        </div>
                      </div>
                    </div>
                  </form>
                </div>
              </div>

              {/* Audit Side */}
              {editingCustomer && (
                <div className="hidden xl:flex w-72 flex-col bg-slate-50/70 border-s border-slate-100 overflow-hidden">
                  <div className="p-2.5 border-b border-slate-100 bg-white/60 backdrop-blur-sm sticky top-0 z-10 flex items-center gap-2">
                    <div className="w-6 h-6 bg-white rounded-md shadow-xs flex items-center justify-center text-slate-400">
                      <History size={14} />
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 text-xs">{language === 'ar' ? 'سجل نشاط العميل' : 'Activity Log'}</span>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    <InlineActivityLog category="customers" documentId={editingCustomer.id} />
                  </div>
                </div>
              )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" dir={dir}>
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl p-8 animate-in zoom-in-95 duration-200 border border-slate-200 text-center">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
               <Trash2 size={32} />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">{t('common.delete_confirm')}</h3>
            <p className="text-slate-500 mb-8 font-medium leading-relaxed">{language === 'ar' ? 'هل أنت متأكد من رغبتك في حذف هذا العميل؟ سيتم إزالة كافة البيانات المرتبطة ولن نتمكن من التراجع.' : 'Are you sure you want to delete this customer? All associated data will be removed and this cannot be undone.'}</p>
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setCustomerToDelete(null);
                }}
                className="flex-1 py-4 bg-slate-50 text-slate-600 rounded-2xl font-bold hover:bg-slate-100 transition-all active:scale-95 border border-slate-200"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 active:scale-95"
              >
                {language === 'ar' ? 'تأكيد الحذف' : 'Delete Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      <PageActivityLog 
        category="customers" 
        isOpen={isActivityLogOpen} 
        onClose={() => {
          setIsActivityLogOpen(false);
          setActivityLogDocumentId(undefined);
        }} 
        documentId={activityLogDocumentId}
      />

      {showImportWizard && (
        <ExcelImportWizard
          module="customers"
          moduleNameAr="العملاء"
          onClose={() => setShowImportWizard(false)}
          onSuccess={() => setShowImportWizard(false)}
        />
      )}
    </div>
  );
};
