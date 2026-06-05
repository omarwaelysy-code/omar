import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  Search, Plus, Trash2, X, Wallet, User, CreditCard, Calendar, 
  Hash, FileText, Save, Pencil, Eye, Download, History, Printer, 
  Phone, Mail, MapPin, Layers, LayoutGrid, List, Maximize2, Minimize2, ChevronRight, ChevronLeft, RotateCcw, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { exportToPDF as exportToPDFUtil } from '../utils/pdfUtils';
import { exportToExcel, formatDataForExcel } from '../utils/excelUtils';
import { dbService } from '../services/dbService';
import { PageActivityLog } from '../components/PageActivityLog';
import { InlineActivityLog } from '../components/InlineActivityLog';
import { JournalEntryPreview } from '../components/JournalEntryPreview';
import { SmartAIInput } from '../components/SmartAIInput';
import { TransactionSidePanel } from '../components/TransactionSidePanel';
import { ExportButtons } from '../components/ExportButtons';
import { TransactionManager } from '../services/TransactionManager';
import { VoucherSchema, JournalEntrySchema } from '../lib/schemas';
import { ActivityLog, Supplier, ExpenseCategory, PaymentMethod, JournalEntry, JournalEntryItem, Account, Company } from '../types';
import { formatNumber, formatDate, formatMoney } from '../utils/formatUtils';
import { PaginationControls } from '../components/PaginationControls';
import { useViewPreference } from '../hooks/useViewPreference';
import { CompanyInvoiceHeader } from '../components/CompanyInvoiceHeader';
import { useNavigation } from '../contexts/NavigationContext';

