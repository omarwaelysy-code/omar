import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  Search, Plus, Trash2, X, Receipt as ReceiptIcon, Pencil, 
  CreditCard, Download, Eye, FileText, History, Printer, 
  Phone, Mail, MapPin, Wallet, Calendar, Hash, Layers, 
  LayoutGrid, List, Maximize2, Minimize2, ChevronRight, ChevronLeft, RotateCcw, User, ChevronDown, Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { exportToPDF as exportToPDFUtil } from '../utils/pdfUtils';
import { exportToExcel, formatDataForExcel } from '../utils/excelUtils';
import { dbService } from '../services/dbService';
import { PageActivityLog } from '../components/PageActivityLog';
import { InlineActivityLog } from '../components/InlineActivityLog';
import { JournalEntryPreview } from '../components/JournalEntryPreview';
import { TransactionSidePanel } from '../components/TransactionSidePanel';
import { ExportButtons } from '../components/ExportButtons';
import { SmartAIInput } from '../components/SmartAIInput';
import { TransactionManager } from '../services/TransactionManager';
import { VoucherSchema, JournalEntrySchema } from '../lib/schemas';
import { ActivityLog, ReceiptVoucher, Customer, Supplier, ExpenseCategory, PaymentMethod, JournalEntry, JournalEntryItem, Account, Company } from '../types';
import { formatNumber, formatDate, formatMoney } from '../utils/formatUtils';
import { PaginationControls } from '../components/PaginationControls';
import { useViewPreference } from '../hooks/useViewPreference';
import { CompanyInvoiceHeader } from '../components/CompanyInvoiceHeader';
import { useNavigation } from '../contexts/NavigationContext';