export const PaymentVouchers: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { showNotification } = useNotification();
  const { pendingViewDoc, setPendingViewDoc, setCurrentPage } = useNavigation();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<any | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [voucherToDelete, setVoucherToDelete] = useState<string | null>(null);
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
  const [viewVoucher, setViewVoucher] = useState<any | null>(null);

  const voucherRef = React.useRef<HTMLDivElement>(null);
  const tableRef = React.useRef<HTMLDivElement>(null);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [activityLogDocumentId, setActivityLogDocumentId] = useState<string | undefined>(undefined);
  const [previewJournalEntry, setPreviewJournalEntry] = useState<JournalEntry | null>(null);
  const [previewActivityLog, setPreviewActivityLog] = useState<Partial<ActivityLog> | null>(null);
  const [view, setView] = useViewPreference('payment_vouchers', 'table');
  const [companyData, setCompanyData] = useState<Company | null>(null);
  const [allInvoices, setAllInvoices] = useState<any[]>([]);
  const [allPurchaseInvoices, setAllPurchaseInvoices] = useState<any[]>([]);
  const [allReceipts, setAllReceipts] = useState<any[]>([]);
  const [allPayments, setAllPayments] = useState<any[]>([]);
  const [allJournalEntries, setAllJournalEntries] = useState<any[]>([]);
  const [allReturns, setAllReturns] = useState<any[]>([]);
  const [allPurchaseReturns, setAllPurchaseReturns] = useState<any[]>([]);
  const [rowSettlementDates, setRowSettlementDates] = useState<Record<string, string>>({});

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

  const [categoryFormData, setCategoryFormData] = useState({
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
  
  // Voucher State
  const [voucherData, setVoucherData] = useState({
    internal_reference: '',
    manual_reference: '',
    items: [] as any[],
    type: 'multi' as 'supplier' | 'expense' | 'multi',
    supplier_id: '',
    expense_category_id: '',
    customer_id: '',
    amount: 0,
    payment_method_id: '',
    date: new Date().toISOString().slice(0, 10),
    notes: ''
  });

  const generateInternalRef = async (selectedDate: string) => {
    return await dbService.getNextSequence('payment_vouchers', selectedDate);
  };

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

    const checkInvoices = (invoicesList: any[]) => {
      invoicesList.forEach(inv => {
        if (inv.settlements && Array.isArray(inv.settlements)) {
          inv.settlements.forEach((s: any) => {
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
    };

    checkVoucherItems(allReceiptsList);
    checkVoucherItems(allPaymentsList);
    checkInvoices(allInvoices);
    checkInvoices(allPurchaseInvoices);

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
          if (editingVoucher && v.id === editingVoucher.id) return;
          
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
      
      sumVoucherSettlements(allReceipts);
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
          if (editingVoucher && v.id === editingVoucher.id) return;
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
      sumVoucherSettlements(allReceipts);
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

  const handleRowDateChange = (
    itemIdx: number,
    targetTx: any,
    newDate: string
  ) => {
    const key = `${itemIdx}-${targetTx.id}`;
    const newDates = {
      ...rowSettlementDates,
      [key]: newDate
    };
    setRowSettlementDates(newDates);

    const newItems = [...voucherData.items];
    const item = newItems[itemIdx];
    const settlements = [...(item.settlements || [])];
    const existingIdx = settlements.findIndex(s => s.target_id === targetTx.id);

    if (existingIdx > -1) {
      const currentS = settlements[existingIdx];
      const serial = generateSettlementSerial(newDate, allReceipts, allPayments);
      settlements[existingIdx] = {
        ...currentS,
        settlement_date: newDate,
        settlement_number: serial
      };
      item.settlements = settlements;
      setVoucherData({
        ...voucherData,
        items: newItems
      });
    }
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
    const rowDate = rowSettlementDates[`${itemIdx}-${targetTx.id}`] || voucherData.date.slice(0, 10);
    
    if (amount <= 0) {
      if (existingIdx > -1) {
        settlements.splice(existingIdx, 1);
      }
    } else {
      let settlementNum = '';
      if (existingIdx > -1) {
        settlementNum = settlements[existingIdx].settlement_number || generateSettlementSerial(rowDate, allReceipts, allPayments);
      } else {
        settlementNum = generateSettlementSerial(rowDate, allReceipts, allPayments);
      }

      const settlementObj = {
        target_id: targetTx.id,
        settled_amount: amount,
        reference_number: targetTx.reference_number,
        entry_number: targetTx.entry_number,
        type: targetTx.type,
        type_label: targetTx.type_label,
        date: targetTx.date,
        original_amount: targetTx.original_amount,
        settlement_number: settlementNum,
        settlement_date: rowDate
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

  // Dynamic Sub-account Options
  const subAccounts = [
    ...customers.map(c => ({ id: c.id, name: c.name, type: 'customer' as const, label: `عميل: ${c.name}` })),
    ...suppliers.map(s => ({ id: s.id, name: s.name, type: 'supplier' as const, label: `مورد: ${s.name}` })),
    ...paymentMethods.map(p => ({ id: p.id, name: p.name, type: 'payment_method' as const, label: `خزينة/بنك: ${p.name}` }))
  ];

  useEffect(() => {
    if (!editingVoucher && !voucherData.internal_reference && !loading && isModalOpen) {
      const updateNum = async () => {
        const num = await generateInternalRef(voucherData.date);
        setInternalRef(num);
      };
      updateNum();
    }
  }, [vouchers, editingVoucher, loading, isModalOpen, voucherData.date]);

  // Removed item-level settlement date/serial auto-generation useEffect in favor of row-level tracking

  useEffect(() => {
    if (user) {
      const unsubItems = dbService.subscribePaginated('payment_vouchers', {
        company_id: user.company_id,
        _page: page,
        _limit: limit,
        _sortBy: sortBy,
        _sortOrder: sortOrder,
        _search: searchTerm
      }, (result: any) => {
        setVouchers(result.data);
        setTotalRecords(result.total);
        setServerSummary(result.summary);
      });
      const unsubSuppliers = dbService.subscribe<Supplier>('suppliers', user.company_id, setSuppliers);
      const unsubCategories = dbService.subscribe<ExpenseCategory>('expense_categories', user.company_id, setCategories);
      const unsubPM = dbService.subscribe<PaymentMethod>('payment_methods', user.company_id, setPaymentMethods);
      const unsubAccounts = dbService.subscribe<any>('accounts', user.company_id, setAccounts);
      const unsubCustomers = dbService.subscribe<any>('customers', user.company_id, setCustomers);
      const unsubInvoices = dbService.subscribe<any>('invoices', user.company_id, setAllInvoices);
      const unsubPurchaseInvoices = dbService.subscribe<any>('purchase_invoices', user.company_id, setAllPurchaseInvoices);
      const unsubReceipts = dbService.subscribe<any>('receipt_vouchers', user.company_id, setAllReceipts);
      const unsubPayments = dbService.subscribe<any>('payment_vouchers', user.company_id, setAllPayments);
      const unsubJournalEntries = dbService.subscribe<any>('journal_entries', user.company_id, setAllJournalEntries);
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
        unsubSuppliers();
        unsubCategories();
        unsubPM();
        unsubAccounts();
        unsubCustomers();
        unsubInvoices();
        unsubPurchaseInvoices();
        unsubReceipts();
        unsubPayments();
        unsubJournalEntries();
        unsubReturns();
        unsubPR();
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

    const generatePreview = () => {
      if (voucherData.amount <= 0) {
        setPreviewJournalEntry(null);
        setPreviewActivityLog(null);
        return;
      }

      const supplier = suppliers.find(s => s.id === voucherData.supplier_id);
      const category = categories.find(c => c.id === voucherData.expense_category_id);
      const paymentMethod = paymentMethods.find(pm => pm.id === voucherData.payment_method_id);
      const voucher_number = 'PAY-PREVIEW';

      // Preview Activity Log
      setPreviewActivityLog({
        action: 'إضافة سند صرف',
        details: `إضافة سند صرف جديد ${voucherData.type === 'supplier' ? `للمورد ${supplier?.name || '...'}` : `لمصروف ${category?.name || '...'}`} بمبلغ ${formatNumber(voucherData.amount)}`,
        created_at: new Date().toISOString()
      });

      // Preview Journal Entry
      const journalItems: JournalEntryItem[] = [];

      if (voucherData.type === 'multi') {
        voucherData.items.forEach(item => {
          let debitAccountId = '';
          let debitAccountName = '';
          let subAccountId = undefined;
          let subAccountType = undefined;

          if (item.type === 'supplier') {
            const supplier = suppliers.find(s => s.id === item.entity_id);
            debitAccountId = supplier?.account_id || '';
            debitAccountName = supplier?.account_name || '';
            subAccountId = supplier?.id;
            subAccountType = 'supplier';
          } else if (item.type === 'customer') {
            const customer = customers.find(c => c.id === item.entity_id);
            debitAccountId = customer?.account_id || '';
            debitAccountName = customer?.account_name || '';
            subAccountId = customer?.id;
            subAccountType = 'customer';
          } else if (item.type === 'expense') {
            const category = categories.find(c => c.id === item.entity_id);
            debitAccountId = category?.account_id || '';
            debitAccountName = category?.name || '';
            subAccountId = category?.id;
            subAccountType = 'expense';
          } else {
            const account = accounts.find(a => a.id === item.entity_id);
            debitAccountId = account?.id || '';
            debitAccountName = account?.name || '';
          }

          if (item.amount > 0) {
            journalItems.push({
              account_id: debitAccountId || 'debit_account_missing',
              account_name: debitAccountName || 'حساب مدين مفقود',
              debit: item.amount,
              credit: 0,
              description: item.description || `سند صرف رقم ${voucher_number} - ${voucherData.notes}`,
              sub_account_id: subAccountId,
              sub_account_type: subAccountType as 'supplier' | 'customer' | undefined,
              customer_id: item.type === 'customer' ? item.entity_id : undefined,
              supplier_id: item.type === 'supplier' ? item.entity_id : undefined,
            });
          }
        });
      } else {
        // Debit: Supplier or Expense Account
        let debitAccountId = '';
        let debitAccountName = '';

        if (voucherData.type === 'supplier') {
          debitAccountId = supplier?.account_id || '';
          debitAccountName = supplier?.account_name || '';
          if (!debitAccountId) {
            const fallbackAccount = accounts.find(a => a.name.includes('موردين'));
            debitAccountId = fallbackAccount?.id || 'suppliers_account_default';
            debitAccountName = fallbackAccount?.name || 'حساب الموردين (افتراضي)';
          }
        } else {
          debitAccountId = category?.account_id || '';
          debitAccountName = category?.name || '';
          if (!debitAccountId) {
            const fallbackAccount = accounts.find(a => a.name.includes('مصروف'));
            debitAccountId = fallbackAccount?.id || 'expenses_account_default';
            debitAccountName = fallbackAccount?.name || 'حساب المصروفات (افتراضي)';
          }
        }

        journalItems.push({
          account_id: debitAccountId,
          account_name: debitAccountName,
          debit: voucherData.amount,
          credit: 0,
          description: `سند صرف رقم ${voucher_number} - ${voucherData.type === 'supplier' ? (supplier?.name || '...') : (category?.name || '...')}`,
          sub_account_id: voucherData.type === 'supplier' ? supplier?.id : (voucherData.type === 'expense' ? category?.id : undefined),
          sub_account_type: voucherData.type === 'supplier' ? 'supplier' : (voucherData.type === 'expense' ? 'expense' : undefined)
        });
      }

      const totalPreviewAmount = voucherData.type === 'multi' 
        ? voucherData.items.reduce((sum, item) => sum + item.amount, 0)
        : voucherData.amount;

      // Credit: Payment Method (Cash/Bank)
      let creditAccountId = paymentMethod?.account_id || '';
      let creditAccountName = paymentMethod?.name || '';
      
      if (!creditAccountId) {
        const fallbackAccount = accounts.find(a => 
          a.name.includes('صندوق') || a.name.includes('بنك') || a.name.includes('خزينة')
        );
        creditAccountId = fallbackAccount?.id || 'cash_account_default';
        creditAccountName = fallbackAccount?.name || 'حساب الصندوق (افتراضي)';
      }

      journalItems.push({
        account_id: creditAccountId,
        account_name: creditAccountName,
        debit: 0,
        credit: totalPreviewAmount,
        description: `سند صرف رقم ${voucher_number} - ${totalPreviewAmount}`,
        sub_account_id: paymentMethod?.id,
        sub_account_type: 'payment_method'
      });

      setPreviewJournalEntry({
        id: 'preview',
        date: voucherData.date,
        reference_number: voucher_number,
        reference_id: 'preview',
        reference_type: 'payment',
        description: `قيد سند صرف رقم ${voucher_number}`,
        items: journalItems,
        total_debit: totalPreviewAmount,
        total_credit: totalPreviewAmount,
        company_id: user.company_id,
        created_at: new Date().toISOString(),
        created_by: user.id
      });
    };

    generatePreview();
  }, [isModalOpen, voucherData, user, suppliers, categories, paymentMethods, accounts]);

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

      await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة مورد', `إضافة مورد جديد من سند الصرف: ${supplierFormData.name}`, ['suppliers', 'payment_vouchers']);
      
      setVoucherData({ ...voucherData, supplier_id: supplierId });
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

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const code = `EXP-${Date.now().toString().slice(-6)}`;
      const newCategory = {
        ...categoryFormData,
        code,
        company_id: user.company_id
      };
      const categoryId = await dbService.add('expense_categories', newCategory);
      await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة بند مصروف', `إضافة بند مصروف جديد من سند الصرف: ${categoryFormData.name}`, ['expense_categories', 'payment_vouchers']);
      
      setVoucherData({ ...voucherData, expense_category_id: categoryId });
      setIsCategoryModalOpen(false);
      setCategoryFormData({
        name: '',
        description: ''
      });
      showNotification('تم إضافة بند المصروف بنجاح');
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء إضافة بند المصروف', 'error');
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
      await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة طريقة دفع', `إضافة طريقة دفع جديدة من سند الصرف: ${paymentMethodFormData.name}`, ['payment_methods', 'payment_vouchers'], pmId);
      
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

    const finalAmount = voucherData.type === 'multi' 
      ? voucherData.items.reduce((sum, item) => sum + item.amount, 0)
      : voucherData.amount;

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
      
      const voucher_number = editingVoucher 
        ? (editingVoucher.voucher_number || editingVoucher.number) 
        : (internalRef || `PAY-${Date.now().toString().slice(-6)}`);

      const data: any = {
        voucher_number,
        internal_reference: voucherData.internal_reference,
        manual_reference: voucherData.manual_reference,
        date: voucherData.date,
        amount: finalAmount,
        description: voucherData.notes,
        payment_method_id: voucherData.payment_method_id,
        payment_method_name: paymentMethod?.name || '',
        account_id: paymentMethod?.account_id || null,
        type: 'payment' as const,
        company_id: user.company_id,
        created_at: editingVoucher?.created_at || new Date().toISOString(),
        created_by: editingVoucher?.created_by || user.id,
        voucher_type: voucherData.type // 'supplier', 'expense', 'multi'
      };

      const journalItems: any[] = [];
      
      if (voucherData.type === 'multi') {
        data.items = voucherData.items;
        voucherData.items.forEach(item => {
          let debitAccountId = '';
          let debitAccountName = '';
          let subAccountId = undefined;
          let subAccountType = undefined;

          if (item.type === 'supplier') {
            const supplier = suppliers.find(s => s.id === item.entity_id);
            debitAccountId = supplier?.account_id || '';
            debitAccountName = supplier?.account_name || '';
            subAccountId = supplier?.id;
            subAccountType = 'supplier';
          } else if (item.type === 'customer') {
            const customer = customers.find(c => c.id === item.entity_id);
            debitAccountId = customer?.account_id || '';
            debitAccountName = customer?.account_name || '';
            subAccountId = customer?.id;
            subAccountType = 'customer';
          } else if (item.type === 'expense') {
            const category = categories.find(c => c.id === item.entity_id);
            debitAccountId = category?.account_id || '';
            debitAccountName = category?.name || '';
            subAccountId = category?.id;
            subAccountType = 'expense';
          } else {
            const account = accounts.find(a => a.id === item.entity_id);
            debitAccountId = account?.id || '';
            debitAccountName = account?.name || '';
            
            if (account?.required_sub_account && item.sub_account_id) {
              const subAccount = subAccounts.find((sa: any) => sa.id === item.sub_account_id);
              subAccountId = item.sub_account_id;
              subAccountType = subAccount?.type;
            }
          }

          journalItems.push({
            account_id: debitAccountId,
            account_name: debitAccountName,
            debit: item.amount,
            credit: 0,
            description: (item.description || `سند صرف رقم ${voucher_number}`) + (voucherData.notes ? ` - ${voucherData.notes}` : ''),
            sub_account_id: subAccountId,
            sub_account_type: subAccountType,
            customer_id: item.type === 'customer' ? item.entity_id : undefined,
            supplier_id: item.type === 'supplier' ? item.entity_id : undefined,
          });
        });
      } else {
        const supplier = suppliers.find(s => s.id === voucherData.supplier_id);
        const category = categories.find(c => c.id === voucherData.expense_category_id);
        
        data.supplier_id = voucherData.supplier_id || null;
        data.expense_category_id = voucherData.expense_category_id || null;
        data.supplier_name = supplier?.name || '';
        data.category_name = category?.name || '';

        let debitAccountId = '';
        let debitAccountName = '';

        if (voucherData.type === 'supplier') {
          debitAccountId = supplier?.account_id || '';
          debitAccountName = supplier?.account_name || '';
        } else {
          debitAccountId = category?.account_id || '';
          debitAccountName = category?.account_name || '';
        }

        journalItems.push({
          account_id: debitAccountId,
          account_name: debitAccountName,
          debit: voucherData.amount,
          credit: 0,
          description: `سند صرف رقم ${voucher_number} - ${voucherData.type === 'supplier' ? (supplier?.name || '') : (category?.name || '')}` + (voucherData.notes ? ` - ${voucherData.notes}` : ''),
          sub_account_id: voucherData.type === 'supplier' ? voucherData.supplier_id : (voucherData.type === 'expense' ? voucherData.expense_category_id : undefined),
          sub_account_type: voucherData.type === 'supplier' ? 'supplier' : (voucherData.type === 'expense' ? 'expense' : undefined),
          supplier_id: voucherData.type === 'supplier' ? voucherData.supplier_id : undefined
        });
      }

      // Credit: Payment Method
      let creditAccountId = paymentMethod?.account_id || '';
      let creditAccountName = paymentMethod?.account_name || '';
      
      journalItems.push({
        account_id: creditAccountId,
        account_name: creditAccountName,
        debit: 0,
        credit: finalAmount,
        description: `سند صرف رقم ${voucher_number} من حساب: ${paymentMethod?.name}` + (voucherData.notes ? ` - ${voucherData.notes}` : ''),
        sub_account_id: paymentMethod?.id,
        sub_account_type: 'payment_method'
      });

      const journalEntryData = {
        date: voucherData.date,
        reference_number: voucher_number,
        reference_type: 'payment',
        description: `قيد سند صرف رقم ${voucher_number}`,
        items: journalItems,
        total_debit: finalAmount,
        total_credit: finalAmount,
        company_id: user.company_id,
        created_at: new Date().toISOString(),
        created_by: user.id
      };

      if (editingVoucher) {
        await dbService.deleteJournalEntryByReference(editingVoucher.id, user.company_id);
        await TransactionManager.updateWithAccounting(
          'payment_vouchers',
          editingVoucher.id,
          data,
          VoucherSchema,
          journalEntryData,
          JournalEntrySchema
        );
      } else {
        await TransactionManager.saveWithAccounting(
          'payment_vouchers',
          data,
          VoucherSchema,
          journalEntryData,
          JournalEntrySchema
        );
      }

      showNotification(editingVoucher ? 'تم تعديل سند الصرف بنجاح' : 'تم حفظ سند الصرف بنجاح', 'success');
      setVoucherData({
        internal_reference: '',
        manual_reference: '',
        items: [],
        type: 'multi',
        supplier_id: '',
        expense_category_id: '',
        customer_id: '',
        amount: 0,
        payment_method_id: '',
        date: new Date().toISOString().slice(0, 10),
        notes: ''
      });
      setIsModalOpen(false);
      setEditingVoucher(null);

      if (!editingVoucher) {
        dbService.logActivity(user.id, user.username, user.company_id, 'إضافة سند صرف', `إضافة سند صرف جديد رقم: ${voucher_number}`, 'payment_vouchers');
      }

    } catch (e: any) {
      console.error('Save failed:', e);
      showNotification(e.message || 'حدث خطأ أثناء حفظ السند', 'error');
    }
  };

  const handleExportExcel = () => {
    const formattedData = formatDataForExcel(filteredVouchers, {
      'voucher_number': t('payments.column_number'),
      'entity_name': t('payments.column_recipient'),
      'date': t('payments.column_date'),
      'amount': t('payments.column_amount'),
      'description': t('payments.column_description')
    });
    exportToExcel(formattedData, { filename: 'PaymentVouchers_Report', sheetName: t('payments.title') });
  };

  const handleExportPDF = async () => {
    if (tableRef.current) {
      await exportToPDFUtil(tableRef.current, { filename: 'PaymentVouchers_Report', orientation: 'landscape' });
    }
  };

  const handleDelete = async (id: string) => {
    setVoucherToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!voucherToDelete || !user) return;
    try {
      const voucher = vouchers.find(v => v.id === voucherToDelete);
      
      // Delete associated journal entry
      await dbService.deleteJournalEntryByReference(voucherToDelete, user.company_id);
      
      // Clean up invoice settlements referencing this payment voucher
      const invoicesToUpdate = allInvoices.filter(inv => 
        inv.settlements && Array.isArray(inv.settlements) && 
        inv.settlements.some((s: any) => {
          const parts = (s.target_id || '').split('-');
          const voucherOriginalId = parts.length > 1 ? parts.slice(0, -1).join('-') : s.target_id;
          return String(voucherOriginalId) === String(voucherToDelete);
        })
      );

      for (const inv of invoicesToUpdate) {
        const updatedSettlements = inv.settlements.filter((s: any) => {
          const parts = (s.target_id || '').split('-');
          const voucherOriginalId = parts.length > 1 ? parts.slice(0, -1).join('-') : s.target_id;
          return String(voucherOriginalId) !== String(voucherToDelete);
        });
        await dbService.update('invoices', inv.id, { settlements: updatedSettlements });
      }

      const purchaseInvoicesToUpdate = allPurchaseInvoices.filter(inv => 
        inv.settlements && Array.isArray(inv.settlements) && 
        inv.settlements.some((s: any) => {
          const parts = (s.target_id || '').split('-');
          const voucherOriginalId = parts.length > 1 ? parts.slice(0, -1).join('-') : s.target_id;
          return String(voucherOriginalId) === String(voucherToDelete);
        })
      );

      for (const inv of purchaseInvoicesToUpdate) {
        const updatedSettlements = inv.settlements.filter((s: any) => {
          const parts = (s.target_id || '').split('-');
          const voucherOriginalId = parts.length > 1 ? parts.slice(0, -1).join('-') : s.target_id;
          return String(voucherOriginalId) !== String(voucherToDelete);
        });
        await dbService.update('purchase_invoices', inv.id, { settlements: updatedSettlements });
      }

      await dbService.delete('payment_vouchers', voucherToDelete);
      await dbService.logActivity(user.id, user.username, user.company_id, 'حذف سند صرف', `حذف سند صرف رقم: ${voucher?.number}`, 'payment_vouchers');
      showNotification(t('common.delete_success'), 'success');
      setIsDeleteModalOpen(false);
      setVoucherToDelete(null);
    } catch (e: any) {
      console.error(e);
      showNotification(e.message || t('common.delete_error'), 'error');
    }
  };

  const exportToPDF = async (voucher: any) => {
    const element = document.getElementById('payment-voucher-capture-area');
    if (!element) return;
    try {
      await exportToPDFUtil(element, {
        filename: `${voucher.internal_reference || voucher.voucher_number}.pdf`,
        margin: 10,
        orientation: 'portrait',
        reportTitle: `سند صرف رقم: ${voucher.internal_reference || voucher.voucher_number}`
      });
    } catch (e) {
      console.error('PDF Export Error:', e);
      showNotification('حدث خطأ أثناء تصدير PDF', 'error');
    }
  };

  const handleViewVoucher = async (id: string) => {
    try {
      const data = await dbService.get<any>('payment_vouchers', id);
      if (data) setViewVoucher(data);
    } catch (e) {
      console.error(e);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingVoucher(null);
    setInternalRef('');
    setVoucherData({
      internal_reference: '',
      manual_reference: '',
      items: [],
      type: 'multi',
      supplier_id: '',
      expense_category_id: '',
      customer_id: '',
      amount: 0,
      payment_method_id: '',
      date: new Date().toISOString().slice(0, 10),
      notes: ''
    });
  };

  const handlePrevVoucher = () => {
    if (!editingVoucher) return;
    const currentIndex = vouchers.findIndex(v => v.id === editingVoucher.id);
    if (currentIndex > 0) {
      openEditModal(vouchers[currentIndex - 1]);
    }
  };

  const handleNextVoucher = () => {
    if (!editingVoucher) return;
    const currentIndex = vouchers.findIndex(v => v.id === editingVoucher.id);
    if (currentIndex < vouchers.length - 1) {
      openEditModal(vouchers[currentIndex + 1]);
    }
  };

  const openEditModal = async (voucher: any) => {
    console.log('[EDIT] Opening edit modal for payment voucher ID:', voucher.id);
    try {
      const fullData = await dbService.get<any>('payment_vouchers', voucher.id);
      console.log('[EDIT] Payment voucher details from API:', fullData);
      
      if (!fullData) throw new Error('Payment voucher not found');

      setEditingVoucher(fullData);
      setInternalRef(fullData.internal_reference || fullData.voucher_number || '');
      
      // Ensure we have a clean copy of items or create from old format
      let items = [];
      if (fullData.items && Array.isArray(fullData.items) && fullData.items.length > 0) {
        items = fullData.items.map((item: any) => {
          let type = item.type || item.line_type || 'account';
          let entity_id = item.entity_id || '';
          let sub_account_id = item.sub_account_id || '';

          if (!entity_id) {
             if (item.account_id) {
               if (item.supplier_id || type === 'supplier') { type = 'supplier'; entity_id = item.supplier_id || item.sub_account_id || item.beneficiary_id; }
               else if (item.customer_id || type === 'customer') { type = 'customer'; entity_id = item.customer_id || item.sub_account_id || item.beneficiary_id; }
               else if (item.expense_category_id || type === 'expense') { type = 'expense'; entity_id = item.expense_category_id; }
               else { type = 'account'; entity_id = item.account_id; sub_account_id = item.sub_account_id || item.beneficiary_id || ''; }
             }
          }

          return {
            type,
            entity_id: entity_id || item.account_id || '', // Fallback to account_id
            sub_account_id,
            amount: item.amount || 0,
            description: item.description || '',
            settlement_date: item.settlement_date,
            settlement_number: item.settlement_number,
            settlements: item.settlements
          };
        });
      } else {
        // Convert old single-type format to multi-item array
        // IMPORTANT: We prioritize supplier_id and expense_category_id as the "Benefit" side.
        if (fullData.supplier_id && fullData.supplier_id !== '') {
          items.push({ 
            type: 'supplier', 
            entity_id: fullData.supplier_id, 
            amount: fullData.amount || 0, 
            description: fullData.description || '' 
          });
        } else if (fullData.expense_category_id && fullData.expense_category_id !== '') {
          items.push({ 
            type: 'expense', 
            entity_id: fullData.expense_category_id, 
            amount: fullData.amount || 0, 
            description: fullData.description || '' 
          });
        } else if (fullData.customer_id && fullData.customer_id !== '') {
          items.push({ 
            type: 'customer', 
            entity_id: fullData.customer_id, 
            amount: fullData.amount || 0, 
            description: fullData.description || '' 
          });
        } else if (fullData.account_id && fullData.account_id !== '' && fullData.account_id !== fullData.payment_method_account_id) {
          // Careful: do not map the payment method's account as the beneficiary
          const isPaymentMethodAccount = paymentMethods.some(pm => pm.account_id === fullData.account_id);
          if (!isPaymentMethodAccount || (!fullData.supplier_id && !fullData.expense_category_id && !fullData.customer_id)) {
            items.push({ 
              type: 'account', 
              entity_id: fullData.account_id, 
              amount: fullData.amount || 0, 
              description: fullData.description || '' 
            });
          }
        }
      }

      setVoucherData({
        internal_reference: fullData.internal_reference || fullData.voucher_number || fullData.number || '',
        manual_reference: fullData.manual_reference || '',
        items: items,
        type: 'multi', // Force multi mode for everything going forward
        supplier_id: fullData.supplier_id?.toString() || '',
        expense_category_id: fullData.expense_category_id?.toString() || '',
        customer_id: fullData.customer_id?.toString() || '',
        amount: fullData.amount || 0,
        payment_method_id: fullData.payment_method_id?.toString() || '',
        date: fullData.date ? fullData.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
        notes: fullData.description || fullData.notes || ''
      });
      const datesDict: Record<string, string> = {};
      if (items && Array.isArray(items)) {
        items.forEach((item: any, itemIdx: number) => {
          if (item.settlements && Array.isArray(item.settlements)) {
            item.settlements.forEach((s: any) => {
              if (s.target_id) {
                datesDict[`${itemIdx}-${s.target_id}`] = s.settlement_date || s.date || (fullData.date ? fullData.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
              }
            });
          }
        });
      }
      setRowSettlementDates(datesDict);
      setIsModalOpen(true);
      console.log('[EDIT] Form updated with payment voucher:', fullData.id);
    } catch (error: any) {
      console.error('[EDIT] Error loading payment voucher:', error);
      showNotification('فشل تحميل بيانات السند', 'error');
    }
  };

  useEffect(() => {
    if (pendingViewDoc && pendingViewDoc.type === 'payment_voucher' && user) {
      const loadPendingDoc = async () => {
        try {
          const existing = vouchers.find(v => 
            v.voucher_number === pendingViewDoc.idOrNumber || 
            v.internal_reference === pendingViewDoc.idOrNumber || 
            v.id === pendingViewDoc.idOrNumber
          );
          if (existing) {
            openEditModal(existing);
            setPendingViewDoc(null);
            return;
          }
          const docs = await dbService.getDocsByFilter<any>('payment_vouchers', user.company_id, [
            { field: 'voucher_number', operator: '==', value: pendingViewDoc.idOrNumber }
          ]);
          if (docs && docs.length > 0) {
            openEditModal(docs[0]);
          } else {
            const docById = await dbService.get<any>('payment_vouchers', pendingViewDoc.idOrNumber);
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
  }, [pendingViewDoc, vouchers, user, setPendingViewDoc]);

  const sortedVouchers = [...vouchers].sort((a, b) => {
    const refA = a.internal_reference || a.voucher_number || '';
    const refB = b.internal_reference || b.voucher_number || '';
    return refB.localeCompare(refA);
  });

  const filteredVouchers = sortedVouchers.filter(v => {
    const searchLow = searchTerm.toLowerCase();
    return (
      (v.voucher_number || '').toLowerCase().includes(searchLow) ||
      (v.internal_reference || '').toLowerCase().includes(searchLow) ||
      (v.manual_reference || '').toLowerCase().includes(searchLow) ||
      (v.description || '').toLowerCase().includes(searchLow) ||
      (v.notes || '').toLowerCase().includes(searchLow) ||
      (v.supplier_name || '').toLowerCase().includes(searchLow) ||
      (v.category_name || '').toLowerCase().includes(searchLow)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir={dir}>
      {!isModalOpen ? (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">{t('payments.title')}</h2>
          <p className="text-zinc-500">{t('payments.subtitle')}</p>
          {serverSummary.total_amount !== undefined && (
            <div className="mt-2 flex items-center gap-4 text-sm">
               <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100 font-bold">
                 إجمالي المدفوعات: {formatMoney(serverSummary.total_amount)} ج.م
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
            {t('payments.add')}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden no-pdf">
        <div className="p-6 border-b border-zinc-50 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
            <input
              type="text"
              placeholder={language === 'ar' ? "البحث عن سندات..." : "Search vouchers..."}
              className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2 bg-zinc-50 border-none rounded-xl focus:ring-2 focus:ring-zinc-900 transition-all`}
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
          <div ref={tableRef} id="payment-vouchers-list-table" className="hidden md:block overflow-x-auto">
            <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
              <thead>
                <tr className="bg-zinc-50/50 text-zinc-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-bold cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('voucher_number')}>
                    <div className="flex items-center gap-1">
                      رقم السند / المرجع
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {sortBy === 'voucher_number' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className="px-6 py-4 font-bold cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('voucher_type')}>
                    <div className="flex items-center gap-1">
                      النوع
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {sortBy === 'voucher_type' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className="px-6 py-4 font-bold">المستفيد / الفئة</th>
                  <th className="px-6 py-4 font-bold cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('date')}>
                    <div className="flex items-center gap-1">
                      التاريخ
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {sortBy === 'date' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className="px-6 py-4 font-bold">الوصف</th>
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
                {filteredVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-zinc-400 italic">لا توجد سندات صرف حالياً</td>
                  </tr>
                ) : filteredVouchers.map((voucher) => (
                  <tr 
                    key={voucher.id} 
                    className="hover:bg-zinc-50/50 transition-colors group cursor-pointer"
                    onClick={() => openEditModal(voucher)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-[10px] bg-zinc-100 px-2 py-1 rounded text-zinc-700 font-bold w-fit">{voucher.internal_reference || voucher.voucher_number || voucher.number}</span>
                        {voucher.manual_reference && (
                          <span className="text-[10px] text-zinc-400 font-mono italic">M: {voucher.manual_reference}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                        voucher.voucher_type === 'multi' ? 'bg-emerald-50 text-emerald-700' :
                        voucher.type === 'supplier' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                      }`}>
                        {voucher.voucher_type === 'multi' ? 'متعدد' : voucher.type === 'supplier' ? 'مورد' : 'مصروف'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-zinc-900">
                      {voucher.items && voucher.items.length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          {voucher.items.slice(0, 2).map((item: any, i: number) => {
                            let name = '...';
                            if (item.type === 'supplier') name = suppliers.find(s => s.id === item.entity_id)?.name || 'مورد';
                            else if (item.type === 'customer') name = customers.find(c => c.id === item.entity_id)?.name || 'عميل';
                            else if (item.type === 'expense') name = categories.find(c => c.id === item.entity_id)?.name || 'مصروف';
                            else name = accounts.find(a => a.id === item.entity_id)?.name || 'حساب';
                            return <span key={i} className="text-xs">{name}</span>;
                          })}
                          {voucher.items.length > 2 && <span className="text-[10px] text-zinc-400">+{voucher.items.length - 2} آخرين</span>}
                        </div>
                      ) : (
                        voucher.type === 'supplier' ? voucher.supplier_name : voucher.category_name
                      )}
                    </td>
                    <td className="px-6 py-4 text-zinc-500">{formatDate(voucher.date)}</td>
                    <td className="px-6 py-4 text-zinc-600 max-w-xs">{voucher.description || '---'}</td>
                    <td className="px-6 py-4 font-bold text-zinc-900">{formatNumber(voucher.amount)} {t('common.currency')}</td>
                    <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                      {voucher.entry_number ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingViewDoc({ type: 'journal', idOrNumber: voucher.entry_number! });
                            setCurrentPage('journal_entries');
                          }}
                          className="text-emerald-600 hover:text-emerald-700 hover:underline font-mono text-xs font-bold bg-emerald-50 px-2 py-1 rounded border border-emerald-100/50 transition-all active:scale-95"
                        >
                          {voucher.entry_number}
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
                            setActivityLogDocumentId(voucher.id);
                            setIsActivityLogOpen(true);
                          }}
                          className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all"
                          title="سجل النشاط"
                        >
                          <History size={18} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewVoucher(voucher.id);
                          }}
                          className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"
                        >
                          <Eye size={18} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(voucher);
                          }}
                          className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                        >
                          <Pencil size={18} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(voucher.id);
                          }}
                          className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
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
            {filteredVouchers.map((voucher) => (
              <div 
                key={voucher.id} 
                onClick={() => openEditModal(voucher)}
                className="p-6 bg-zinc-50/50 rounded-3xl border border-zinc-100 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5 transition-all group relative overflow-hidden cursor-pointer"
              >
                <div className="absolute top-4 left-4 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewVoucher(voucher.id);
                    }}
                    className="p-2 bg-white text-emerald-500 rounded-xl border border-emerald-50 shadow-sm hover:bg-emerald-50 transition-all font-bold"
                  >
                    <Eye size={16} />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(voucher);
                    }}
                    className="p-2 bg-white text-blue-500 rounded-xl border border-blue-50 shadow-sm hover:bg-blue-50 transition-all font-bold"
                  >
                    <Pencil size={16} />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(voucher.id);
                    }}
                    className="p-2 bg-white text-red-500 rounded-xl border border-red-50 shadow-sm hover:bg-red-50 transition-all font-bold"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="flex justify-between items-start">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] bg-white px-2 py-1 rounded text-emerald-700 font-bold w-fit border border-emerald-100 italic">
                        {voucher.internal_reference || voucher.voucher_number || voucher.number}
                      </span>
                      {voucher.entry_number && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingViewDoc({ type: 'journal', idOrNumber: voucher.entry_number! });
                            setCurrentPage('journal_entries');
                          }}
                          className="font-mono text-[9px] bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded text-emerald-700 font-bold border border-emerald-100/50 transition-all active:scale-95 z-10"
                        >
                          {voucher.entry_number}
                        </button>
                      )}
                      {voucher.manual_reference && (
                        <span className="font-mono text-[9px] text-zinc-400">
                          {voucher.manual_reference}
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-zinc-900 group-hover:text-emerald-700 transition-colors text-xl mt-1 tracking-tight">
                      {voucher.items && voucher.items.length > 0 ? (
                        <div className="flex flex-col gap-1">
                           {voucher.items.slice(0, 1).map((item: any, i: number) => {
                            let name = '...';
                            if (item.type === 'supplier') name = suppliers.find(s => s.id === item.entity_id)?.name || 'مورد';
                            else if (item.type === 'customer') name = customers.find(c => c.id === item.entity_id)?.name || 'عميل';
                            else if (item.type === 'expense') name = categories.find(c => c.id === item.entity_id)?.name || 'مصروف';
                            else name = accounts.find(a => a.id === item.entity_id)?.name || 'حساب';
                            return <span key={i}>{name}</span>;
                          })}
                          {voucher.items.length > 1 && <span className="text-xs text-zinc-400">+{voucher.items.length - 1} آخرين</span>}
                        </div>
                      ) : (
                        voucher.type === 'supplier' ? voucher.supplier_name : voucher.category_name
                      )}
                    </h4>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold w-fit ${
                      voucher.voucher_type === 'multi' ? 'bg-emerald-100 text-emerald-700' :
                      voucher.type === 'supplier' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {voucher.voucher_type === 'multi' ? 'متعدد' : voucher.type === 'supplier' ? 'مورد' : 'مصروف'}
                    </span>
                    {voucher.description && (
                      <p className="text-[10px] text-zinc-500 mt-2 line-clamp-2">{voucher.description}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-200/50 mt-4">
                  <div className="space-y-1">
                    <p className="text-zinc-400 text-[10px] uppercase font-black tracking-widest">{t('common.date')}</p>
                    <p className="text-zinc-900 font-bold text-sm tracking-tight">{formatDate(voucher.date)}</p>
                  </div>
                  <div className="space-y-1 text-left">
                    <p className="text-zinc-400 text-[10px] uppercase font-black tracking-widest">المبلغ</p>
                    <p className="font-black text-2xl tracking-tighter text-emerald-600">
                      {formatNumber(voucher.amount)} <span className="text-sm font-bold">{t('common.currency')}</span>
                    </p>
                  </div>
                  <div className="col-span-2 space-y-1 mt-1 pt-3 border-t border-zinc-200/50 flex justify-end">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivityLogDocumentId(voucher.id);
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
            {filteredVouchers.length === 0 && (
              <div className="col-span-full p-12 text-center text-zinc-500 font-bold italic">لا توجد سندات صرف حالياً</div>
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
              {editingVoucher && (
                <div className="hidden lg:flex items-center gap-2 bg-zinc-100 p-1.5 rounded-2xl">
                  <button 
                    type="button"
                    onClick={handlePrevVoucher}
                    className="flex items-center gap-1 px-3 py-1.5 hover:bg-white rounded-xl transition-all text-zinc-600 disabled:opacity-30 text-xs font-black"
                    disabled={vouchers.findIndex(v => v.id === editingVoucher.id) === 0}
                  >
                    {dir === 'rtl' ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    {language === 'ar' ? 'السابق' : 'Prev'}
                  </button>
                  <button 
                    type="button"
                    onClick={handleNextVoucher}
                    className="flex items-center gap-1 px-3 py-1.5 hover:bg-white rounded-xl transition-all text-zinc-600 disabled:opacity-30 text-xs font-black"
                    disabled={vouchers.findIndex(v => v.id === editingVoucher.id) === vouchers.length - 1}
                  >
                    {language === 'ar' ? 'التالي' : 'Next'}
                    {dir === 'rtl' ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                  </button>
                </div>
              )}
              <h3 className="text-xl md:text-2xl font-black text-zinc-900 tracking-tight">
                {editingVoucher ? 'تعديل سند صرف' : 'إضافة سند صرف'}
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
                        documentId={editingVoucher?.id || ''}
                        category="payment_vouchers" 
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
                  if (data.supplierName) {
                    const supplier = suppliers.find(s => s.name.includes(data.supplierName!) || data.supplierName!.includes(s.name));
                    if (supplier) {
                      setVoucherData(prev => ({ ...prev, supplier_id: supplier.id, type: 'supplier' }));
                    }
                  }
                  if (data.amount) setVoucherData(prev => ({ ...prev, amount: data.amount! }));
                  if (data.date) setVoucherData(prev => ({ ...prev, date: data.date! }));
                  if (data.description || data.notes) setVoucherData(prev => ({ ...prev, notes: data.description || data.notes || '' }));
                  if (data.paymentMethod) {
                    const pm = paymentMethods.find(p => p.name.includes(data.paymentMethod!) || data.paymentMethod!.includes(p.name));
                    if (pm) setVoucherData(prev => ({ ...prev, payment_method_id: pm.id }));
                  }
                }}
                transactionType="payment_voucher"
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
                        <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">مرجع البرنامج</label>
                        <div className="relative">
                          <Hash className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                          <input 
                            readOnly
                            type="text" 
                            className={`w-full ${dir === 'rtl' ? 'ps-4 pe-12' : 'pe-4 ps-12'} py-3 bg-zinc-100 border border-zinc-200 cursor-not-allowed rounded-2xl font-bold text-zinc-500 text-sm outline-none font-mono`}
                            value={editingVoucher ? voucherData.internal_reference : (internalRef || voucherData.internal_reference)}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercaseTracking tracking-tighter uppercase mb-2 px-2 uppercase">مرجع يدوي / آخر</label>
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

                      {editingVoucher?.entry_number && (
                        <div>
                          <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">{language === 'ar' ? 'رقم القيد المرتبط' : 'Linked Journal Entry'}</label>
                          <div className="relative">
                            <Layers className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-emerald-500 pointer-events-none`} />
                            <input 
                              readOnly
                              type="text"
                              className={`w-full ${dir === 'rtl' ? 'ps-4 pe-12' : 'pe-4 ps-12'} py-3 bg-emerald-50 border border-emerald-200 rounded-2xl outline-none transition-all font-bold text-emerald-800 text-sm`}
                              value={editingVoucher.entry_number}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase tracking-tighter uppercase mb-2 px-2 uppercase">طريقة الصرف (من خزينة/بنك)</label>
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
                          <option value="">اختر الطريقة...</option>
                          {paymentMethods.map(pm => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
                          <option value="new_payment_method" className="font-bold text-emerald-600">+ إضافة طريقة دفع جديدة...</option>
                        </select>
                        <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                      </div>
                    </div>
                  </section>

                  {/* Card 2: Beneficiaries & Amounts */}
                  <section className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm space-y-6 relative pt-12">
                    <div className="absolute top-4 right-4 flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                      <Layers className="w-4 h-4" />
                      <span className="text-xs font-bold">بنود الصرف</span>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                        <h4 className="font-bold text-zinc-900 italic tracking-tight uppercase text-sm">تفاصيل البنود</h4>
                        <button 
                          type="button"
                          onClick={() => setVoucherData({
                            ...voucherData,
                            items: [...voucherData.items, { type: 'supplier', entity_id: '', amount: 0, description: '' }]
                          })}
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-black border border-emerald-100 hover:bg-emerald-100 transition-all shadow-sm"
                        >
                          <Plus size={16} />
                          <span>إضافة بند صرف جديد</span>
                        </button>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className={`text-zinc-500 text-[10px] uppercase font-black tracking-widest ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                              <th className="px-2 py-3 w-32 tracking-tighter">النوع</th>
                              <th className="px-2 py-3 tracking-tighter">المستفيد / الحساب</th>
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
                                      <option value="supplier">مورد</option>
                                      <option value="customer">عميل</option>
                                      <option value="expense">بند مصروف</option>
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
                                      {item.type === 'supplier' && suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                                      {item.type === 'customer' && customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
                                      className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
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
                                                  const serial = generateSettlementSerial(e.target.value, allReceipts, allPayments);
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
                                                    <th className="pb-2 text-center w-36">رقم التسوية</th>
                                                    <th className="pb-2 text-center w-36">تاريخ التسوية</th>
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
                                                        <td className="py-2.5">
                                                          <input
                                                            disabled
                                                            type="text"
                                                            className="w-36 bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1 text-center text-zinc-500 font-mono text-xs font-black"
                                                            value={settlement?.settlement_number || ''}
                                                            placeholder="-"
                                                          />
                                                        </td>
                                                        <td className="py-2.5">
                                                          <input
                                                            type="date"
                                                            className="w-36 bg-white border border-zinc-200 rounded-lg px-2 py-1 text-center text-zinc-700 text-xs font-bold focus:ring-1 focus:ring-emerald-500"
                                                            value={rowSettlementDates[`${idx}-${t.id}`] || voucherData.date.slice(0, 10)}
                                                            onChange={(e) => handleRowDateChange(idx, t, e.target.value)}
                                                          />
                                                        </td>
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
                            {voucherData.items.length === 0 && (
                              <tr>
                                <td colSpan={5} className="py-12 text-center text-zinc-400 italic text-sm">لم يتم إضافة أي بنود صرف بعد</td>
                              </tr>
                            )}
                          </tbody>
                          <tfoot>
                            <tr className="bg-zinc-50/50">
                              <td colSpan={2} className="px-4 py-4 font-black text-zinc-900 border-t border-zinc-100 text-sm italic tracking-tighter uppercase underline decoration-emerald-300 decoration-2 underline-offset-4 tracking-tight">إجمالي المبلغ المنصرف:</td>
                              <td className="px-2 py-4 font-black text-2xl text-emerald-600 border-t border-zinc-100 text-center tracking-tighter">
                                {formatNumber(voucherData.items.reduce((sum, item) => sum + item.amount, 0))}
                              </td>
                              <td colSpan={2} className="border-t border-zinc-100"></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase tracking-tighter uppercase mb-2 px-2 uppercase tracking-tighter uppercase mb-2 px-2 uppercase tracking-tighter uppercase mb-2 px-2 uppercase">البيان العام / ملاحظات إضافية</label>
                      <textarea 
                        rows={3}
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-3xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none font-bold text-sm text-zinc-800"
                        placeholder="اكتب ملاحظات السند هنا..."
                        value={voucherData.notes}
                        onChange={(e) => setVoucherData({...voucherData, notes: e.target.value})}
                      />
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
                  disabled={voucherData.items.reduce((sum, item) => sum + item.amount, 0) <= 0 || !voucherData.payment_method_id}
                  className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-3"
                >
                  <Save className="w-6 h-6" />
                  {editingVoucher ? 'حفظ التعديلات' : 'حفظ السند'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* View Modal */}
      {viewVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                  <FileText size={24} />
                </div>
                <h3 className="text-xl font-bold text-zinc-900">سند صرف رقم {viewVoucher.id}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    setActivityLogDocumentId(viewVoucher.id);
                    setIsActivityLogOpen(true);
                  }}
                  className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all"
                  title="سجل النشاط"
                >
                  <History size={20} />
                </button>
                <button 
                  onClick={() => exportToPDF(viewVoucher)}
                  className="p-2 text-zinc-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                  title="تصدير PDF"
                >
                  <Download size={20} />
                </button>
                <button 
                  onClick={() => setViewVoucher(null)}
                  className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-xl transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row h-full">
              {/* Side Panel for Activity Log and Journal Entry */}
              <TransactionSidePanel 
                documentId={viewVoucher.id} 
                category="payment_vouchers" 
              />

              <div className="flex-1 overflow-y-auto p-8" ref={voucherRef}>
                <CompanyInvoiceHeader 
                  company={companyData} 
                  documentNumber={viewVoucher.voucher_number || viewVoucher.number}
                  documentDate={formatDate(viewVoucher.date)}
                  title="سند صرف"
                />
                
                <div className="space-y-8">

                  {(viewVoucher.items && viewVoucher.items.length > 0) ? (
                    <div className="overflow-hidden border border-zinc-100 rounded-2xl">
                      <table className="w-full text-right">
                        <thead className="bg-zinc-50 text-xs text-zinc-500 uppercase font-bold">
                          <tr>
                            <th className="px-4 py-3">البند / المستفيد</th>
                            <th className="px-4 py-3">الوصف</th>
                            <th className="px-4 py-3 text-left">المبلغ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {viewVoucher.items.map((item: any, idx: number) => {
                            let name = '';
                            if (item.type === 'supplier') name = suppliers.find(s => s.id === item.entity_id)?.name || 'مورد';
                            else if (item.type === 'customer') name = customers.find(c => c.id === item.entity_id)?.name || 'عميل';
                            else if (item.type === 'expense') name = categories.find(c => c.id === item.entity_id)?.name || 'مصروف';
                            else name = accounts.find(a => a.id === item.entity_id)?.name || 'حساب';

                            return (
                              <React.Fragment key={idx}>
                                <tr>
                                  <td className="px-4 py-3">
                                    <div className="font-bold text-zinc-900">{name}</div>
                                    <div className="text-[10px] text-zinc-400 capitalize">{item.type}</div>
                                  </td>
                                  <td className="px-4 py-3 text-zinc-500 text-sm">{item.description}</td>
                                  <td className="px-4 py-3 text-left font-bold text-zinc-900">{formatNumber(item.amount)}</td>
                                </tr>
                                {item.settlements && item.settlements.length > 0 && (
                                  <tr className="bg-zinc-50/50">
                                    <td colSpan={3} className="px-4 py-3 border-t border-b border-zinc-100">
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
                                                        setViewVoucher(null);
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
                                                        setViewVoucher(null);
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
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-zinc-50/50">
                          <tr>
                            <td colSpan={2} className="px-4 py-3 font-bold text-zinc-900 text-left">الإجمالي:</td>
                            <td className="px-4 py-3 text-left font-black text-emerald-600 text-lg">{formatNumber(viewVoucher.amount)} ج.م</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-8 p-6 bg-zinc-50 rounded-2xl border border-zinc-100">
                      <div>
                        <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">يصرف للسيد / السادة</p>
                        <p className="text-lg font-bold text-zinc-900">{viewVoucher.supplier_name || viewVoucher.category_name || '---'}</p>
                      </div>
                      <div className="text-left">
                        <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">المبلغ</p>
                        <p className="text-2xl font-black text-emerald-600">{formatNumber(viewVoucher.amount)} ج.م</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    {viewVoucher.voucher_type !== 'multi' && (
                      <div className="flex justify-between py-3 border-b border-zinc-100">
                        <span className="text-zinc-500">وذلك عن:</span>
                        <span className="font-bold text-zinc-900">{viewVoucher.description || '---'}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-3 border-b border-zinc-100">
                      <span className="text-zinc-500">طريقة الصرف:</span>
                      <span className="font-bold text-zinc-900">{viewVoucher.payment_method_name || '---'}</span>
                    </div>
                    {viewVoucher.entry_number && (
                      <div className="flex justify-between py-3 border-b border-zinc-100">
                        <span className="text-zinc-500">{language === 'ar' ? 'رقم القيد:' : 'Journal Entry:'}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewVoucher(null);
                            setPendingViewDoc({ type: 'journal', idOrNumber: viewVoucher.entry_number! });
                            setCurrentPage('journal_entries');
                          }}
                          className="text-emerald-600 hover:text-emerald-700 hover:underline font-mono font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100/50"
                        >
                          {viewVoucher.entry_number}
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
                      <Search className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <input
                        required
                        type="text"
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
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
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all text-left"
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
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all text-left"
                        value={supplierFormData.email}
                        onChange={(e) => setSupplierFormData({ ...supplierFormData, email: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">العنوان</label>
                    <textarea
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
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
                          className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
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
                          className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
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
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
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
                    className="flex-1 py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-900/20 active:scale-95"
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

      {/* Add Expense Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full h-full md:h-auto md:max-w-md md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-4 md:p-6 border-b border-zinc-50 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg md:text-xl font-bold text-zinc-900">إضافة بند مصروف جديد</h3>
              <button onClick={() => setIsCategoryModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 p-2 hover:bg-zinc-100 rounded-xl transition-all"><X size={24} /></button>
            </div>
            <form onSubmit={handleCategorySubmit} className="p-4 md:p-6 space-y-4 flex-1 overflow-y-auto pb-32 md:pb-6">
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">اسم البند</label>
                <input
                  required
                  type="text"
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                  value={categoryFormData.name}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">الوصف</label>
                <textarea
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                  value={categoryFormData.description}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                />
              </div>
              <div className="pt-4 pb-8 md:pb-0">
                <button 
                  type="submit"
                  className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-900/20 active:scale-95"
                >
                  حفظ البند
                </button>
              </div>
            </form>
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
            <p className="text-zinc-500 mb-6">هل أنت متأكد من رغبتك في حذف هذا السند؟ لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setVoucherToDelete(null);
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
        category="payment_vouchers"
        documentId={activityLogDocumentId}
      />
    </div>
  );
};