export const Receipts: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { showNotification } = useNotification();
  const { pendingViewDoc, setPendingViewDoc, setCurrentPage } = useNavigation();
  const [receipts, setReceipts] = useState<ReceiptVoucher[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
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
  const [internalRef, setInternalRef] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);

  const generateInternalRef = async (selectedDate: string) => {
    return await dbService.getNextSequence('receipt_vouchers', selectedDate);
  };
  

  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<ReceiptVoucher | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [receiptToDelete, setReceiptToDelete] = useState<string | null>(null);
  const [viewReceipt, setViewReceipt] = useState<ReceiptVoucher | null>(null);

  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [activityLogDocumentId, setActivityLogDocumentId] = useState<string | undefined>(undefined);
  const [previewJournalEntry, setPreviewJournalEntry] = useState<JournalEntry | null>(null);
  const [previewActivityLog, setPreviewActivityLog] = useState<Partial<ActivityLog> | null>(null);
  const [view, setView] = useViewPreference('receipts', 'table');
  const [companyData, setCompanyData] = useState<Company | null>(null);
  const receiptRef = React.useRef<HTMLDivElement>(null);
  const tableRef = React.useRef<HTMLDivElement>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
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
  const [voucherData, setVoucherData] = useState({
    internal_reference: '',
    manual_reference: '',
    items: [] as any[],
    customer_id: '',
    supplier_id: '',
    amount: 0,
    payment_method_id: '',
    date: new Date().toISOString().slice(0, 10),
    notes: ''
  });

  const [allInvoices, setAllInvoices] = useState<any[]>([]);
  const [allPayments, setAllPayments] = useState<any[]>([]);
  const [allJournalEntries, setAllJournalEntries] = useState<any[]>([]);
  const [allPurchaseInvoices, setAllPurchaseInvoices] = useState<any[]>([]);
  const [allReturns, setAllReturns] = useState<any[]>([]);
  const [allPurchaseReturns, setAllPurchaseReturns] = useState<any[]>([]);

  const generateSettlementSerial = (dateStr: string, allReceiptsList: any[], allPaymentsList: any[]) => {
    const dateParts = dateStr.slice(0, 10).split('-');
    const year = dateParts[0];
    const month = dateParts[1].padStart(2, '0');
    const prefix = `SET-${year}-${month}`;

    let maxSeq = 0;
    const checkVoucherItems = (vouchers: any[]) => {
      vouchers.forEach(v => {
        if (v.items && Array.isArray(v.items)) {
          v.items.forEach(item => {
            if (item.settlements && Array.isArray(item.settlements)) {
              item.settlements.forEach((s: any) => {
                if (s.settlement_number && s.settlement_number.startsWith(prefix)) {
                  const parts = s.settlement_number.split('-');
                  if (parts.length >= 4) {
                    const seq = parseInt(parts[parts.length - 1], 10);
                    if (!isNaN(seq) && seq > maxSeq) {
                      maxSeq = seq;
                    }
                  }
                }
              });
            }
          });
        }
      });
    };

    checkVoucherItems(allReceiptsList);
    checkVoucherItems(allPaymentsList);

    const nextSeq = String(maxSeq + 1).padStart(6, '0');
    return `${prefix}-${nextSeq}`;
  };

  const calculateOpenAmounts = (
    entity: any,
    entityType: 'customer' | 'supplier'
  ) => {
    const entityId = entity.id;
    const accountId = entity.account_id;
    const transactions: any[] = [];
    
    // Invoices / Purchase Invoices
    const relevantInvoices = entityType === 'customer'
      ? allInvoices.filter(inv => inv.customer_id === entityId && inv.payment_type === 'credit')
      : allPurchaseInvoices.filter(inv => inv.supplier_id === entityId && inv.payment_type === 'credit');
    
    relevantInvoices.forEach(inv => {
      transactions.push({
        id: inv.id,
        date: inv.date,
        type: entityType === 'customer' ? 'invoice' : 'purchase_invoice',
        type_label: entityType === 'customer' ? 'فاتورة مبيعات' : 'فاتورة مشتريات',
        reference_number: inv.invoice_number,
        entry_number: inv.entry_number || inv.invoice_number || '',
        original_amount: Number(inv.total_amount) || 0,
        open_amount: Number(inv.total_amount) || 0
      });
    });
    
    // Opening Balance
    const opBal = Number(entity.opening_balance) || 0;
    if (opBal !== 0) {
      const isDebitOpBal = entityType === 'customer' ? opBal > 0 : opBal < 0;
      if (isDebitOpBal) {
        transactions.push({
          id: `OPEN-${entityId}`,
          date: entity.opening_balance_date || '2026-01-01',
          type: 'opening_balance',
          type_label: 'رصيد افتتاحي',
          reference_number: `OPEN-${entity.code || entity.id.slice(0, 8)}`,
          entry_number: '-',
          original_amount: Math.abs(opBal),
          open_amount: Math.abs(opBal)
        });
      }
    }
    
    // Manual JEs
    allJournalEntries.forEach(je => {
      const standardTypes = ['invoice', 'purchase_invoice', 'receipt', 'receipt_voucher', 'payment', 'payment_voucher', 'return', 'purchase_return', 'opening_balance'];
      if (je.reference_type && standardTypes.includes(je.reference_type)) {
        return;
      }
      
      je.items?.forEach((item: any, idx: number) => {
        const matchesEntity = entityType === 'customer'
          ? item.customer_id === entityId
          : item.supplier_id === entityId;
          
        if (matchesEntity && item.account_id === accountId) {
          const isTargetLine = entityType === 'customer'
            ? (Number(item.debit) > 0)
            : (Number(item.credit) > 0);
            
          if (isTargetLine) {
            transactions.push({
              id: `${je.id}-${idx}`,
              date: je.date,
              type: 'journal',
              type_label: 'قيد يدوي',
              reference_number: je.reference_number || je.entry_number || je.id.slice(0, 8),
              entry_number: je.entry_number || '',
              original_amount: entityType === 'customer' ? Number(item.debit) : Number(item.credit),
              open_amount: entityType === 'customer' ? Number(item.debit) : Number(item.credit)
            });
          }
        }
      });
    });
    
    // Subtract settlements from other vouchers and invoices
    const getSettlementsForTarget = (targetId: string) => {
      let settledSum = 0;
      
      const sumVoucherSettlements = (vouchersList: any[]) => {
        vouchersList.forEach(v => {
          if (editingReceipt && v.id === editingReceipt.id) return;
          
          if (v.items && Array.isArray(v.items)) {
            v.items.forEach(item => {
              if (item.settlements && Array.isArray(item.settlements)) {
                item.settlements.forEach((s: any) => {
                  if (s.target_id === targetId) {
                    settledSum += Number(s.settled_amount) || 0;
                  }
                });
              }
            });
          }
        });
      };

      const sumInvoiceSettlements = (invoicesList: any[]) => {
        invoicesList.forEach(inv => {
          if (inv.settlements && Array.isArray(inv.settlements)) {
            inv.settlements.forEach((s: any) => {
              if (s.target_id === targetId) {
                settledSum += Number(s.settled_amount) || 0;
              }
            });
          }
        });
      };
      
      sumVoucherSettlements(receipts);
      sumVoucherSettlements(allPayments);
      sumInvoiceSettlements(allInvoices);
      sumInvoiceSettlements(allPurchaseInvoices);
      
      return settledSum;
    };

    const getInvoiceSettledAmount = (inv: any, entityType: 'customer' | 'supplier') => {
      let settled = 0;
      const targetId = inv.id;

      const sumVoucherSettlements = (vouchersList: any[]) => {
        vouchersList.forEach(v => {
          if (editingReceipt && v.id === editingReceipt.id) return;
          if (v.items && Array.isArray(v.items)) {
            v.items.forEach(item => {
              if (item.settlements && Array.isArray(item.settlements)) {
                item.settlements.forEach((s: any) => {
                  if (s.target_id === targetId) {
                    settled += Number(s.settled_amount) || 0;
                  }
                });
              }
            });
          }
        });
      };
      sumVoucherSettlements(receipts);
      sumVoucherSettlements(allPayments);
      
      const returnsList = entityType === 'customer' ? allReturns : allPurchaseReturns;
      returnsList.forEach(r => {
        const descMatches = r.description?.toLowerCase().includes(inv.invoice_number.toLowerCase()) ||
                            r.notes?.toLowerCase().includes(inv.invoice_number.toLowerCase()) ||
                            r.return_number?.toLowerCase().includes(inv.invoice_number.toLowerCase());
        
        const isCorrectEntity = entityType === 'customer'
          ? r.customer_id === inv.customer_id 
          : r.supplier_id === inv.supplier_id;
          
        if (descMatches && isCorrectEntity) {
          settled += Number(r.total_amount) || 0;
        }
      });

      allJournalEntries.forEach(je => {
        if (je.reference_id === inv.id || je.reference_number === inv.invoice_number) {
          return;
        }
        
        const standardTypes = ['invoice', 'purchase_invoice', 'receipt', 'payment', 'return', 'purchase_return', 'opening_balance', 'receipt_voucher', 'payment_voucher'];
        if (je.reference_type && standardTypes.includes(je.reference_type)) {
          return;
        }

        const jeDescMatches = je.description?.toLowerCase().includes(inv.invoice_number.toLowerCase()) ||
                              je.reference_number?.toLowerCase().includes(inv.invoice_number.toLowerCase());
                              
        je.items?.forEach((item: any) => {
          const isCorrectAccount = entityType === 'customer'
            ? item.customer_id === inv.customer_id
            : item.supplier_id === inv.supplier_id;
            
          if (isCorrectAccount) {
            const isSettlingLine = entityType === 'customer'
              ? (Number(item.credit) > 0)
              : (Number(item.debit) > 0);
              
            const lineDescMatches = item.description?.toLowerCase().includes(inv.invoice_number.toLowerCase());
            
            if (isSettlingLine && (jeDescMatches || lineDescMatches)) {
              settled += entityType === 'customer' ? Number(item.credit) : Number(item.debit);
            }
          }
        });
      });

      if (inv.settlements && Array.isArray(inv.settlements)) {
        inv.settlements.forEach((s: any) => {
          settled += Number(s.settled_amount) || 0;
        });
      }

      return settled;
    };
    
    transactions.forEach(t => {
      let settledAmount = 0;
      if (t.type === 'invoice' || t.type === 'purchase_invoice') {
        const invObj = t.type === 'invoice'
          ? allInvoices.find(i => i.id === t.id)
          : allPurchaseInvoices.find(i => i.id === t.id);
        if (invObj) {
          settledAmount = getInvoiceSettledAmount(invObj, entityType);
        }
      } else {
        settledAmount = getSettlementsForTarget(t.id);
      }
      t.open_amount = Math.max(0, t.original_amount - settledAmount);
    });
    
    return transactions.filter(t => t.open_amount > 0.01);
  };

  const handleSettlementChange = (
    itemIdx: number, 
    targetTx: any, 
    amount: number
  ) => {
    const newItems = [...voucherData.items];
    const item = newItems[itemIdx];
    const settlements = [...(item.settlements || [])];
    
    const existingIdx = settlements.findIndex(s => s.target_id === targetTx.id);
    
    if (amount <= 0) {
      if (existingIdx > -1) {
        settlements.splice(existingIdx, 1);
      }
    } else {
      const settlementObj = {
        target_id: targetTx.id,
        settled_amount: amount,
        reference_number: targetTx.reference_number,
        entry_number: targetTx.entry_number,
        type: targetTx.type,
        type_label: targetTx.type_label,
        date: targetTx.date,
        original_amount: targetTx.original_amount
      };
      if (existingIdx > -1) {
        settlements[existingIdx] = settlementObj;
      } else {
        settlements.push(settlementObj);
      }
    }
    
    item.settlements = settlements;
    
    setVoucherData({
      ...voucherData,
      items: newItems
    });
  };

  useEffect(() => {
    if (!isModalOpen) return;
    let changed = false;
    const updatedItems = voucherData.items.map((item: any) => {
      const isEntity = item.type === 'customer' || item.type === 'supplier';
      if (isEntity && item.entity_id && !item.settlement_number) {
        changed = true;
        const serial = generateSettlementSerial(item.settlement_date || voucherData.date, receipts, allPayments);
        return {
          ...item,
          settlement_date: item.settlement_date || voucherData.date,
          settlement_number: serial,
          settlements: item.settlements || []
        };
      }
      return item;
    });
    
    if (changed) {
      setVoucherData(prev => ({ ...prev, items: updatedItems }));
    }
  }, [voucherData.items, voucherData.date, receipts, allPayments, isModalOpen]);

  const subAccounts = [
    ...customers.map(c => ({ id: c.id, name: c.name, type: 'customer' as const, label: `عميل: ${c.name}` })),
    ...suppliers.map(s => ({ id: s.id, name: s.name, type: 'supplier' as const, label: `مورد: ${s.name}` })),
    ...paymentMethods.map(p => ({ id: p.id, name: p.name, type: 'payment_method' as const, label: `خزينة/بنك: ${p.name}` }))
  ];

  useEffect(() => {
    if (user) {
      const unsubItems = dbService.subscribePaginated('receipt_vouchers', {
        company_id: user.company_id,
        _page: page,
        _limit: limit,
        _sortBy: sortBy,
        _sortOrder: sortOrder,
        _search: searchTerm
      }, (result: any) => {
        setReceipts(result.data);
        setTotalRecords(result.total);
        setServerSummary(result.summary);
      });
      const unsubCustomers = dbService.subscribe<Customer>('customers', user.company_id, setCustomers);
      const unsubSuppliers = dbService.subscribe<Supplier>('suppliers', user.company_id, setSuppliers);
      const unsubCategories = dbService.subscribe<ExpenseCategory>('expense_categories', user.company_id, setCategories);
      const unsubPM = dbService.subscribe<PaymentMethod>('payment_methods', user.company_id, setPaymentMethods);
      const unsubAccounts = dbService.subscribe<any>('accounts', user.company_id, setAccounts);
      const unsubInvoices = dbService.subscribe<any>('invoices', user.company_id, setAllInvoices);
      const unsubPayments = dbService.subscribe<any>('payment_vouchers', user.company_id, setAllPayments);
      const unsubJournalEntries = dbService.subscribe<any>('journal_entries', user.company_id, setAllJournalEntries);
      const unsubPurchaseInvoices = dbService.subscribe<any>('purchase_invoices', user.company_id, setAllPurchaseInvoices);
      const unsubReturns = dbService.subscribe<any>('returns', user.company_id, setAllReturns);
      const unsubPR = dbService.subscribe<any>('purchase_returns', user.company_id, setAllPurchaseReturns);
      
      const fetchCompany = async () => {
        try {
          const company = await dbService.get<Company>('companies', user.company_id);
          if (company) setCompanyData(company);
        } catch (error) {
          console.error('Failed to load company data:', error);
        }
      };
      
      fetchCompany();
      setLoading(false);
      return () => {
        unsubItems();
        unsubCustomers();
        unsubSuppliers();
        unsubCategories();
        unsubPM();
        unsubAccounts();
        unsubInvoices();
        unsubPayments();
        unsubJournalEntries();
        unsubPurchaseInvoices();
        unsubReturns();
        unsubPR();
      };
    }
  }, [user, page, limit, sortBy, sortOrder, searchTerm]);

  useEffect(() => {
    if (!editingReceipt && !internalRef && !loading && isModalOpen) {
      const updateNum = async () => {
        const num = await generateInternalRef(voucherData.date);
        setInternalRef(num);
      };
      updateNum();
    }
  }, [editingReceipt, loading, isModalOpen, voucherData.date]);

  // Real-time Preview Logic
  useEffect(() => {
    if (!isModalOpen || !user) {
      setPreviewJournalEntry(null);
      setPreviewActivityLog(null);
      return;
    }

    const generatePreview = () => {
      const totalPreviewAmount = voucherData.items.reduce((sum, item) => sum + item.amount, 0);
      if (totalPreviewAmount <= 0) {
        setPreviewJournalEntry(null);
        setPreviewActivityLog(null);
        return;
      }

      const paymentMethod = paymentMethods.find(pm => pm.id === voucherData.payment_method_id);
      const receipt_number = 'REC-PREVIEW';

      // Preview Activity Log
      setPreviewActivityLog({
        action: 'إضافة سند قبض',
        details: `إضافة سند قبض جديد بمبلغ ${formatNumber(totalPreviewAmount)}`,
        created_at: new Date().toISOString(),
        entity: 'receipts'
      });

      // Preview Journal Entry
      const journalItems: JournalEntryItem[] = [];

      voucherData.items.forEach(item => {
        let creditAccountId = '';
        let creditAccountName = '';
        let subAccountId = undefined;
        let subAccountType = undefined;

        if (item.type === 'customer') {
          const customer = customers.find(c => c.id === item.entity_id);
          creditAccountId = customer?.account_id || '';
          creditAccountName = customer?.account_name || '';
          subAccountId = customer?.id;
          subAccountType = 'customer';
        } else if (item.type === 'supplier') {
          const supplier = suppliers.find(s => s.id === item.entity_id);
          creditAccountId = supplier?.account_id || '';
          creditAccountName = supplier?.account_name || '';
          subAccountId = supplier?.id;
          subAccountType = 'supplier';
        } else if (item.type === 'expense') {
          const category = categories.find(c => c.id === item.entity_id);
          creditAccountId = category?.account_id || '';
          creditAccountName = category?.name || '';
          subAccountId = category?.id;
          subAccountType = 'expense';
        } else {
          const account = accounts.find(a => a.id === item.entity_id);
          creditAccountId = account?.id || '';
          creditAccountName = account?.name || '';
          
          if (account?.required_sub_account && item.sub_account_id) {
            const subAccount = subAccounts.find((sa: any) => sa.id === item.sub_account_id);
            subAccountId = item.sub_account_id;
            subAccountType = subAccount?.type;
          }
        }

        if (item.amount > 0) {
          journalItems.push({
            account_id: creditAccountId || 'credit_account_missing',
            account_name: creditAccountName || 'حساب دائن مفقود',
            debit: 0,
            credit: item.amount,
            description: item.description || `سند قبض رقم ${receipt_number} - ${voucherData.notes}`,
            sub_account_id: subAccountId,
            sub_account_type: subAccountType as 'customer' | 'supplier' | undefined,
            customer_id: item.type === 'customer' ? item.entity_id : undefined,
            supplier_id: item.type === 'supplier' ? item.entity_id : undefined,
          });
        }
      });

      // Debit: Payment Method (Cash/Bank)
      let debitAccountId = paymentMethod?.account_id || '';
      let debitAccountName = paymentMethod?.name || '';
      
      if (!debitAccountId) {
        const fallbackAccount = accounts.find(a => 
          a.name.includes('صندوق') || a.name.includes('بنك') || a.name.includes('خزينة')
        );
        debitAccountId = fallbackAccount?.id || 'cash_account_default';
        debitAccountName = fallbackAccount?.name || 'حساب الصندوق (افتراضي)';
      }

      journalItems.push({
        account_id: debitAccountId,
        account_name: debitAccountName,
        debit: totalPreviewAmount,
        credit: 0,
        description: `سند قبض رقم ${receipt_number} - ${totalPreviewAmount}`,
        sub_account_id: paymentMethod?.id,
        sub_account_type: 'payment_method'
      });

      setPreviewJournalEntry({
        id: 'preview',
        date: voucherData.date,
        reference_number: receipt_number,
        reference_id: 'preview',
        reference_type: 'receipt',
        description: `قيد سند قبض رقم ${receipt_number}`,
        items: journalItems,
        total_debit: totalPreviewAmount,
        total_credit: totalPreviewAmount,
        company_id: user.company_id,
        created_at: new Date().toISOString(),
        created_by: user.id
      });
    };

    generatePreview();
  }, [isModalOpen, voucherData, user, customers, suppliers, categories, paymentMethods, accounts]);

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

      await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة عميل', `إضافة عميل جديد من سند القبض: ${customerFormData.name}`, ['customers', 'receipt_vouchers']);
      
      setVoucherData({ ...voucherData, customer_id: customerId });
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
      await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة طريقة دفع', `إضافة طريقة دفع جديدة من سند القبض: ${paymentMethodFormData.name}`, ['payment_methods', 'receipt_vouchers'], pmId);
      
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

      setVoucherData({ ...voucherData, payment_method_id: pmId });
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

    const finalAmount = voucherData.items.reduce((sum, item) => sum + item.amount, 0);
    if (finalAmount <= 0) {
      showNotification('يرجى إدخال مبلغ صحيح', 'error');
      return;
    }

    // Validation: check if settlement sum is greater than the item amount
    for (let i = 0; i < voucherData.items.length; i++) {
      const item = voucherData.items[i];
      if ((item.type === 'customer' || item.type === 'supplier') && item.entity_id) {
        const totalSettled = (item.settlements || []).reduce((sum: number, s: any) => sum + Number(s.settled_amount), 0);
        if (totalSettled > item.amount) {
          showNotification('التسوية أكبر من المبلغ الإجمالي', 'error');
          return;
        }
      }
    }

    try {
      const paymentMethod = paymentMethods.find(pm => pm.id === voucherData.payment_method_id);
      const receipt_number = editingReceipt 
        ? (editingReceipt.voucher_number || editingReceipt.id) 
        : (internalRef || `RCPT-${Date.now().toString().slice(-6)}`);
      
      const mappedItems = voucherData.items.map(item => {
        let name = '';
        if (item.type === 'customer') {
          name = customers.find(c => c.id === item.entity_id)?.name || '';
        } else if (item.type === 'supplier') {
          name = suppliers.find(s => s.id === item.entity_id)?.name || '';
        } else if (item.type === 'expense') {
          name = categories.find(c => c.id === item.entity_id)?.name || '';
        } else {
          name = accounts.find(a => a.id === item.entity_id)?.name || '';
        }
        return {
          ...item,
          entity_name: name
        };
      });

      let mainCustomerId = '';
      if (voucherData.items.length > 0 && voucherData.items[0].type === 'customer') {
        mainCustomerId = voucherData.items[0].entity_id;
      }

      const entityNames = mappedItems.map(item => item.entity_name).filter(Boolean);
      const combinedCustomerName = entityNames.length > 0 
        ? entityNames.join(', ') 
        : 'حساب عام / جهات متعددة';

      const receiptData: any = {
        voucher_number: receipt_number,
        internal_reference: voucherData.internal_reference,
        manual_reference: voucherData.manual_reference,
        date: voucherData.date,
        amount: finalAmount,
        description: voucherData.notes,
        customer_id: mainCustomerId || null,
        customer_name: combinedCustomerName,
        payment_method_id: voucherData.payment_method_id || null,
        payment_method_name: paymentMethod?.name || '',
        account_id: paymentMethod?.account_id || null,
        type: 'receipt' as const,
        company_id: user.company_id,
        created_at: editingReceipt?.created_at || new Date().toISOString(),
        created_by: editingReceipt?.created_by || user.id,
        voucher_type: 'multi',
        items: mappedItems
      };

      const journalItems: any[] = [];

      voucherData.items.forEach(item => {
        let creditAccountId = '';
        let creditAccountName = '';
        let subAccountId = undefined;
        let subAccountType = undefined;

        if (item.type === 'customer') {
          const customer = customers.find(c => c.id === item.entity_id);
          creditAccountId = customer?.account_id || '';
          creditAccountName = customer?.account_name || '';
          subAccountId = customer?.id;
          subAccountType = 'customer';
        } else if (item.type === 'supplier') {
          const supplier = suppliers.find(s => s.id === item.entity_id);
          creditAccountId = supplier?.account_id || '';
          creditAccountName = supplier?.account_name || '';
          subAccountId = supplier?.id;
          subAccountType = 'supplier';
        } else if (item.type === 'expense') {
          const category = categories.find(c => c.id === item.entity_id);
          creditAccountId = category?.account_id || '';
          creditAccountName = category?.name || '';
          subAccountId = category?.id;
          subAccountType = 'expense';
        } else {
          const account = accounts.find(a => a.id === item.entity_id);
          creditAccountId = account?.id || '';
          creditAccountName = account?.name || '';
          
          if (account?.required_sub_account && item.sub_account_id) {
            const subAccount = subAccounts.find((sa: any) => sa.id === item.sub_account_id);
            subAccountId = item.sub_account_id;
            subAccountType = subAccount?.type;
          }
        }

        journalItems.push({
          account_id: creditAccountId,
          account_name: creditAccountName,
          debit: 0,
          credit: item.amount,
          description: (item.description || `سند قبض رقم ${receipt_number}`) + (voucherData.notes ? ` - ${voucherData.notes}` : ''),
          sub_account_id: subAccountId,
          sub_account_type: subAccountType,
          customer_id: item.type === 'customer' ? item.entity_id : undefined,
          supplier_id: item.type === 'supplier' ? item.entity_id : undefined,
        });
      });

      // Debit: Payment Method
      let debitAccountId = paymentMethod?.account_id || '';
      let debitAccountName = paymentMethod?.name || '';
      if (!debitAccountId) {
        const fallback = accounts.find(a => 
          a.name.includes('نقدية') || a.name.includes('خزينة') || a.name.includes('صندوق') || a.name.includes('بنك')
        );
        debitAccountId = fallback?.id || 'cash_account_default';
        debitAccountName = fallback?.name || 'حساب النقدية (افتراضي)';
      }

      journalItems.push({
        account_id: debitAccountId,
        account_name: debitAccountName,
        debit: finalAmount,
        credit: 0,
        description: `سند قبض رقم ${receipt_number} إلى حساب: ${paymentMethod?.name}` + (voucherData.notes ? ` - ${voucherData.notes}` : ''),
        sub_account_id: paymentMethod?.id,
        sub_account_type: 'payment_method'
      });

      const journalEntryData = {
        date: voucherData.date,
        reference_number: receipt_number,
        reference_type: 'receipt',
        description: `قيد سند قبض رقم ${receipt_number}`,
        items: journalItems,
        total_debit: finalAmount,
        total_credit: finalAmount,
        company_id: user.company_id,
        created_at: new Date().toISOString(),
        created_by: user.id
      };

      if (editingReceipt) {
        await dbService.deleteJournalEntryByReference(editingReceipt.id, user.company_id);
        await TransactionManager.updateWithAccounting(
          'receipt_vouchers',
          editingReceipt.id,
          receiptData,
          VoucherSchema,
          journalEntryData,
          JournalEntrySchema
        );
      } else {
        await TransactionManager.saveWithAccounting(
          'receipt_vouchers',
          receiptData,
          VoucherSchema,
          journalEntryData,
          JournalEntrySchema
        );
      }

      showNotification(editingReceipt ? 'تم تحديث سند القبض بنجاح' : 'تم إضافة سند القبض بنجاح', 'success');
      closeModal();

      if (!editingReceipt) {
        dbService.logActivity(user.id, user.username, user.company_id, 'إضافة سند قبض', `إضافة سند قبض جديد بقيمة: ${finalAmount}`, 'receipt_vouchers');
      }

    } catch (e: any) {
      console.error('Save failed:', e);
      showNotification(e.message || 'حدث خطأ أثناء حفظ السند', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    setReceiptToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!receiptToDelete || !user) return;
    try {
      const receipt = receipts.find(r => r.id === receiptToDelete);
      
      // Delete associated journal entry
      await dbService.deleteJournalEntryByReference(receiptToDelete, user.company_id);
      
      await dbService.delete('receipt_vouchers', receiptToDelete);
      await dbService.logActivity(user.id, user.username, user.company_id, 'حذف سند قبض', `حذف سند قبض للعميل: ${receipt?.customer_name}`, 'receipt_vouchers');
      showNotification(t('common.delete_success'), 'success');
      setIsDeleteModalOpen(false);
      setReceiptToDelete(null);
    } catch (e: any) {
      console.error(e);
      showNotification(e.message || t('common.delete_error'), 'error');
    }
  };

  const openEditModal = async (receipt: ReceiptVoucher) => {
    console.log('[EDIT] Opening edit modal for receipt ID:', receipt.id);
    try {
      const fullData = await dbService.get<ReceiptVoucher>('receipt_vouchers', receipt.id);
      console.log('[EDIT] Receipt details from API:', fullData);
      
      if (!fullData) throw new Error('Receipt not found');

      setEditingReceipt(fullData);
      setInternalRef(fullData.voucher_number || '');
      
      const loadedItems = fullData.items && fullData.items.length > 0
        ? fullData.items
        : [{
            type: 'customer' as const,
            entity_id: fullData.customer_id || '',
            amount: fullData.amount,
            description: fullData.description || ''
          }];

      setVoucherData({
        internal_reference: fullData.internal_reference || fullData.voucher_number || '',
        manual_reference: fullData.manual_reference || '',
        items: loadedItems,
        customer_id: fullData.customer_id || '',
        supplier_id: fullData.supplier_id || '',
        amount: fullData.amount,
        payment_method_id: fullData.payment_method_id || '',
        date: fullData.date ? fullData.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
        notes: fullData.description || ''
      });
      setIsModalOpen(true);
      console.log('[EDIT] Form updated with receipt:', fullData.id);
    } catch (error: any) {
      console.error('[EDIT] Error loading receipt:', error);
      showNotification('فشل تحميل بيانات سند القبض', 'error');
    }
  };

  useEffect(() => {
    if (pendingViewDoc && pendingViewDoc.type === 'receipt' && user) {
      const loadPendingDoc = async () => {
        try {
          const existing = receipts.find(r => r.voucher_number === pendingViewDoc.idOrNumber || r.id === pendingViewDoc.idOrNumber);
          if (existing) {
            openEditModal(existing);
            setPendingViewDoc(null);
            return;
          }
          const docs = await dbService.getDocsByFilter<any>('receipt_vouchers', user.company_id, [
            { field: 'voucher_number', operator: '==', value: pendingViewDoc.idOrNumber }
          ]);
          if (docs && docs.length > 0) {
            openEditModal(docs[0]);
          } else {
            const docById = await dbService.get<any>('receipt_vouchers', pendingViewDoc.idOrNumber);
            if (docById) {
              openEditModal(docById);
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
  }, [pendingViewDoc, receipts, user, setPendingViewDoc]);

  const handleViewReceipt = (receipt: ReceiptVoucher) => {
    setViewReceipt(receipt);
  };

  const exportToPDF = async (receipt: ReceiptVoucher) => {
    if (!receiptRef.current) return;
    try {
      await exportToPDFUtil(receiptRef.current, {
        filename: `Receipt-${receipt.id}.pdf`,
        margin: 10,
        orientation: 'portrait'
      });
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء تصدير PDF', 'error');
    }
  };

  const handleExportExcel = () => {
    const formattedData = formatDataForExcel(filteredReceipts, {
      'receipt_number': t('receipts.column_number'),
      'customer_name': t('receipts.column_customer'),
      'date': t('receipts.column_date'),
      'amount': t('receipts.column_amount'),
      'description': t('receipts.column_description')
    });
    exportToExcel(formattedData, { filename: 'Receipts_Report', sheetName: t('receipts.title') });
  };

  const handleExportPDF = async () => {
    if (tableRef.current) {
      await exportToPDFUtil(tableRef.current, { filename: 'Receipts_Report', orientation: 'landscape' });
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingReceipt(null);
    setInternalRef('');
    setVoucherData({
      internal_reference: '',
      manual_reference: '',
      items: [],
      customer_id: '',
      supplier_id: '',
      amount: 0,
      payment_method_id: '',
      date: new Date().toISOString().slice(0, 10),
      notes: ''
    });
  };

  const handlePrevReceipt = () => {
    if (!editingReceipt) return;
    const currentIndex = receipts.findIndex(r => r.id === editingReceipt.id);
    if (currentIndex > 0) {
      openEditModal(receipts[currentIndex - 1]);
    }
  };

  const handleNextReceipt = () => {
    if (!editingReceipt) return;
    const currentIndex = receipts.findIndex(r => r.id === editingReceipt.id);
    if (currentIndex < receipts.length - 1) {
      openEditModal(receipts[currentIndex + 1]);
    }
  };

  const filteredReceipts = receipts.filter(r => 
    r.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir={dir}>
      {!isModalOpen ? (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">{t('receipts.title')}</h2>
          <p className="text-zinc-500">{t('receipts.subtitle')}</p>
          {serverSummary.total_amount !== undefined && (
            <div className="mt-2 flex items-center gap-4 text-sm">
               <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100 font-bold">
                 إجمالي المقبوضات: {formatMoney(serverSummary.total_amount)}
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
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-200"
          >
            <Plus size={20} />
            {t('receipts.add')}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden no-pdf">
        <div className="p-6 border-b border-zinc-50 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
            <input
              type="text"
              placeholder={language === 'ar' ? "البحث عن سندات..." : "Search receipts..."}
              className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2 bg-zinc-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex bg-zinc-100 p-1 rounded-xl">
            <button
              onClick={() => setView('table')}
              className={`p-2 rounded-lg transition-all ${view === 'table' ? 'bg-white text-emerald-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
              title={language === 'ar' ? 'عرض الجدول' : 'Table View'}
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setView('card')}
              className={`p-2 rounded-lg transition-all ${view === 'card' ? 'bg-white text-emerald-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
              title={language === 'ar' ? 'عرض الكروت' : 'Card View'}
            >
              <LayoutGrid size={18} />
            </button>
          </div>
        </div>

        {view === 'table' ? (
          <div ref={tableRef} id="receipts-list-table" className="hidden md:block overflow-x-auto">
            <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
              <thead>
                <tr className="bg-zinc-50/50 text-zinc-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-bold cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('voucher_number')}>
                    <div className="flex items-center gap-1">
                      الرقم
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {sortBy === 'voucher_number' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className="px-6 py-4 font-bold">العميل</th>
                  <th className="px-6 py-4 font-bold cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('date')}>
                    <div className="flex items-center gap-1">
                      التاريخ
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {sortBy === 'date' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className="px-6 py-4 font-bold">طريقة السداد</th>
                  <th className="px-6 py-4 font-bold cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('amount')}>
                    <div className="flex items-center gap-1">
                      المبلغ
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {sortBy === 'amount' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className={`px-6 py-4 font-bold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{language === 'ar' ? 'رقم القيد' : 'Entry No.'}</th>
                  <th className={`px-6 py-4 font-bold ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filteredReceipts.map((receipt) => (
                  <tr 
                    key={receipt.id} 
                    className="hover:bg-zinc-50/50 transition-colors group cursor-pointer"
                    onClick={() => openEditModal(receipt)}
                  >
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs bg-emerald-50 px-2 py-1 rounded text-emerald-700 font-bold border border-emerald-100">{receipt.voucher_number}</span>
                    </td>
                    <td className="px-6 py-4 font-bold text-zinc-900">{receipt.customer_name}</td>
                    <td className="px-6 py-4 text-zinc-500">{formatDate(receipt.date)}</td>
                    <td className="px-6 py-4">
                      {receipt.payment_method_name ? (
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                          {receipt.payment_method_name}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-bold text-emerald-600">{formatNumber(receipt.amount)} {t('common.currency')}</td>
                    <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                      {receipt.entry_number ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingViewDoc({ type: 'journal', idOrNumber: receipt.entry_number! });
                            setCurrentPage('journal_entries');
                          }}
                          className="text-emerald-600 hover:text-emerald-700 hover:underline font-mono text-xs font-bold bg-emerald-50 px-2 py-1 rounded border border-emerald-100/50 transition-all active:scale-95"
                        >
                          {receipt.entry_number}
                        </button>
                      ) : (
                        <span className="text-slate-400 font-mono text-xs">-</span>
                      )}
                    </td>
                    <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>
                      <div className={`flex items-center ${dir === 'rtl' ? 'justify-start' : 'justify-end'} gap-2 opacity-0 group-hover:opacity-100 transition-opacity no-pdf`}>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActivityLogDocumentId(receipt.id);
                            setIsActivityLogOpen(true);
                          }}
                          className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-all"
                          title="سجل النشاط"
                        >
                          <History size={18} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewReceipt(receipt);
                          }}
                          className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                        >
                          <Eye size={18} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(receipt);
                          }}
                          className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                        >
                          <Pencil size={18} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(receipt.id);
                          }}
                          className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredReceipts.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-zinc-500 italic">لا توجد سندات قبض.</td>
                  </tr>
                )}
              </tbody>
            </table>
            <PaginationControls page={page} limit={limit} total={totalRecords} onPageChange={setPage} onLimitChange={setLimit} />
          </div>
        ) : (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredReceipts.map((receipt) => (
              <div 
                key={receipt.id} 
                onClick={() => openEditModal(receipt)}
                className="p-6 bg-zinc-50/50 rounded-3xl border border-zinc-100 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5 transition-all group relative overflow-hidden cursor-pointer"
              >
                <div className="absolute top-4 left-4 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewReceipt(receipt);
                    }}
                    className="p-2 bg-white text-emerald-500 rounded-xl border border-emerald-50 shadow-sm hover:bg-emerald-50 transition-all font-bold"
                  >
                    <Eye size={16} />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(receipt);
                    }}
                    className="p-2 bg-white text-blue-500 rounded-xl border border-blue-50 shadow-sm hover:bg-blue-50 transition-all font-bold"
                  >
                    <Pencil size={16} />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(receipt.id);
                    }}
                    className="p-2 bg-white text-red-500 rounded-xl border border-red-50 shadow-sm hover:bg-red-50 transition-all font-bold"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="flex justify-between items-start">
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-[10px] bg-white px-2 py-1 rounded text-emerald-700 font-bold w-fit border border-emerald-100">{receipt.voucher_number}</span>
                    <h4 className="font-bold text-zinc-900 group-hover:text-emerald-700 transition-colors text-xl mt-1 tracking-tight">{receipt.customer_name}</h4>
                  </div>
                  {receipt.entry_number && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingViewDoc({ type: 'journal', idOrNumber: receipt.entry_number! });
                        setCurrentPage('journal_entries');
                      }}
                      className="font-mono text-[9px] bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded text-emerald-700 font-bold border border-emerald-100/50 transition-all active:scale-95 z-10"
                    >
                      {receipt.entry_number}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-200/50 mt-4">
                  <div className="space-y-1">
                    <p className="text-zinc-400 text-[10px] uppercase font-black tracking-widest">{t('common.date')}</p>
                    <p className="text-zinc-900 font-bold text-sm tracking-tight">{formatDate(receipt.date)}</p>
                  </div>
                  <div className="space-y-1 text-left">
                    <p className="text-zinc-400 text-[10px] uppercase font-black tracking-widest">المبلغ</p>
                    <p className="font-black text-2xl tracking-tighter text-emerald-600">
                      {formatNumber(receipt.amount)} <span className="text-sm font-bold">{t('common.currency')}</span>
                    </p>
                  </div>
                  <div className="col-span-2 space-y-1 mt-1 pt-3 border-t border-zinc-200/50 flex justify-between items-end">
                    <span className="text-xs font-bold text-emerald-600 bg-white px-2 py-1 rounded-lg border border-emerald-50">
                      {receipt.payment_method_name || '-'}
                    </span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivityLogDocumentId(receipt.id);
                        setIsActivityLogOpen(true);
                      }}
                      className="p-2 text-zinc-400 hover:text-emerald-500 bg-white border border-zinc-100 rounded-xl transition-all"
                      title="سجل النشاط"
                    >
                      <History size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {filteredReceipts.length === 0 && (
              <div className="col-span-full p-12 text-center text-zinc-500 font-bold italic">لا توجد سندات قبض.</div>
            )}
          </div>
        )}
      </div>
    </>
  ) : (
    <div className="bg-white rounded-3xl border border-zinc-200 shadow-md overflow-hidden animate-in slide-in-from-bottom-4 duration-300 flex flex-col min-h-[80vh] relative">
          {/* Form Header */}
          <div className="p-4 md:p-6 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-[70]">
            <div className="flex items-center gap-3">
              <button 
                onClick={closeModal} 
                className="flex items-center gap-2 px-4 py-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all font-black text-sm"
              >
                {dir === 'rtl' ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                <span>{language === 'ar' ? 'العودة للقائمة' : 'Back to list'}</span>
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
              {editingReceipt && (
                <div className="hidden lg:flex items-center gap-2 bg-zinc-100 p-1.5 rounded-2xl">
                  <button 
                    type="button"
                    onClick={handlePrevReceipt}
                    className="flex items-center gap-1 px-3 py-1.5 hover:bg-white rounded-xl transition-all text-zinc-600 disabled:opacity-30 text-xs font-black"
                    disabled={receipts.findIndex(r => r.id === editingReceipt.id) === 0}
                  >
                    {dir === 'rtl' ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    {language === 'ar' ? 'السابق' : 'Prev'}
                  </button>
                  <button 
                    type="button"
                    onClick={handleNextReceipt}
                    className="flex items-center gap-1 px-3 py-1.5 hover:bg-white rounded-xl transition-all text-zinc-600 disabled:opacity-30 text-xs font-black"
                    disabled={receipts.findIndex(r => r.id === editingReceipt.id) === receipts.length - 1}
                  >
                    {language === 'ar' ? 'التالي' : 'Next'}
                    {dir === 'rtl' ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                  </button>
                </div>
              )}
              <h3 className="text-xl md:text-2xl font-black text-zinc-900 tracking-tight">
                {editingReceipt ? 'تعديل سند قبض' : 'إضافة سند قبض'}
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
                        documentId={editingReceipt?.id || ''}
                        category="receipt_vouchers" 
                        previewJournalEntry={previewJournalEntry}
                        previewActivityLog={previewActivityLog}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 pb-32 md:pb-8">
              <SmartAIInput 
                onDataExtracted={(data) => {
                  if (data.customerName) {
                    const customer = customers.find(c => c.name.includes(data.customerName!) || data.customerName!.includes(c.name));
                    if (customer) {
                      setVoucherData(prev => {
                        const items = [...prev.items];
                        if (items.length === 0) {
                          items.push({ type: 'customer', entity_id: customer.id, amount: data.amount || 0, description: data.description || '' });
                        } else {
                          items[0].entity_id = customer.id;
                          items[0].type = 'customer';
                        }
                        return { ...prev, items };
                      });
                    }
                  }
                  if (data.amount) {
                    setVoucherData(prev => {
                      const items = [...prev.items];
                      if (items.length === 0) {
                        items.push({ type: 'customer', entity_id: '', amount: data.amount!, description: data.description || '' });
                      } else {
                        items[0].amount = data.amount!;
                      }
                      return { ...prev, amount: data.amount!, items };
                    });
                  }
                  if (data.date) setVoucherData(prev => ({ ...prev, date: data.date! }));
                  if (data.description) {
                    setVoucherData(prev => {
                      const items = [...prev.items];
                      if (items.length > 0) {
                        items[0].description = data.description!;
                      }
                      return { ...prev, notes: data.description!, items };
                    });
                  }
                  if (data.paymentMethod) {
                    const pm = paymentMethods.find(p => p.name.includes(data.paymentMethod!) || data.paymentMethod!.includes(p.name));
                    if (pm) setVoucherData(prev => ({ ...prev, payment_method_id: pm.id }));
                  }
                }}
                transactionType="receipt_voucher"
              />
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-3 space-y-6">
                  {/* Card 1: Basic Info */}
                  <section className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm space-y-6 relative pt-12">
                    <div className="absolute top-4 right-4 flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                      <FileText className="w-4 h-4" />
                      <span className="text-xs font-bold">البيانات الأساسية</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">رقم السند</label>
                        <div className="relative">
                          <Hash className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                          <input 
                            readOnly
                            type="text" 
                            className={`w-full ${dir === 'rtl' ? 'ps-4 pe-12' : 'pe-4 ps-12'} py-3 bg-zinc-100 border border-zinc-200 cursor-not-allowed rounded-2xl font-bold text-zinc-500 text-sm outline-none font-mono`}
                            value={editingReceipt ? voucherData.internal_reference : (internalRef || voucherData.internal_reference)}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">مرجع يدوي / آخر</label>
                        <div className="relative group">
                          <FileText className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                          <input 
                            type="text" 
                            placeholder="ادخل رقم المرجع اليدوي..."
                            className={`w-full ${dir === 'rtl' ? 'ps-4 pe-12' : 'pe-4 ps-12'} py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-zinc-800 text-sm`}
                            value={voucherData.manual_reference}
                            onChange={(e) => setVoucherData({...voucherData, manual_reference: e.target.value})}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">تاريخ السند</label>
                        <div className="relative">
                          <Calendar className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                          <input 
                            required
                            type="date"
                            className={`w-full ${dir === 'rtl' ? 'ps-4 pe-12' : 'pe-4 ps-12'} py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-zinc-800 text-sm`}
                            value={voucherData.date}
                            onChange={(e) => setVoucherData({...voucherData, date: e.target.value})}
                          />
                        </div>
                      </div>

                      {editingReceipt?.entry_number && (
                        <div>
                          <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">{language === 'ar' ? 'رقم القيد المرتبط' : 'Linked Journal Entry'}</label>
                          <div className="relative">
                            <Layers className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-emerald-500 pointer-events-none`} />
                            <input 
                              readOnly
                              type="text"
                              className={`w-full ${dir === 'rtl' ? 'ps-4 pe-12' : 'pe-4 ps-12'} py-3 bg-emerald-50 border border-emerald-200 rounded-2xl outline-none transition-all font-bold text-emerald-800 text-sm`}
                              value={editingReceipt.entry_number}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">طريقة القبض (إلى خزينة/بنك)</label>
                      <div className="relative group">
                        <CreditCard className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                        <select 
                          required
                          className={`w-full ${dir === 'rtl' ? 'ps-10 pe-12' : 'pe-10 ps-12'} py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-zinc-800 appearance-none text-sm cursor-pointer`}
                          value={voucherData.payment_method_id}
                          onChange={(e) => {
                            if (e.target.value === 'new_payment_method') {
                              setIsPaymentMethodModalOpen(true);
                            } else {
                              setVoucherData({...voucherData, payment_method_id: e.target.value});
                            }
                          }}
                        >
                          <option value="">اختر طريقة القبض...</option>
                          {paymentMethods.map(pm => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
                          <option value="new_payment_method" className="font-bold text-emerald-600">+ إضافة طريقة دفع جديدة...</option>
                        </select>
                        <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                      </div>
                    </div>
                  </section>

                  {/* Card 2: Receipt Items */}
                  <section className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm space-y-6 relative pt-12">
                    <div className="absolute top-4 right-4 flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                      <Layers className="w-4 h-4" />
                      <span className="text-xs font-bold">بنود القبض</span>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                        <h4 className="font-bold text-zinc-900 italic tracking-tight uppercase text-sm">تفاصيل البنود</h4>
                        <button 
                          type="button"
                          onClick={() => setVoucherData({
                            ...voucherData,
                            items: [...voucherData.items, { type: 'customer', entity_id: '', amount: 0, description: '' }]
                          })}
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-black border border-emerald-100 hover:bg-emerald-100 transition-all shadow-sm"
                        >
                          <Plus size={16} />
                          <span>إضافة بند قبض جديد</span>
                        </button>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className={`text-zinc-500 text-[10px] uppercase font-black tracking-widest ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                              <th className="px-2 py-3 w-32 tracking-tighter">النوع</th>
                              <th className="px-2 py-3 tracking-tighter">المقبوض منه / الحساب</th>
                              <th className="px-2 py-3 w-32 tracking-tighter uppercase tracking-widest">المبلغ</th>
                              <th className="px-2 py-3 tracking-tighter uppercase tracking-widest">الوصف</th>
                              <th className="px-2 py-3 w-10"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-50">
                            {voucherData.items.map((item, idx) => (
                              <React.Fragment key={idx}>
                                <tr className="group hover:bg-zinc-50 transition-colors">
                                  <td className="px-1 py-1 relative">
                                    <select 
                                      className="w-full px-2 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-[11px] font-bold outline-none appearance-none"
                                      value={item.type}
                                      onChange={(e) => {
                                        const newItems = [...voucherData.items];
                                        newItems[idx].type = e.target.value;
                                        newItems[idx].entity_id = '';
                                        newItems[idx].settlements = [];
                                        newItems[idx].amount = 0;
                                        setVoucherData({...voucherData, items: newItems});
                                      }}
                                    >
                                      <option value="customer">عميل</option>
                                      <option value="supplier">مورد</option>
                                      <option value="expense">مصروف</option>
                                      <option value="account">حساب عام</option>
                                    </select>
                                    <ChevronDown size={12} className="absolute right-3 top-4 text-zinc-400 pointer-events-none" />
                                  </td>
                                  <td className="px-1 py-1 relative">
                                    <select 
                                      className="w-full px-2 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-[11px] font-black outline-none appearance-none"
                                      value={item.entity_id}
                                      onChange={(e) => {
                                        const newItems = [...voucherData.items];
                                        newItems[idx].entity_id = e.target.value;
                                        newItems[idx].sub_account_id = '';
                                        newItems[idx].settlements = [];
                                        newItems[idx].amount = 0;
                                        setVoucherData({...voucherData, items: newItems});
                                      }}
                                    >
                                      <option value="">اختر...</option>
                                      {item.type === 'customer' && customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                      {item.type === 'supplier' && suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                                      {item.type === 'expense' && categories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                                      {item.type === 'account' && accounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                                    </select>
                                    <ChevronDown size={12} className="absolute right-4 top-4 text-zinc-400 pointer-events-none" />
                                    {item.type === 'account' && accounts.find(a => a.id === item.entity_id)?.required_sub_account && (
                                      <select
                                        className="w-full px-2 py-2 mt-1 bg-emerald-50 border border-emerald-200 rounded-xl text-[10px] font-bold outline-none"
                                        value={item.sub_account_id || ''}
                                        onChange={(e) => {
                                          const newItems = [...voucherData.items];
                                          newItems[idx].sub_account_id = e.target.value;
                                          setVoucherData({...voucherData, items: newItems});
                                        }}
                                        required
                                      >
                                        <option value="">اختر الحساب الفرعي...</option>
                                        {subAccounts.map(sa => (
                                          <option key={sa.id} value={sa.id}>{sa.label}</option>
                                        ))}
                                      </select>
                                    )}
                                  </td>
                                  <td className="px-1 py-1">
                                    <input 
                                      type="number" 
                                      className="w-full px-2 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-black text-emerald-600 outline-none text-center"
                                      placeholder="0"
                                      value={item.amount || ''}
                                      onChange={(e) => {
                                        const newItems = [...voucherData.items];
                                        newItems[idx].amount = Number(e.target.value);
                                        setVoucherData({...voucherData, items: newItems});
                                      }}
                                    />
                                  </td>
                                  <td className="px-1 py-1">
                                    <input 
                                      type="text" 
                                      placeholder="بيان تفصيلي..."
                                      className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-[11px] font-bold outline-none"
                                      value={item.description}
                                      onChange={(e) => {
                                        const newItems = [...voucherData.items];
                                        newItems[idx].description = e.target.value;
                                        setVoucherData({...voucherData, items: newItems});
                                      }}
                                    />
                                  </td>
                                  <td className="px-1 py-1 text-center">
                                    <button 
                                      type="button"
                                      onClick={() => {
                                        const newItems = voucherData.items.filter((_, i) => i !== idx);
                                        setVoucherData({...voucherData, items: newItems});
                                      }}
                                      className="p-2 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-zinc-100 transition-colors"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </td>
                                </tr>

                                {/* Settlement Sub-row */}
                                {((item.type === 'customer' || item.type === 'supplier') && item.entity_id) && (() => {
                                  const entity = item.type === 'customer' 
                                    ? customers.find(c => c.id === item.entity_id)
                                    : suppliers.find(s => s.id === item.entity_id);
                                  if (!entity) return null;
                                  
                                  const openTransactions = calculateOpenAmounts(entity, item.type);
                                  
                                  return (
                                    <tr className="bg-zinc-50/30">
                                      <td colSpan={5} className="px-4 py-3 border-t border-b border-zinc-200/50">
                                        <div className="bg-white p-4 rounded-2xl border border-zinc-150 shadow-sm space-y-4">
                                          {/* Header info */}
                                          <div className="flex flex-wrap items-center gap-6 text-xs border-b border-zinc-100 pb-3">
                                            <div className="flex items-center gap-2">
                                              <span className="font-bold text-zinc-400">رقم التسوية:</span>
                                              <span className="font-mono bg-zinc-100 px-2.5 py-1 rounded-lg text-zinc-600 font-bold border border-zinc-200">
                                                {item.settlement_number || '-'}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <span className="font-bold text-zinc-400">تاريخ التسوية:</span>
                                              <input
                                                type="date"
                                                className="px-2.5 py-1 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                                                value={item.settlement_date ? item.settlement_date.slice(0, 10) : voucherData.date.slice(0, 10)}
                                                onChange={(e) => {
                                                  const newItems = [...voucherData.items];
                                                  newItems[idx].settlement_date = e.target.value;
                                                  const serial = generateSettlementSerial(e.target.value, receipts, allPayments);
                                                  newItems[idx].settlement_number = serial;
                                                  setVoucherData({ ...voucherData, items: newItems });
                                                }}
                                              />
                                            </div>
                                            {(() => {
                                              const totalSettled = (item.settlements || []).reduce((sum: number, s: any) => sum + Number(s.settled_amount), 0);
                                              const difference = (item.amount || 0) - totalSettled;
                                              return (
                                                <div className="flex flex-wrap items-center gap-4 text-xs font-bold">
                                                  <div className="flex items-center gap-1.5">
                                                    <span className="text-zinc-400">إجمالي المسوى:</span>
                                                    <span className="text-emerald-600 font-mono font-black bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">{formatNumber(totalSettled)} ج.م</span>
                                                  </div>
                                                  <div className="flex items-center gap-1.5">
                                                    <span className="text-zinc-400">الفرق:</span>
                                                    <span className={`font-mono font-black px-2.5 py-1 rounded-lg border ${difference === 0 ? 'text-zinc-600 bg-zinc-50 border-zinc-200' : difference > 0 ? 'text-blue-600 bg-blue-50 border-blue-100' : 'text-red-600 bg-red-50 border-red-100'}`}>
                                                      {formatNumber(difference)} ج.م
                                                    </span>
                                                  </div>
                                                </div>
                                              );
                                            })()}
                                          </div>

                                          {/* Transactions Table */}
                                          {openTransactions.length === 0 ? (
                                            <div className="text-center py-4 text-xs font-bold text-zinc-400">
                                              لا توجد حركات غير مسواة لهذا {item.type === 'customer' ? 'العميل' : 'المورد'}
                                            </div>
                                          ) : (
                                            <div className="overflow-x-auto">
                                              <table className="w-full text-right text-xs">
                                                <thead>
                                                  <tr className="text-zinc-400 font-bold border-b border-zinc-100 pb-2">
                                                    <th className="pb-2 text-right">رقم القيد</th>
                                                    <th className="pb-2 text-right">نوع الحركة</th>
                                                    <th className="pb-2 text-right">رقم الحركة</th>
                                                    <th className="pb-2 text-right">التاريخ</th>
                                                    <th className="pb-2 text-right">المبلغ الأصلي</th>
                                                    <th className="pb-2 text-right">المبلغ المفتوح</th>
                                                    <th className="pb-2 text-center w-24">تسوية كاملة</th>
                                                    <th className="pb-2 text-center w-32">تسوية بمبلغ الدفعة</th>
                                                    <th className="pb-2 text-center w-32">تسوية جزئية</th>
                                                  </tr>
                                                </thead>
                                                <tbody className="divide-y divide-zinc-50 text-zinc-700 font-bold">
                                                  {openTransactions.map((t) => {
                                                    const settlement = (item.settlements || []).find((s: any) => s.target_id === t.id);
                                                    const settledAmount = settlement ? Number(settlement.settled_amount) : 0;
                                                    const isFullySettled = Math.abs(settledAmount - t.open_amount) < 0.01;

                                                    return (
                                                      <tr key={t.id} className="hover:bg-zinc-50/50 transition-colors">
                                                        <td className="py-2.5">
                                                          {t.entry_number && t.entry_number !== '-' ? (
                                                            <button
                                                              type="button"
                                                              onClick={() => {
                                                                setPendingViewDoc({ type: 'journal', idOrNumber: t.entry_number });
                                                                setCurrentPage('journal_entries');
                                                              }}
                                                              className="text-emerald-600 hover:text-emerald-700 hover:underline font-mono font-black"
                                                            >
                                                              {t.entry_number}
                                                            </button>
                                                          ) : (
                                                            <span className="text-zinc-400 font-mono font-normal">-</span>
                                                          )}
                                                        </td>
                                                        <td className="py-2.5 text-zinc-500 font-semibold">{t.type_label}</td>
                                                        <td className="py-2.5">
                                                          {t.reference_number && t.reference_number !== '-' ? (
                                                            <button
                                                              type="button"
                                                              onClick={() => {
                                                                if (t.type === 'invoice') {
                                                                  setPendingViewDoc({ type: 'invoice', idOrNumber: t.reference_number });
                                                                  setCurrentPage('invoices');
                                                                } else if (t.type === 'purchase_invoice') {
                                                                  setPendingViewDoc({ type: 'purchase_invoice', idOrNumber: t.reference_number });
                                                                  setCurrentPage('purchase_invoices');
                                                                } else {
                                                                  setPendingViewDoc({ type: 'journal', idOrNumber: t.reference_number });
                                                                  setCurrentPage('journal_entries');
                                                                }
                                                              }}
                                                              className="text-emerald-600 hover:text-emerald-700 hover:underline font-mono font-black"
                                                            >
                                                              {t.reference_number}
                                                            </button>
                                                          ) : (
                                                            <span className="text-zinc-400 font-mono font-normal">-</span>
                                                          )}
                                                        </td>
                                                        <td className="py-2.5 text-zinc-400 font-normal font-mono">{t.date}</td>
                                                        <td className="py-2.5 text-zinc-500 font-semibold">{formatNumber(t.original_amount)}</td>
                                                        <td className="py-2.5 text-zinc-900 font-black">{formatNumber(t.open_amount)}</td>
                                                        <td className="py-2.5 text-center">
                                                          <input
                                                            type="checkbox"
                                                            className="w-4 h-4 rounded border-zinc-350 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                            checked={isFullySettled}
                                                            onChange={(e) => {
                                                              const checked = e.target.checked;
                                                              handleSettlementChange(idx, t, checked ? t.open_amount : 0);
                                                            }}
                                                          />
                                                        </td>
                                                        <td className="py-2.5 text-center">
                                                          {(() => {
                                                            const otherSettledSum = (item.settlements || []).filter((s: any) => s.target_id !== t.id).reduce((sum: number, s: any) => sum + Number(s.settled_amount), 0);
                                                            const remainingVoucherAmount = Math.max(0, (item.amount || 0) - otherSettledSum);
                                                            const maxAllocation = Math.min(remainingVoucherAmount, t.open_amount);
                                                            const isVoucherAmountSettled = settledAmount > 0 && Math.abs(settledAmount - maxAllocation) < 0.01;
                                                            return (
                                                              <input
                                                                type="checkbox"
                                                                className="w-4 h-4 rounded border-zinc-350 text-blue-650 focus:ring-blue-500 cursor-pointer"
                                                                disabled={maxAllocation <= 0 && settledAmount === 0}
                                                                checked={isVoucherAmountSettled}
                                                                onChange={(e) => {
                                                                  const checked = e.target.checked;
                                                                  handleSettlementChange(idx, t, checked ? maxAllocation : 0);
                                                                }}
                                                              />
                                                            );
                                                          })()}
                                                        </td>
                                                        <td className="py-2.5 text-center">
                                                          <input
                                                            type="number"
                                                            step="any"
                                                            className="w-full px-2 py-1 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-black text-center text-emerald-600 outline-none focus:ring-2 focus:ring-emerald-500"
                                                            placeholder="0"
                                                            value={settledAmount || ''}
                                                            max={t.open_amount}
                                                            onChange={(e) => {
                                                              const val = Number(e.target.value);
                                                              const cappedVal = Math.min(Math.max(0, val), t.open_amount);
                                                              handleSettlementChange(idx, t, cappedVal);
                                                            }}
                                                          />
                                                        </td>
                                                      </tr>
                                                    );
                                                  })}
                                                </tbody>
                                              </table>
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })()}
                              </React.Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex justify-between items-center bg-zinc-50 p-4 rounded-2xl border border-zinc-100 mt-4">
                        <span className="font-bold text-zinc-700 text-sm">إجمالي المبلغ المستلم:</span>
                        <span className="font-black text-2xl text-emerald-600 tracking-tighter">
                          {formatNumber(voucherData.items.reduce((sum, item) => sum + item.amount, 0))} ج.م
                        </span>
                      </div>
                    </div>
                  </section>

                  {/* Notes Card */}
                  <section className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm space-y-4">
                    <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">البيان العام / ملاحظات إضافية</label>
                    <textarea 
                      rows={3}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none text-sm font-bold text-zinc-800"
                      placeholder="اكتب ملاحظات السند هنا..."
                      value={voucherData.notes}
                      onChange={(e) => setVoucherData({...voucherData, notes: e.target.value})}
                    />
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
                  disabled={voucherData.items.reduce((sum, item) => sum + item.amount, 0) <= 0 || !voucherData.payment_method_id}
                  className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-3"
                >
                  <Save className="w-6 h-6" />
                  {editingReceipt ? 'حفظ التعديلات' : 'حفظ السند'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                  <FileText size={24} />
                </div>
                <h3 className="text-xl font-bold text-zinc-900">سند قبض رقم {viewReceipt.id}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    setActivityLogDocumentId(viewReceipt.id);
                    setIsActivityLogOpen(true);
                  }}
                  className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all"
                  title="سجل النشاط"
                >
                  <History size={20} />
                </button>
                <button 
                  onClick={() => exportToPDF(viewReceipt)}
                  className="p-2 text-zinc-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                  title="تصدير PDF"
                >
                  <Download size={20} />
                </button>
                <button 
                  onClick={() => setViewReceipt(null)}
                  className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-xl transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row h-full">
              {/* Side Panel for Activity Log and Journal Entry */}
              <TransactionSidePanel 
                documentId={viewReceipt.id} 
                category="receipts" 
              />

              <div className="flex-1 overflow-y-auto p-8" ref={receiptRef} id="receipt-capture-area">
                <CompanyInvoiceHeader 
                  company={companyData} 
                  documentNumber={viewReceipt.voucher_number || viewReceipt.id}
                  documentDate={formatDate(viewReceipt.date)}
                  title="سند قبض"
                />
                
                <div className="space-y-8">
                  {viewReceipt.items && viewReceipt.items.length > 0 ? (
                    <div className="space-y-6">
                      <div className="overflow-x-auto border border-zinc-100 rounded-2xl">
                        <table className="w-full text-xs md:text-sm">
                          <thead className="bg-zinc-50 border-b border-zinc-100 text-zinc-500 font-bold">
                            <tr>
                              <th className="px-4 py-3 text-right">النوع</th>
                              <th className="px-4 py-3 text-right">المقبوض منه / الحساب</th>
                              <th className="px-4 py-3 text-left">المبلغ</th>
                              <th className="px-4 py-3 text-right">البيان التفصيلي</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-50 text-zinc-700 font-bold">
                            {viewReceipt.items.map((item, idx) => (
                              <React.Fragment key={idx}>
                                <tr>
                                  <td className="px-4 py-3 font-normal text-zinc-500">
                                    {item.type === 'customer' ? 'عميل' :
                                     item.type === 'supplier' ? 'مورد' :
                                     item.type === 'expense' ? 'مصروف' : 'حساب عام'}
                                  </td>
                                  <td className="px-4 py-3">
                                    {item.entity_name || item.entity_id || '---'}
                                    {item.sub_account_id && ` (فرعي: ${item.sub_account_id})`}
                                  </td>
                                  <td className="px-4 py-3 text-left text-emerald-600 font-black">
                                    {formatNumber(item.amount)} ج.م
                                  </td>
                                  <td className="px-4 py-3 text-zinc-500 font-normal">
                                    {item.description || '---'}
                                  </td>
                                </tr>
                                {item.settlements && item.settlements.length > 0 && (
                                  <tr className="bg-zinc-50/50">
                                    <td colSpan={4} className="px-4 py-3 border-t border-b border-zinc-100">
                                      <div className="bg-white p-3 rounded-xl border border-zinc-100 shadow-sm space-y-2 text-xs">
                                        <div className="flex justify-between items-center border-b border-zinc-100 pb-2 mb-2 font-bold text-zinc-500">
                                          <span>تسويات البند (رقم التسوية: {item.settlement_number || '-'} - تاريخ التسوية: {item.settlement_date ? formatDate(item.settlement_date) : ''})</span>
                                        </div>
                                        <table className="w-full text-right text-[11px]">
                                          <thead>
                                            <tr className="text-zinc-400 font-bold border-b border-zinc-50">
                                              <th className="pb-1 text-right">رقم القيد</th>
                                              <th className="pb-1 text-right">نوع الحركة</th>
                                              <th className="pb-1 text-right">رقم الحركة</th>
                                              <th className="pb-1 text-right">التاريخ</th>
                                              <th className="pb-1 text-right">المبلغ الأصلي</th>
                                              <th className="pb-1 text-left">المبلغ المسوى</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-zinc-50 text-zinc-600">
                                            {item.settlements.map((s: any, sIdx: number) => (
                                              <tr key={sIdx}>
                                                <td className="py-1">
                                                  {s.entry_number && s.entry_number !== '-' ? (
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setViewReceipt(null);
                                                        setPendingViewDoc({ type: 'journal', idOrNumber: s.entry_number });
                                                        setCurrentPage('journal_entries');
                                                      }}
                                                      className="text-emerald-600 hover:underline font-mono"
                                                    >
                                                      {s.entry_number}
                                                    </button>
                                                  ) : (
                                                    <span className="text-zinc-400 font-mono">-</span>
                                                  )}
                                                </td>
                                                <td className="py-1">{s.type_label}</td>
                                                <td className="py-1">
                                                  {s.reference_number && s.reference_number !== '-' ? (
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setViewReceipt(null);
                                                        if (s.type === 'invoice') {
                                                          setPendingViewDoc({ type: 'invoice', idOrNumber: s.reference_number });
                                                          setCurrentPage('invoices');
                                                        } else if (s.type === 'purchase_invoice') {
                                                          setPendingViewDoc({ type: 'purchase_invoice', idOrNumber: s.reference_number });
                                                          setCurrentPage('purchase_invoices');
                                                        } else {
                                                          setPendingViewDoc({ type: 'journal', idOrNumber: s.reference_number });
                                                          setCurrentPage('journal_entries');
                                                        }
                                                      }}
                                                      className="text-emerald-600 hover:underline font-mono"
                                                    >
                                                      {s.reference_number}
                                                    </button>
                                                  ) : (
                                                    <span className="text-zinc-400 font-mono">-</span>
                                                  )}
                                                </td>
                                                <td className="py-1 font-mono">{s.date ? formatDate(s.date) : ''}</td>
                                                <td className="py-1">{formatNumber(s.original_amount)}</td>
                                                <td className="py-1 text-left text-emerald-600 font-bold">{formatNumber(s.settled_amount)} ج.م</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex justify-between items-center bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                        <span className="font-bold text-zinc-700 text-sm">إجمالي المبلغ المستلم:</span>
                        <span className="font-black text-2xl text-emerald-600 tracking-tighter">
                          {formatNumber(viewReceipt.amount)} ج.م
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-8 p-6 bg-zinc-50 rounded-2xl border border-zinc-100">
                      <div>
                        <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">وصلنا من السيد / السادة</p>
                        <p className="text-lg font-bold text-zinc-900">{viewReceipt.customer_name}</p>
                      </div>
                      <div className="text-left">
                        <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">المبلغ</p>
                        <p className="text-2xl font-black text-emerald-600">{formatNumber(viewReceipt.amount)} ج.م</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    {(!viewReceipt.items || viewReceipt.items.length === 0) && (
                      <div className="flex justify-between py-3 border-b border-zinc-100">
                        <span className="text-zinc-500">وذلك عن:</span>
                        <span className="font-bold text-zinc-900">{viewReceipt.description || '---'}</span>
                      </div>
                    )}
                    {viewReceipt.items && viewReceipt.items.length > 0 && viewReceipt.description && (
                      <div className="flex justify-between py-3 border-b border-zinc-100">
                        <span className="text-zinc-500">البيان العام:</span>
                        <span className="font-bold text-zinc-900">{viewReceipt.description}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-3 border-b border-zinc-100">
                      <span className="text-zinc-500">طريقة السداد:</span>
                      <span className="font-bold text-zinc-900">{viewReceipt.payment_method_name || '---'}</span>
                    </div>
                    {viewReceipt.entry_number && (
                      <div className="flex justify-between py-3 border-b border-zinc-100">
                        <span className="text-zinc-500">{language === 'ar' ? 'رقم القيد:' : 'Journal Entry:'}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewReceipt(null);
                            setPendingViewDoc({ type: 'journal', idOrNumber: viewReceipt.entry_number! });
                            setCurrentPage('journal_entries');
                          }}
                          className="text-emerald-600 hover:text-emerald-700 hover:underline font-mono font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100/50"
                        >
                          {viewReceipt.entry_number}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="pt-12 flex justify-between items-end">
                    <div className="text-center">
                      <div className="w-32 border-b-2 border-zinc-200 mb-2"></div>
                      <p className="text-xs text-zinc-400">توقيع المستلم</p>
                    </div>
                    <div className="text-center">
                      <div className="w-32 border-b-2 border-zinc-200 mb-2"></div>
                      <p className="text-xs text-zinc-400">الختم</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-2xl md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
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
                        className="w-full px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
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
                      <p className="text-[10px] text-emerald-600 mt-1 font-medium">يستخدم هذا الحساب لإنشاء قيد رصيد أول المدة (مثلاً: رأس المال أو الأرباح المرحلة)</p>
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

      {/* Add Payment Method Modal */}
      {isPaymentMethodModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-3xl md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
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
            <p className="text-zinc-500 mb-6">هل أنت متأكد من رغبتك في حذف هذا السند؟ لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setReceiptToDelete(null);
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
        category="receipts" 
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
