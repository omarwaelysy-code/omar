import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  Search, Plus, Trash2, X, Receipt as ReceiptIcon, Pencil, 
  CreditCard, Download, Eye, FileText, FileSpreadsheet, History, Printer, 
  Phone, Mail, MapPin, Wallet, Calendar, Hash, Layers, 
  LayoutGrid, List, Maximize2, Minimize2, ChevronRight, ChevronLeft, RotateCcw, User, ChevronDown, Save, Copy, Sparkles, DollarSign, Coins, Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { exportToPDF as exportToPDFUtil, printElement } from '../utils/pdfUtils';
import { exportToExcel, exportSingleDocumentToExcel, formatDataForExcel } from '../utils/excelUtils';
import { tafqeet } from '../utils/tafqeet';

import { dbService, apiRequest } from '../services/dbService';
import { PageActivityLog } from '../components/PageActivityLog';
import { InlineActivityLog } from '../components/InlineActivityLog';
import { JournalEntryPreview } from '../components/JournalEntryPreview';
import { TransactionSidePanel } from '../components/TransactionSidePanel';
import { ExportButtons } from '../components/ExportButtons';
import { SmartAIInput } from '../components/SmartAIInput';
import { printDocument } from '../utils/printEngine';
import { TransactionManager } from '../services/TransactionManager';
import { VoucherSchema, JournalEntrySchema } from '../lib/schemas';
import { ActivityLog, ReceiptVoucher, Customer, Supplier, ExpenseCategory, PaymentMethod, JournalEntry, JournalEntryItem, Account, Company, Currency, Employee } from '../types';
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'general' | 'customer'>('all');
  const [modalMode, setModalMode] = useState<'general' | 'customer'>('general');

  const getReceiptKind = (r: any): 'customer' | 'general' => {
    if (!r) return 'general';
    if (r.customer_id || r.type === 'customer') return 'customer';
    if (r.items && Array.isArray(r.items) && r.items.length > 0) {
      if (r.items.some((i: any) => i.type === 'customer' || i.customer_id)) {
        return 'customer';
      }
    }
    return 'general';
  };
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
  const [showAiInput, setShowAiInput] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<ReceiptVoucher | null>(null);
  const editModalRef = useRef<HTMLDivElement>(null);
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
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companyCurrencies, setCompanyCurrencies] = useState<Currency[]>([]);
  const [exchangeRateType, setExchangeRateType] = useState<'auto' | 'manual'>('manual');

  const [voucherData, setVoucherData] = useState({
    internal_reference: '',
    manual_reference: '',
    items: [] as any[],
    customer_id: '',
    supplier_id: '',
    amount: 0,
    payment_method_id: '',
    date: new Date().toISOString().slice(0, 10),
    notes: '',
    paid_to_type: 'employee' as 'employee' | 'external',
    paid_to_employee_id: '',
    paid_to_external_name: '',
    currency_id: '',
    exchange_rate: 1
  });

  const handleCurrencyChange = async (currencyId: string) => {
    if (!currencyId || !user) {
      setVoucherData(prev => ({ ...prev, currency_id: '', exchange_rate: 1 }));
      setExchangeRateType('manual');
      return;
    }

    setVoucherData(prev => ({ ...prev, currency_id: currencyId }));
    const updateMethod = companyData?.settings?.exchange_rate_update_method || 'manual';

    if (updateMethod === 'auto') {
      try {
        const latestAutoRates = await apiRequest<Array<{
          currency_id: string;
          rate: number | null;
          rate_date: string | null;
        }>>(`/currency-rates/latest?company_id=${user.company_id}`);
        
        const rateObj = latestAutoRates.find(r => r.currency_id === currencyId);
        if (rateObj && rateObj.rate !== null && Number(rateObj.rate) > 0) {
          const autoRate = Number(rateObj.rate);
          setVoucherData(prev => ({ ...prev, currency_id: currencyId, exchange_rate: autoRate }));
          setExchangeRateType('auto');
          return;
        }
      } catch (error) {
        console.error('Error fetching auto currency rate in Receipts:', error);
      }
    }

    try {
      const manualRates = await dbService.list<any>('exchange_rates', {
        currency_id: currencyId,
        company_id: user.company_id,
        _limit: 1,
        _sort: 'rate_date',
        _order: 'desc'
      });
      if (manualRates && manualRates.length > 0 && Number(manualRates[0].exchange_rate) > 0) {
        setVoucherData(prev => ({ ...prev, currency_id: currencyId, exchange_rate: Number(manualRates[0].exchange_rate) }));
        setExchangeRateType('manual');
        return;
      }

      const curr = companyCurrencies.find(c => c.id === currencyId);
      if (curr && (curr as any).exchange_rate && Number((curr as any).exchange_rate) > 0) {
        setVoucherData(prev => ({ ...prev, currency_id: currencyId, exchange_rate: Number((curr as any).exchange_rate) }));
        setExchangeRateType('manual');
        return;
      }

      setVoucherData(prev => ({ ...prev, currency_id: currencyId, exchange_rate: 1 }));
      setExchangeRateType('manual');
    } catch (e) {
      console.error(e);
      setVoucherData(prev => ({ ...prev, currency_id: currencyId, exchange_rate: 1 }));
      setExchangeRateType('manual');
    }
  };

  const [allInvoices, setAllInvoices] = useState<any[]>([]);
  const [allPayments, setAllPayments] = useState<any[]>([]);
  const [allJournalEntries, setAllJournalEntries] = useState<any[]>([]);
  const [allPurchaseInvoices, setAllPurchaseInvoices] = useState<any[]>([]);
  const [allReturns, setAllReturns] = useState<any[]>([]);
  const [allPurchaseReturns, setAllPurchaseReturns] = useState<any[]>([]);
  const [allReceipts, setAllReceipts] = useState<any[]>([]);
  const [rowSettlementDates, setRowSettlementDates] = useState<Record<string, string>>({});

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

  const getInvoiceSideSettledAmount = (voucherId: string | undefined, itemIdx: number) => {
    if (!voucherId) return 0;
    let sum = 0;
    const targetId = `${voucherId}-${itemIdx}`;
    
    const sumFromList = (list: any[]) => {
      if (!Array.isArray(list)) return;
      list.forEach(inv => {
        if (!inv) return;
        if (inv.settlements && Array.isArray(inv.settlements)) {
          inv.settlements.forEach((s: any) => {
            if (s && String(s.target_id) === String(targetId)) {
              sum += Number(s.settled_amount || s.amount) || 0;
            }
          });
        }
      });
    };
    
    sumFromList(allInvoices);
    sumFromList(allPurchaseInvoices);
    return sum;
  };

  const getUniqueSettlementsForVoucherItem = (item: any, idx: number) => {
    return item.settlements || [];
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
      
      sumVoucherSettlements(allReceipts);
      sumVoucherSettlements(allPayments);
      sumInvoiceSettlements(allInvoices);
      sumInvoiceSettlements(allPurchaseInvoices);
      
      return settledSum;
    };

    const getInvoiceSettledAmount = (inv: any, entityType: 'customer' | 'supplier') => {
      let settled = 0;
      const targetId = inv.id;
      const countedVoucherItemIds = new Set<string>();

      const sumVoucherSettlements = (vouchersList: any[]) => {
        vouchersList.forEach(v => {
          if (editingReceipt && v.id === editingReceipt.id) return;
          if (v.items && Array.isArray(v.items)) {
            v.items.forEach((item, idx) => {
              if (item.settlements && Array.isArray(item.settlements)) {
                item.settlements.forEach((s: any) => {
                  if (s.target_id === targetId) {
                    settled += Number(s.settled_amount) || 0;
                    countedVoucherItemIds.add(`${v.id}-${idx}`);
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
          const parts = (s.target_id || '').split('-');
          const voucherOriginalId = parts.length > 1 ? parts.slice(0, -1).join('-') : s.target_id;
          if (editingReceipt && String(voucherOriginalId) === String(editingReceipt.id)) {
            return;
          }
          const alreadyCounted = countedVoucherItemIds.has(s.target_id);
          if (!alreadyCounted) {
            settled += Number(s.settled_amount || s.amount) || 0;
          }
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
        settlement_date: rowDate,
        created_from: 'receipts'
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
      const unsubAllReceipts = dbService.subscribe<any>('receipt_vouchers', user.company_id, setAllReceipts);
      const unsubEmployees = dbService.subscribe<Employee>('employees', user.company_id, setEmployees);
      const unsubCurrencies = dbService.subscribe<Currency>('company_currencies', user.company_id, setCompanyCurrencies);
      
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
        unsubAllReceipts();
        unsubEmployees();
        unsubCurrencies();
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
      let debitAccountName = paymentMethod?.name || 'حساب النقدية';

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
      showNotification(t('common.save_success'), 'success');
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
      showNotification(t('common.save_success'), 'success');
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء إضافة طريقة الدفع', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSubmitting) return;
    setIsSubmitting(true);

    const finalAmount = voucherData.items.reduce((sum, item) => sum + item.amount, 0);
    if (finalAmount <= 0) {
      showNotification(language === 'ar' ? 'يرجى إدخال مبلغ صحيح' : 'Please enter a valid amount', 'error');
      return;
    }

    if (!voucherData.payment_method_id) {
      showNotification(language === 'ar' ? 'يرجى اختيار طريقة القبض' : 'Please select payment method', 'error');
      return;
    }

    // Validation: check if settlement sum is greater than the item amount
    for (let i = 0; i < voucherData.items.length; i++) {
      const item = voucherData.items[i];
      if ((item.type === 'customer' || item.type === 'supplier') && item.entity_id) {
        const uniqueSettlements = getUniqueSettlementsForVoucherItem(item, i);
        const totalSettled = uniqueSettlements.reduce((sum: number, s: any) => sum + s.settled_amount, 0);
        if (totalSettled > item.amount) {
          showNotification(language === 'ar' ? 'التسوية أكبر من المبلغ الإجمالي' : 'Settlement is larger than total amount', 'error');
          return;
        }
      }
    }

    // ─── Accounting Account Validation ───────────────────────────────────────
    // Validate payment method has an account
    const selectedPaymentMethod = paymentMethods.find(pm => pm.id === voucherData.payment_method_id);
    if (!selectedPaymentMethod?.account_id) {
      setIsSubmitting(false);
      showNotification(
        language === 'ar'
          ? `لا يمكن حفظ السند — طريقة الدفع "${selectedPaymentMethod?.name || ''}" لا تملك حساباً محاسبياً مربوطاً. يرجى فتح بيانات طريقة الدفع وتحديد الحساب المحاسبي.`
          : `Cannot save — Payment method "${selectedPaymentMethod?.name || ''}" has no linked account. Please configure it first.`,
        'error'
      );
      return;
    }
    // Validate each item's account
    for (const item of voucherData.items) {
      if (item.type === 'customer') {
        const customer = customers.find(c => c.id === item.entity_id);
        if (!customer?.account_id) {
          setIsSubmitting(false);
          showNotification(
            language === 'ar'
              ? `لا يمكن حفظ السند — العميل "${customer?.name || ''}" لا يملك حساباً محاسبياً مربوطاً. يرجى فتح بيانات العميل وتحديد الحساب المحاسبي.`
              : `Cannot save — Customer "${customer?.name || ''}" has no linked account.`,
            'error'
          );
          return;
        }
      } else if (item.type === 'supplier') {
        const supplier = suppliers.find(s => s.id === item.entity_id);
        if (!supplier?.account_id) {
          setIsSubmitting(false);
          showNotification(
            language === 'ar'
              ? `لا يمكن حفظ السند — المورد "${supplier?.name || ''}" لا يملك حساباً محاسبياً مربوطاً. يرجى فتح بيانات المورد وتحديد الحساب المحاسبي.`
              : `Cannot save — Supplier "${supplier?.name || ''}" has no linked account.`,
            'error'
          );
          return;
        }
      } else if (item.type === 'expense') {
        const category = categories.find(c => c.id === item.entity_id);
        if (!category?.account_id) {
          setIsSubmitting(false);
          showNotification(
            language === 'ar'
              ? `لا يمكن حفظ السند — بند المصروف "${category?.name || ''}" لا يملك حساباً محاسبياً مربوطاً. يرجى فتح بيانات بند المصروف وتحديد الحساب المحاسبي.`
              : `Cannot save — Expense category "${category?.name || ''}" has no linked account.`,
            'error'
          );
          return;
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

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
      let debitAccountName = paymentMethod?.name || 'حساب النقدية';

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

      let savedVoucherId = editingReceipt ? editingReceipt.id : '';

      if (editingReceipt) {
        await dbService.deleteJournalEntryByReference(editingReceipt.id, user.company_id);
        const res = await TransactionManager.updateWithAccounting(
          'receipt_vouchers',
          editingReceipt.id,
          receiptData,
          VoucherSchema,
          journalEntryData,
          JournalEntrySchema
        );
        savedVoucherId = res.mainId;
      } else {
        const res = await TransactionManager.saveWithAccounting(
          'receipt_vouchers',
          receiptData,
          VoucherSchema,
          journalEntryData,
          JournalEntrySchema
        );
        savedVoucherId = res.mainId;
      }

      // === TWO-WAY SYNC: Update invoices with voucher-side settlements ===
      if (savedVoucherId) {
        try {
          // Group settlements by invoice (s.target_id)
          const invoiceUpdates = new Map<string, { collection: string; settlements: any[] }>();
          
          voucherData.items.forEach((item, itemIdx) => {
            if (item.settlements && Array.isArray(item.settlements)) {
              item.settlements.forEach((s: any) => {
                if (s.type === 'invoice' || s.type === 'purchase_invoice') {
                  const collection = s.type === 'invoice' ? 'invoices' : 'purchase_invoices';
                  const invoiceId = s.target_id;
                  const key = `${collection}:${invoiceId}`;
                  if (!invoiceUpdates.has(key)) {
                    invoiceUpdates.set(key, { collection, settlements: [] });
                  }
                  invoiceUpdates.get(key)!.settlements.push({
                    ...s,
                    itemIdx,
                    originalItemAmount: Number(item.amount) || 0
                  });
                }
              });
            }
          });

          // Update each invoice
          for (const [key, { collection, settlements }] of invoiceUpdates) {
            const invoiceId = key.split(':')[1];
            try {
              const invoice = await dbService.get<any>(collection, invoiceId);
              if (!invoice) continue;

              const existingSettlements = [...(invoice.settlements || [])];
              let changed = false;

              for (const s of settlements) {
                const itemIdx = s.itemIdx;
                const targetId = `${savedVoucherId}-${itemIdx}`;

                // Find existing settlement for this voucher item
                const existingIdx = existingSettlements.findIndex(
                  (es: any) => es.target_id === targetId
                );

                // Build the settlement object for the invoice side
                const invoiceSideSettlement = {
                  target_id: targetId,
                  settled_amount: Number(s.settled_amount) || 0,
                  reference_number: receipt_number,
                  entry_number: journalEntryData.reference_number || '',
                  type: 'receipts',
                  type_label: 'سند قبض',
                  date: voucherData.date,
                  original_amount: s.originalItemAmount,
                  settlement_number: s.settlement_number || '',
                  settlement_date: s.settlement_date || voucherData.date.slice(0, 10)
                };

                if (existingIdx > -1) {
                  existingSettlements[existingIdx] = invoiceSideSettlement;
                } else {
                  existingSettlements.push(invoiceSideSettlement);
                }
                changed = true;
              }

              if (changed) {
                await dbService.update(collection, invoiceId, { ...invoice, settlements: existingSettlements });
              }
            } catch (syncErr) {
              console.error(`[SYNC] Failed to update invoice ${invoiceId}:`, syncErr);
            }
          }
        } catch (syncErr) {
          console.error('[SYNC] Invoice settlement sync failed:', syncErr);
        }
      }

      // Handle removed settlements (when editing) - remove from invoices
      if (editingReceipt && editingReceipt.items) {
        const oldSettlements: any[] = [];
        editingReceipt.items.forEach((item, itemIdx) => {
          if (item.settlements && Array.isArray(item.settlements)) {
            item.settlements.forEach((s: any) => {
              oldSettlements.push({ ...s, itemIdx });
            });
          }
        });

        const newTargetIds = new Set();
        voucherData.items.forEach((item, itemIdx) => {
          if (item.settlements && Array.isArray(item.settlements)) {
            item.settlements.forEach((s: any) => {
              newTargetIds.add(`${s.target_id}-${itemIdx}`);
            });
          }
        });

        const removedSettlements = oldSettlements.filter(
          (s: any) => !newTargetIds.has(`${s.target_id}-${s.itemIdx}`)
        );

        for (const removed of removedSettlements) {
          try {
            const invoiceId = removed.target_id;
            const collection = removed.type === 'invoice' ? 'invoices' : 
                               removed.type === 'purchase_invoice' ? 'purchase_invoices' : null;
            if (!collection) continue;

            const invoice = await dbService.get<any>(collection, invoiceId);
            if (!invoice || !invoice.settlements) continue;

            const targetId = `${editingReceipt.id}-${removed.itemIdx}`;
            const updatedSettlements = invoice.settlements.filter(
              (es: any) => es.target_id !== targetId
            );

            if (updatedSettlements.length !== invoice.settlements.length) {
              await dbService.update(collection, invoiceId, { ...invoice, settlements: updatedSettlements });
            }
          } catch (syncErr) {
            console.error('[SYNC] Failed to remove settlement from invoice:', syncErr);
          }
        }
      }

      showNotification(language === 'ar' ? (editingReceipt ? 'تم تحديث سند القبض بنجاح' : 'تم إضافة سند القبض بنجاح') : (editingReceipt ? 'Receipt voucher updated successfully' : 'Receipt voucher saved successfully'), 'success');
      closeModal();

      if (!editingReceipt) {
        dbService.logActivity(user.id, user.username, user.company_id, 'إضافة سند قبض', `إضافة سند قبض جديد بقيمة: ${finalAmount}`, 'receipt_vouchers');
      }

    } catch (e: any) {
      console.error('Save failed:', e);
      showNotification(e.message || (language === 'ar' ? 'حدث خطأ أثناء حفظ السند' : 'An error occurred while saving voucher'), 'error');
    } finally {
      setIsSubmitting(false);
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
      
      // Clean up invoice settlements referencing this receipt voucher
      const invoicesToUpdate = allInvoices.filter(inv => 
        inv.settlements && Array.isArray(inv.settlements) && 
        inv.settlements.some((s: any) => {
          const parts = (s.target_id || '').split('-');
          const voucherOriginalId = parts.length > 1 ? parts.slice(0, -1).join('-') : s.target_id;
          return String(voucherOriginalId) === String(receiptToDelete);
        })
      );

      for (const inv of invoicesToUpdate) {
        const updatedSettlements = inv.settlements.filter((s: any) => {
          const parts = (s.target_id || '').split('-');
          const voucherOriginalId = parts.length > 1 ? parts.slice(0, -1).join('-') : s.target_id;
          return String(voucherOriginalId) !== String(receiptToDelete);
        });
        await dbService.update('invoices', inv.id, { settlements: updatedSettlements });
      }

      const purchaseInvoicesToUpdate = allPurchaseInvoices.filter(inv => 
        inv.settlements && Array.isArray(inv.settlements) && 
        inv.settlements.some((s: any) => {
          const parts = (s.target_id || '').split('-');
          const voucherOriginalId = parts.length > 1 ? parts.slice(0, -1).join('-') : s.target_id;
          return String(voucherOriginalId) === String(receiptToDelete);
        })
      );

      for (const inv of purchaseInvoicesToUpdate) {
        const updatedSettlements = inv.settlements.filter((s: any) => {
          const parts = (s.target_id || '').split('-');
          const voucherOriginalId = parts.length > 1 ? parts.slice(0, -1).join('-') : s.target_id;
          return String(voucherOriginalId) !== String(receiptToDelete);
        });
        await dbService.update('purchase_invoices', inv.id, { settlements: updatedSettlements });
      }

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

  const openNewGeneralReceipt = async () => {
    setEditingReceipt(null);
    setModalMode('general');
    const newRef = await generateInternalRef(new Date().toISOString().slice(0, 10));
    setInternalRef(newRef);
    setVoucherData({
      internal_reference: newRef,
      manual_reference: '',
      items: [{ type: 'account', entity_id: '', amount: 0, description: '' }],
      customer_id: '',
      supplier_id: '',
      amount: 0,
      payment_method_id: '',
      date: new Date().toISOString().slice(0, 10),
      notes: '',
      paid_to_type: 'employee',
      paid_to_employee_id: '',
      paid_to_external_name: '',
      currency_id: '',
      exchange_rate: 1
    });
    setIsModalOpen(true);
  };

  const openNewCustomerReceipt = async () => {
    setEditingReceipt(null);
    setModalMode('customer');
    const newRef = await generateInternalRef(new Date().toISOString().slice(0, 10));
    setInternalRef(newRef);
    setVoucherData({
      internal_reference: newRef,
      manual_reference: '',
      items: [{ type: 'customer', entity_id: '', amount: 0, description: '' }],
      customer_id: '',
      supplier_id: '',
      amount: 0,
      payment_method_id: '',
      date: new Date().toISOString().slice(0, 10),
      notes: '',
      paid_to_type: 'employee',
      paid_to_employee_id: '',
      paid_to_external_name: '',
      currency_id: '',
      exchange_rate: 1
    });
    setIsModalOpen(true);
  };

  const openEditModal = async (receipt: ReceiptVoucher) => {
    try {
      const fullData = await dbService.get<ReceiptVoucher>('receipt_vouchers', receipt.id);
      if (fullData) {
        setModalMode(getReceiptKind(fullData));
      }

      if (!fullData) throw new Error('Receipt not found');

      setInternalRef(fullData.voucher_number || '');
      
      const loadedItems = fullData.items && fullData.items.length > 0
        ? fullData.items
        : [{
            type: 'customer' as const,
            entity_id: fullData.customer_id || '',
            amount: fullData.amount,
            description: fullData.description || ''
          }];

      const mergedItems = loadedItems.map((item: any, idx: number) => {
        const uniqueMap = new Map<string, any>();
        
        // 1. Add voucher side settlements
        if (item.settlements && Array.isArray(item.settlements)) {
          item.settlements.forEach((s: any) => {
            uniqueMap.set(s.target_id, {
              target_id: s.target_id,
              settled_amount: Number(s.settled_amount) || 0,
              settlement_number: s.settlement_number || '',
              settlement_date: s.settlement_date || '',
              type: s.type || 'invoice',
              type_label: s.type_label || '',
              reference_number: s.reference_number || '',
              entry_number: s.entry_number || '',
              date: s.date || '',
              original_amount: s.original_amount || 0
            });
          });
        }

        // 2. Add invoice side settlements
        const targetId = `${fullData.id}-${idx}`;
        const mergeFromList = (list: any[], type: 'invoice' | 'purchase_invoice', typeLabel: string) => {
          if (!Array.isArray(list)) return;
          list.forEach(inv => {
            if (!inv) return;
            if (inv.settlements && Array.isArray(inv.settlements)) {
              inv.settlements.forEach((s: any) => {
                if (s && String(s.target_id) === String(targetId)) {
                  if (!uniqueMap.has(inv.id)) {
                    uniqueMap.set(inv.id, {
                      target_id: inv.id,
                      settled_amount: Number(s.settled_amount || s.amount) || 0,
                      settlement_number: s.settlement_number || '',
                      settlement_date: s.settlement_date || s.date || '',
                      type,
                      type_label: typeLabel,
                      reference_number: inv.invoice_number || '',
                      entry_number: inv.entry_number || '',
                      date: inv.date || '',
                      original_amount: inv.total_amount || 0
                    });
                  }
                }
              });
            }
          });
        };
        mergeFromList(allInvoices, 'invoice', 'فاتورة مبيعات');
        mergeFromList(allPurchaseInvoices, 'purchase_invoice', 'فاتورة مشتريات');

        return {
          ...item,
          settlements: Array.from(uniqueMap.values())
        };
      });

      fullData.items = mergedItems;
      setEditingReceipt(fullData);

      setVoucherData({
        internal_reference: fullData.internal_reference || fullData.voucher_number || '',
        manual_reference: fullData.manual_reference || '',
        items: mergedItems,
        customer_id: fullData.customer_id || '',
        supplier_id: fullData.supplier_id || '',
        amount: fullData.amount,
        payment_method_id: fullData.payment_method_id || '',
        date: fullData.date ? fullData.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
        notes: fullData.description || '',
        paid_to_type: (fullData as any).paid_to_type || 'employee',
        paid_to_employee_id: (fullData as any).paid_to_employee_id || '',
        paid_to_external_name: (fullData as any).paid_to_external_name || '',
        currency_id: (fullData as any).currency_id || '',
        exchange_rate: (fullData as any).exchange_rate || 1
      });
      setIsModalOpen(true);
      const datesDict: Record<string, string> = {};
      if (mergedItems && Array.isArray(mergedItems)) {
        mergedItems.forEach((item: any, itemIdx: number) => {
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

    } catch (error: any) {
      console.error('[EDIT] Error loading receipt:', error);
      showNotification(language === 'ar' ? 'فشل تحميل بيانات سند القبض' : 'Failed to load voucher details', 'error');
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

  const printOfficialReceipt = (r: any) => {
    if (!r) return;
    const kind = getReceiptKind(r);
    const kindTitle = kind === 'customer' ? 'سند قبض من عميل' : 'إيصال قبض نقدية';
    const voucherNum = r.internal_reference || r.voucher_number || r.number || 'جديد';
    const voucherDate = formatDate(r.date);
    const currencyCode = (companyData?.settings?.currency || 'EGP').toUpperCase();
    const amountVal = Number(r.amount || (r.items && Array.isArray(r.items) ? r.items.reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0) : 0)) || 0;
    const voucherAmount = formatNumber(amountVal);
    const tafqeetText = tafqeet(amountVal, currencyCode, 'ar');

    let payerName = '---';
    if (r.items && Array.isArray(r.items) && r.items.length > 0) {
      const names = r.items.map((it: any) => {
        if (it.type === 'customer') return customers.find(c => c.id === it.entity_id)?.name || 'عميل';
        if (it.type === 'supplier') return suppliers.find(s => s.id === it.entity_id)?.name || 'مورد';
        if (it.type === 'expense') return categories.find(c => c.id === it.entity_id)?.name || 'مصروف';
        return accounts.find(a => a.id === it.entity_id)?.name || 'حساب';
      });
      payerName = names.join(' ، ');
    } else if (r.customer_name || r.customer_id) {
      payerName = r.customer_name || customers.find(c => c.id === r.customer_id)?.name || 'عميل';
    }

    const pmName = r.payment_method_name || paymentMethods.find(p => p.id === r.payment_method_id)?.name || 'نقداً';
    const manualRefText = r.manual_reference ? `(مرجع: ${r.manual_reference})` : (r.entry_number ? `(قيد رقم: ${r.entry_number})` : '');
    const voucherDesc = r.description || r.notes || (kind === 'customer' ? 'تحصيل دفعات / تسوية فواتير عميل' : 'سند قبض نقدية');
    const companyName = companyData?.name || localStorage.getItem('company_name') || 'نظام ERP السحابي';
    const companyTax = companyData?.tax_number ? `| س.ت / ض.م: ${companyData.tax_number}` : '';
    const logoImg = (companyData?.logo_url || (companyData as any)?.logo) 
      ? `<img src="${companyData?.logo_url || (companyData as any)?.logo}" style="width:70px;height:70px;border-radius:50%;object-fit:contain;" />` 
      : `<span>${companyName.slice(0, 10)}</span>`;

    let itemsTableHtml = '';
    if (r.items && Array.isArray(r.items) && r.items.length > 1) {
      const rows = r.items.map((it: any, idx: number) => {
        let name = '-';
        if (it.type === 'customer') name = customers.find(c => c.id === it.entity_id)?.name || 'عميل';
        else if (it.type === 'supplier') name = suppliers.find(s => s.id === it.entity_id)?.name || 'مورد';
        else if (it.type === 'expense') name = categories.find(c => c.id === it.entity_id)?.name || 'مصروف';
        else name = accounts.find(a => a.id === it.entity_id)?.name || 'حساب';

        return `<tr>
          <td style="text-align:center;color:#64748b;padding:6px 10px;border:1px solid #e2e8f0;">${idx + 1}</td>
          <td style="font-weight:bold;color:#0f172a;padding:6px 10px;border:1px solid #e2e8f0;">${name}</td>
          <td style="color:#475569;padding:6px 10px;border:1px solid #e2e8f0;">${it.description || '-'}</td>
          <td style="text-align:left;font-weight:bold;color:#0f766e;padding:6px 10px;border:1px solid #e2e8f0;">${formatNumber(it.amount)}</td>
        </tr>`;
      }).join('');

      itemsTableHtml = `
        <div style="margin: 15px 0 10px;">
          <table style="width:100%;border-collapse:collapse;font-size:12px;text-align:right;">
            <thead>
              <tr style="background:#ccfbf1;color:#0f766e;">
                <th style="padding:6px 10px;border:1px solid #99f6e4;width:40px;text-align:center;">م</th>
                <th style="padding:6px 10px;border:1px solid #99f6e4;">النوع / المستفيد</th>
                <th style="padding:6px 10px;border:1px solid #99f6e4;">البيان والتفاصيل</th>
                <th style="padding:6px 10px;border:1px solid #99f6e4;width:110px;text-align:left;">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      `;
    }

    const printWin = window.open('', '_blank', 'width=950,height=750');
    if (!printWin) {
      window.print();
      return;
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>${kindTitle} - ${voucherNum}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
            direction: rtl;
            background: #fff;
            color: #1e293b;
            padding: 30px 20px;
          }
          .voucher-card {
            position: relative;
            max-width: 820px;
            margin: 0 auto;
            border: 2.5px solid #0d9488;
            border-radius: 24px;
            padding: 35px 40px;
            background: #fff;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0,0,0,0.06);
          }
          .deco-circle-bg {
            position: absolute;
            top: -35px;
            left: -35px;
            width: 160px;
            height: 160px;
            background: #ccfbf1;
            border-radius: 50%;
            z-index: 1;
          }
          .deco-circle-inner {
            position: absolute;
            top: 15px;
            left: 15px;
            width: 90px;
            height: 90px;
            background: #0d9488;
            color: #fff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 12px;
            text-align: center;
            z-index: 2;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(13, 148, 136, 0.3);
          }
          .deco-arcs {
            position: absolute;
            top: 10px;
            left: 130px;
            width: 75px;
            height: 75px;
            border-right: 3px solid #0d9488;
            border-top: 3px dashed #0d9488;
            border-radius: 50%;
            opacity: 0.35;
            z-index: 1;
          }
          .voucher-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 25px;
            position: relative;
            z-index: 3;
            padding-left: 140px;
            border-bottom: 2px solid #99f6e4;
            padding-bottom: 18px;
          }
          .voucher-title {
            font-size: 28px;
            font-weight: 900;
            color: #0d9488;
            margin-bottom: 6px;
            letter-spacing: -0.5px;
          }
          .voucher-num-date {
            display: flex;
            gap: 20px;
            font-size: 13px;
            font-weight: bold;
            color: #475569;
          }
          .amount-badge {
            background: linear-gradient(135deg, #0d9488, #059669);
            color: #fff;
            padding: 8px 18px;
            border-radius: 14px;
            font-weight: 900;
            font-size: 18px;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 4px 12px rgba(13, 148, 136, 0.25);
          }
          .body-row {
            display: flex;
            align-items: baseline;
            margin-bottom: 18px;
            font-size: 15px;
            position: relative;
            z-index: 3;
          }
          .row-label {
            width: 170px;
            font-weight: 900;
            color: #0f766e;
            flex-shrink: 0;
            font-size: 16px;
          }
          .row-value {
            flex: 1;
            border-bottom: 2px dotted #5eead4;
            padding: 5px 12px;
            font-weight: 700;
            color: #0f172a;
            background: #f0fdfa;
            border-radius: 6px;
            min-height: 34px;
            line-height: 24px;
          }
          .signatures-row {
            display: flex;
            justify-content: space-between;
            margin-top: 35px;
            padding-top: 20px;
            border-top: 2px solid #ccfbf1;
            text-align: center;
            position: relative;
            z-index: 3;
          }
          .sig-block {
            flex: 1;
          }
          .sig-title {
            font-weight: 900;
            font-size: 13px;
            color: #0f766e;
            margin-bottom: 35px;
          }
          .sig-line {
            border-bottom: 1.5px dashed #cbd5e1;
            width: 75%;
            margin: 0 auto;
          }
          .footer-info {
            margin-top: 25px;
            font-size: 10px;
            color: #94a3b8;
            display: flex;
            justify-content: space-between;
            border-top: 1px solid #f1f5f9;
            padding-top: 10px;
          }
          @media print {
            @page { size: A4 landscape; margin: 8mm; }
            body { padding: 0; background: transparent; }
            .voucher-card { border: 2.5px solid #0d9488 !important; box-shadow: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="voucher-card">
          <div class="deco-circle-bg"></div>
          <div class="deco-circle-inner">${logoImg}</div>
          <div class="deco-arcs"></div>

          <div class="voucher-header">
            <div>
              <div class="voucher-title">${kindTitle}</div>
              <div class="voucher-num-date">
                <span>رقم: <strong>${voucherNum}</strong></span>
                <span>التاريخ: <strong>${voucherDate} م</strong></span>
              </div>
            </div>
            <div>
              <div class="amount-badge">
                <span style="font-size:13px;font-weight:bold;">المبلغ:</span>
                <span>${voucherAmount}</span>
                <span style="font-size:12px;background:rgba(255,255,255,0.2);padding:2px 6px;border-radius:6px;">${currencyCode}</span>
              </div>
            </div>
          </div>

          <div class="body-row">
            <div class="row-label">استلمنا من السيد / السادة :</div>
            <div class="row-value">${payerName}</div>
          </div>

          <div class="body-row">
            <div class="row-label">مبلــــغ وقــــدره :</div>
            <div class="row-value">${tafqeetText}</div>
          </div>

          <div class="body-row">
            <div class="row-label">نقداً / شيك رقم :</div>
            <div class="row-value">${pmName} ${manualRefText}</div>
          </div>

          <div class="body-row">
            <div class="row-label">وذلــــك قيـمـــــة :</div>
            <div class="row-value">${voucherDesc}</div>
          </div>

          ${itemsTableHtml}

          <div class="signatures-row">
            <div class="sig-block">
              <div class="sig-title">المستلم (المحصّل)</div>
              <div class="sig-line"></div>
            </div>
            <div class="sig-block">
              <div class="sig-title">أمين الخزينة / الصراف</div>
              <div class="sig-line"></div>
            </div>
            <div class="sig-block">
              <div class="sig-title">المحاسب</div>
              <div class="sig-line"></div>
            </div>
            <div class="sig-block">
              <div class="sig-title">المدير المالي / الاعتماد</div>
              <div class="sig-line"></div>
            </div>
          </div>

          <div class="footer-info">
            <span>${companyName} ${companyTax}</span>
            <span>تم الإصدار آلياً عبر نظام ERP</span>
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
  };


  const handleExportExcel = () => {
    const preparedData = filteredReceipts.map(receipt => {
      const typeLabel = getReceiptKind(receipt) === 'customer' 
        ? (language === 'ar' ? 'قبض من عميل' : 'Customer Receipt') 
        : (language === 'ar' ? 'سند قبض' : 'Receipt Voucher');
      return {
        ...receipt,
        resolved_type: typeLabel,
        resolved_date: formatDate(receipt.date),
        resolved_amount: receipt.amount
      };
    });

    const formattedData = formatDataForExcel(preparedData, {
      'voucher_number': language === 'ar' ? 'الرقم' : 'Number',
      'resolved_type': language === 'ar' ? 'النوع' : 'Type',
      'customer_name': language === 'ar' ? 'المستفيد / العميل' : 'Customer / Beneficiary',
      'resolved_date': language === 'ar' ? 'التاريخ' : 'Date',
      'payment_method_name': language === 'ar' ? 'طريقة السداد' : 'Payment Method',
      'resolved_amount': language === 'ar' ? 'المبلغ' : 'Amount',
      'entry_number': language === 'ar' ? 'رقم القيد' : 'Entry No.',
      'description': language === 'ar' ? 'البيان' : 'Description'
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
      notes: '',
      paid_to_type: 'employee',
      paid_to_employee_id: '',
      paid_to_external_name: '',
      currency_id: '',
      exchange_rate: 1
    });
  };

  const handleCopyReceipt = async () => {
    const newRef = await generateInternalRef(voucherData.date);
    setEditingReceipt(null);
    setInternalRef(newRef);
    setVoucherData(prev => ({
      ...prev,
      internal_reference: newRef,
      manual_reference: '',
    }));
    showNotification(
      language === 'ar' 
        ? 'تم نسخ بيانات السند، يمكنك التعديل والحفظ كسند جديد' 
        : 'Receipt data copied, edit and save as a new voucher',
      'info'
    );
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

  const generalCount = receipts.filter(r => getReceiptKind(r) === 'general').length;
  const customerCount = receipts.filter(r => getReceiptKind(r) === 'customer').length;

  const filteredReceipts = receipts.filter(r => {
    const kind = getReceiptKind(r);
    if (typeFilter !== 'all' && kind !== typeFilter) return false;
    const searchLow = searchTerm.toLowerCase();
    return (
      (r.customer_name || '').toLowerCase().includes(searchLow) ||
      (r.voucher_number || '').toLowerCase().includes(searchLow) ||
      (r.internal_reference || '').toLowerCase().includes(searchLow) ||
      (r.manual_reference || '').toLowerCase().includes(searchLow) ||
      (r.description || '').toLowerCase().includes(searchLow) ||
      ((r as any).notes || '').toLowerCase().includes(searchLow)
    );
  });

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
            onPrint={() => printElement(tableRef.current, 'سندات القبض')}
          />
          <button 
            onClick={openNewGeneralReceipt}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-200"
          >
            <Plus size={20} />
            <span>{language === 'ar' ? 'إضافة سند قبض' : 'Add Receipt Voucher'}</span>
          </button>
          <button 
            onClick={openNewCustomerReceipt}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-200"
          >
            <Plus size={20} />
            <span>{language === 'ar' ? 'إضافة قبض من عميل' : 'Add Customer Receipt'}</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden no-pdf">
        <div className="p-4 md:p-6 border-b border-zinc-50 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
            <input
              type="text"
              placeholder={language === 'ar' ? "البحث عن سندات..." : "Search receipts..."}
              className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2.5 bg-zinc-50 border-none rounded-xl focus:ring-2 focus:ring-zinc-900 transition-all text-sm font-medium`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Tabs by Type */}
            <div className="flex items-center bg-zinc-100/90 p-1 rounded-2xl border border-zinc-200/60 shadow-xs">
              <button
                type="button"
                onClick={() => { setTypeFilter('all'); setPage(1); }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  typeFilter === 'all' 
                    ? 'bg-white text-zinc-900 shadow-xs border border-zinc-200/50' 
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                {language === 'ar' ? 'الكل' : 'All'} ({receipts.length})
              </button>
              <button
                type="button"
                onClick={() => { setTypeFilter('general'); setPage(1); }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  typeFilter === 'general' 
                    ? 'bg-emerald-600 text-white shadow-sm' 
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${typeFilter === 'general' ? 'bg-white' : 'bg-emerald-500'}`} />
                <span>{language === 'ar' ? 'سند قبض' : 'Receipt Voucher'}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${typeFilter === 'general' ? 'bg-emerald-700/60 text-white' : 'bg-zinc-200 text-zinc-700'}`}>
                  {generalCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => { setTypeFilter('customer'); setPage(1); }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  typeFilter === 'customer' 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${typeFilter === 'customer' ? 'bg-white' : 'bg-blue-500'}`} />
                <span>{language === 'ar' ? 'قبض من عميل' : 'Customer Receipt'}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${typeFilter === 'customer' ? 'bg-blue-700/60 text-white' : 'bg-zinc-200 text-zinc-700'}`}>
                  {customerCount}
                </span>
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="flex bg-zinc-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setView('table')}
                className={`p-2 rounded-lg transition-all ${view === 'table' ? 'bg-white text-emerald-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                title={language === 'ar' ? 'عرض الجدول' : 'Table View'}
              >
                <List size={18} />
              </button>
              <button
                type="button"
                onClick={() => setView('card')}
                className={`p-2 rounded-lg transition-all ${view === 'card' ? 'bg-white text-emerald-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                title={language === 'ar' ? 'عرض الكروت' : 'Card View'}
              >
                <LayoutGrid size={18} />
              </button>
            </div>
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
                  <th className="px-6 py-4 font-bold">{language === 'ar' ? 'النوع' : 'Type'}</th>
                  <th className="px-6 py-4 font-bold">{language === 'ar' ? 'المستفيد / العميل' : 'Customer / Beneficiary'}</th>
                  <th className="px-6 py-4 font-bold cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('date')}>
                    <div className="flex items-center gap-1">
                      التاريخ
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {sortBy === 'date' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className="px-6 py-4 font-bold">{language === 'ar' ? 'طريقة السداد' : 'Payment Method'}</th>
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
                    <td className="px-6 py-4">
                      {getReceiptKind(receipt) === 'customer' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          {language === 'ar' ? 'قبض من عميل' : 'Customer Receipt'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {language === 'ar' ? 'سند قبض' : 'Receipt Voucher'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-bold text-zinc-900">{receipt.customer_name || '---'}</td>
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
                          title="معاينة السند"
                        >
                          <Eye size={18} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            printOfficialReceipt(receipt);
                          }}
                          className="p-2 text-zinc-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all"
                          title="طباعة السند الرسمي"
                        >
                          <Printer size={18} />
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
                    <td colSpan={7} className="px-6 py-12 text-center text-zinc-500 italic">{language === 'ar' ? 'لا توجد سندات قبض.' : 'No receipt vouchers.'}</td>
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
                    title="معاينة السند"
                  >
                    <Eye size={16} />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      printOfficialReceipt(receipt);
                    }}
                    className="p-2 bg-white text-teal-600 rounded-xl border border-teal-50 shadow-sm hover:bg-teal-50 transition-all font-bold"
                    title="طباعة السند الرسمي"
                  >
                    <Printer size={16} />
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
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] bg-white px-2 py-1 rounded text-emerald-700 font-bold w-fit border border-emerald-100">{receipt.voucher_number}</span>
                      {getReceiptKind(receipt) === 'customer' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          قبض من عميل
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          سند قبض
                        </span>
                      )}
                    </div>
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
    <div ref={editModalRef} className="bg-white rounded-3xl border border-zinc-200 shadow-md overflow-hidden animate-in slide-in-from-bottom-4 duration-300 flex flex-col min-h-[80vh] relative">
          {/* Form Header */}
          <div className="p-4 md:p-6 border-b border-zinc-100 flex flex-wrap items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-[70] gap-3">
            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={closeModal} 
                className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border border-zinc-200 shadow-xs cursor-pointer"
                title={language === 'ar' ? 'إلغاء (إغلاق)' : 'Cancel (Close)'}
              >
                <X size={20} />
              </button>

              <button 
                type="button"
                onClick={closeModal} 
                className="flex items-center gap-2 px-3.5 py-2 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all font-bold text-xs border border-zinc-200 cursor-pointer"
              >
                {dir === 'rtl' ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                <span>{language === 'ar' ? 'العودة للقائمة' : 'Back to list'}</span>
              </button>
            </div>

            <div className="flex-1 flex flex-wrap justify-center items-center gap-2">
              {/* Save Button Top */}
              <button 
                type="submit"
                form="receipt-form"
                disabled={isSubmitting || voucherData.items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) <= 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                <span>{editingReceipt ? (language === 'ar' ? 'حفظ التعديلات' : 'Save Changes') : (language === 'ar' ? 'حفظ السند' : 'Save Voucher')}</span>
              </button>

              {/* Copy Button */}
              <button 
                type="button"
                onClick={handleCopyReceipt}
                className="flex items-center gap-1.5 px-3.5 py-2 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all font-bold text-xs border border-indigo-200 shadow-xs cursor-pointer"
                title={language === 'ar' ? 'نسخ السند' : 'Copy Voucher'}
              >
                <Copy size={15} />
                <span>{language === 'ar' ? 'نسخ' : 'Copy'}</span>
              </button>

              <button 
                type="button"
                onClick={() => setShowSidePanel(!showSidePanel)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border shadow-xs cursor-pointer ${showSidePanel ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'}`}
              >
                <History size={16} />
                <span>{language === 'ar' ? 'قيد اليومية \\ سجل التعديلات' : 'Journal / Activity Log'}</span>
              </button>

              {/* Print, PDF, Excel Buttons */}
              <button 
                type="button"
                onClick={() => printOfficialReceipt(editingReceipt || voucherData)}
                className="flex items-center gap-1.5 px-3 py-2 text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-xl transition-all font-bold text-xs border border-teal-200 shadow-xs cursor-pointer active:scale-95"
                title={language === 'ar' ? 'طباعة السند الرسمي' : 'Print Voucher'}
              >
                <Printer size={14} />
                <span>{language === 'ar' ? 'طباعة السند' : 'Print'}</span>
              </button>

              <button 
                type="button"
                onClick={() => printOfficialReceipt(editingReceipt || voucherData)}
                className="flex items-center gap-1.5 px-3 py-2 text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-all font-bold text-xs border border-rose-200 shadow-xs cursor-pointer active:scale-95"
                title={language === 'ar' ? 'تصدير PDF' : 'Export PDF'}
              >
                <FileText size={14} />
                <span>PDF</span>
              </button>

              <button 
                type="button"
                onClick={() => {
                  const pm = paymentMethods.find(p => p.id === voucherData.payment_method_id);
                  let partyName = '-';
                  if (voucherData.customer_id) {
                    const cust = customers.find(c => c.id === voucherData.customer_id);
                    partyName = cust?.name || 'عميل';
                  } else if (voucherData.supplier_id) {
                    const sup = suppliers.find(s => s.id === voucherData.supplier_id);
                    partyName = sup?.name || 'مورد';
                  }

                  const rawItems = (voucherData.items && voucherData.items.length > 0)
                    ? voucherData.items
                    : [{ account_name: partyName, amount: voucherData.amount, description: voucherData.notes || '-' }];

                  exportSingleDocumentToExcel({
                    filename: `Receipt_Voucher_${editingReceipt?.voucher_number || (voucherData as any).voucher_number || 'Doc'}`,
                    sheetName: 'سند قبض',
                    companyName: companyData?.name || localStorage.getItem('company_name') || 'نظام ERP السحابي',
                    companyAddress: companyData?.address || localStorage.getItem('company_address') || '',
                    companyPhone: companyData?.phone || localStorage.getItem('company_phone') || '',
                    companyEmail: companyData?.email || localStorage.getItem('company_email') || '',
                    companyTaxNumber: companyData?.tax_number || localStorage.getItem('company_tax') || '',
                    docTitle: 'سند قبض نقدية / بنك',
                    docNumber: editingReceipt?.voucher_number || (voucherData as any).voucher_number || 'جديد',
                    docDate: voucherData.date || new Date().toISOString().slice(0, 10),
                    partyTitle: 'الجهة / المستلم منه',
                    partyName,
                    paymentMethod: pm?.name || 'نقداً',
                    notes: voucherData.notes || '',

                    columns: [
                      { label: 'م', key: 'index' },
                      { label: 'الحساب / البيان', key: 'account_name' },
                      { label: 'الوصف / الشرح', key: 'description' },
                      { label: 'المبلغ', key: 'amount' }
                    ],
                    items: rawItems.map(item => ({
                      account_name: item.account_name || partyName,
                      description: item.description || voucherData.notes || '-',
                      amount: item.amount || 0
                    })),
                    summaryRows: [
                      { label: 'إجمالي المبلغ المقبوض:', value: voucherData.amount }
                    ]
                  });
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-all font-bold text-xs border border-emerald-200 shadow-xs cursor-pointer"
                title={language === 'ar' ? 'تصدير Excel' : 'Export Excel'}
              >
                <FileSpreadsheet size={14} />
                <span>Excel</span>
              </button>
            </div>

            <div className="flex items-center gap-4">
              {editingReceipt && (
                <div className="hidden lg:flex items-center gap-2 bg-zinc-100 p-1.5 rounded-2xl">
                  <button 
                    type="button"
                    onClick={handlePrevReceipt}
                    className="flex items-center gap-1 px-3 py-1.5 hover:bg-white rounded-xl transition-all text-zinc-600 disabled:opacity-30 text-xs font-black cursor-pointer"
                    disabled={receipts.findIndex(r => r.id === editingReceipt.id) === 0}
                  >
                    {dir === 'rtl' ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    {language === 'ar' ? 'السابق' : 'Prev'}
                  </button>
                  <button 
                    type="button"
                    onClick={handleNextReceipt}
                    className="flex items-center gap-1 px-3 py-1.5 hover:bg-white rounded-xl transition-all text-zinc-600 disabled:opacity-30 text-xs font-black cursor-pointer"
                    disabled={receipts.findIndex(r => r.id === editingReceipt.id) === receipts.length - 1}
                  >
                    {language === 'ar' ? 'التالي' : 'Next'}
                    {dir === 'rtl' ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                  </button>
                </div>
              )}
              <h3 className="text-xl md:text-2xl font-black text-zinc-900 tracking-tight">
                {editingReceipt 
                  ? (modalMode === 'customer' ? (language === 'ar' ? 'تعديل سند قبض من عميل' : 'Edit Customer Receipt') : (language === 'ar' ? 'تعديل سند القبض' : t('receipts.edit'))) 
                  : (modalMode === 'customer' ? (language === 'ar' ? 'إضافة سند قبض من عميل' : 'Add Customer Receipt') : (language === 'ar' ? 'إضافة سند قبض جديد' : t('receipts.add')))}
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

            {/* Floating button on the side to toggle AI Smart Creation */}
            <button
              type="button"
              onClick={() => setShowAiInput(!showAiInput)}
              className={`absolute ${dir === 'rtl' ? 'left-0 rounded-r-xl border-l-0' : 'right-0 rounded-l-xl border-r-0'} top-1/4 z-[60] flex items-center gap-2 px-2 py-3 bg-indigo-600 text-white font-black text-[10px] shadow-lg hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all [writing-mode:vertical-lr] border border-indigo-500 ${showAiInput ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
              style={{ direction: 'ltr' }}
            >
              <Sparkles size={12} className="animate-bounce mb-1" />
              <span>{language === 'ar' ? 'الإنشاء الذكي بالذكاء الاصطناعي' : 'Smart AI Creation'}</span>
            </button>

            {/* AI Drawer (Smart Creation) sliding from the side */}
            <AnimatePresence>
              {showAiInput && (
                <motion.div 
                  initial={{ x: dir === 'rtl' ? '-100%' : '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: dir === 'rtl' ? '-100%' : '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  className={`absolute inset-y-0 ${dir === 'rtl' ? 'left-0' : 'right-0'} z-50 w-full lg:w-[480px] shadow-2xl border-l border-slate-100 bg-white flex flex-col`}
                >
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-indigo-600 font-bold">
                      <Sparkles size={20} className="animate-pulse" />
                      <span className="text-sm font-black">{language === 'ar' ? 'الإنشاء الذكي بالذكاء الاصطناعي' : 'Smart AI Creation'}</span>
                    </div>
                    <button onClick={() => setShowAiInput(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-all">
                      <X size={20} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
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
                        setShowAiInput(false);
                      }}
                      transactionType="receipt_voucher"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <form id="receipt-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 pb-32 md:pb-8">
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-3 space-y-6">
                  {/* Card 1: Basic Info */}
                  <section className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm space-y-6 relative pt-12">
                    <div className="absolute top-4 right-4 flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                      <FileText className="w-4 h-4" />
                      <span className="text-xs font-bold">{language === 'ar' ? 'البيانات الأساسية' : 'Basic Info'}</span>
                    </div>

                    {/* Total Amount & Tafqeet Banner */}
                    {(() => {
                      const totalAmount = voucherData.items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
                      const currencyCode = (companyData?.settings?.currency || (companyData as any)?.currency || 'EGP').toUpperCase();
                      const tafqeetText = tafqeet(totalAmount, currencyCode, language === 'ar' ? 'ar' : 'en');

                      return (
                        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 p-4 rounded-2xl border border-emerald-100/80 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs">
                          <div className="flex items-center gap-3">
                            <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-md">
                              <Wallet className="w-6 h-6" />
                            </div>
                            <div>
                              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">{language === 'ar' ? 'إجمالي مبلغ السند' : 'Total Amount'}</span>
                              <div className="flex items-baseline gap-2">
                                <span className="text-2xl md:text-3xl font-black text-emerald-700 font-mono tracking-tight">
                                  {formatNumber(totalAmount)}
                                </span>
                                <span className="text-sm font-black text-emerald-800 bg-white px-2.5 py-0.5 rounded-lg border border-emerald-200 shadow-xs">
                                  {currencyCode}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right bg-white/90 backdrop-blur-sm px-4 py-2.5 rounded-xl border border-emerald-100/80 shadow-xs flex-1 max-w-lg">
                            <span className="text-[11px] font-bold text-zinc-400 block mb-0.5 uppercase">{language === 'ar' ? 'المبلغ بالحروف (التفقيط)' : 'Amount in Words'}</span>
                            <span className="text-xs font-black text-emerald-900 italic">{tafqeetText}</span>
                          </div>
                        </div>
                      );
                    })()}
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">{language === 'ar' ? 'مرجع البرنامج' : 'System Ref'}</label>
                        <div className="relative">
                          <Hash className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                          <input 
                            readOnly
                            type="text" 
                            className={`w-full ${dir === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3 bg-zinc-100 border border-zinc-200 cursor-not-allowed rounded-2xl font-bold text-zinc-500 text-sm outline-none font-mono`}
                            value={editingReceipt ? voucherData.internal_reference : (internalRef || voucherData.internal_reference)}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">{language === 'ar' ? 'مرجع يدوي / آخر' : 'Manual / Other Ref'}</label>
                        <div className="relative group">
                          <FileText className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                          <input 
                            type="text" 
                            placeholder={language === 'ar' ? 'ادخل رقم المرجع اليدوي...' : 'Enter manual reference...'}
                            className={`w-full ${dir === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-zinc-800 text-sm`}
                            value={voucherData.manual_reference}
                            onChange={(e) => setVoucherData({...voucherData, manual_reference: e.target.value})}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">{language === 'ar' ? 'تاريخ السند' : 'Voucher Date'}</label>
                        <div className="relative">
                          <Calendar className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                          <input 
                            required
                            type="date"
                            className={`w-full ${dir === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-zinc-800 text-sm`}
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
                              className={`w-full ${dir === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3 bg-emerald-50 border border-emerald-200 rounded-2xl outline-none transition-all font-bold text-emerald-800 text-sm font-mono`}
                              value={editingReceipt.entry_number}
                            />
                          </div>
                        </div>
                      )}

                      {/* Payment Method */}
                      <div>
                        <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">{language === 'ar' ? 'طريقة القبض (إلى خزينة/بنك)' : 'Payment Method (To Safe/Bank)'}</label>
                        <div className="relative group">
                          <CreditCard className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                          <select 
                            required
                            className={`w-full ${dir === 'rtl' ? 'pr-12 pl-10' : 'pl-12 pr-10'} py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-zinc-800 appearance-none text-sm cursor-pointer`}
                            value={voucherData.payment_method_id}
                            onChange={(e) => {
                              if (e.target.value === 'new_payment_method') {
                                setIsPaymentMethodModalOpen(true);
                              } else {
                                setVoucherData({...voucherData, payment_method_id: e.target.value});
                              }
                            }}
                          >
                            <option value="">{language === 'ar' ? 'اختر طريقة القبض...' : 'Select payment method...'}</option>
                            {paymentMethods.map(pm => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
                            <option value="new_payment_method" className="font-bold text-emerald-600">+ {language === 'ar' ? 'إضافة طريقة دفع جديدة...' : 'Add New Payment Method...'}</option>
                          </select>
                          <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                        </div>
                      </div>

                      {/* Currency & Exchange Rate Selection */}
                      <div>
                        <div className="flex items-center justify-between mb-2 px-2">
                          <label className="block text-xs font-bold text-zinc-400 tracking-tighter uppercase">
                            {language === 'ar' ? 'العملة وسعر الصرف' : 'Currency & Exchange Rate'}
                          </label>
                          {voucherData.currency_id && (
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${exchangeRateType === 'auto' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                              {exchangeRateType === 'auto' 
                                ? (language === 'ar' ? 'سعر تلقائي' : 'Auto Rate') 
                                : (language === 'ar' ? 'سعر يدوي' : 'Manual Rate')}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="relative">
                            <Coins className={`absolute ${dir === 'rtl' ? 'right-3.5' : 'left-3.5'} top-3.5 w-4 h-4 text-zinc-400 pointer-events-none`} />
                            <select 
                              className={`w-full ${dir === 'rtl' ? 'pr-10 pl-8' : 'pl-10 pr-8'} py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-zinc-800 text-xs appearance-none cursor-pointer`}
                              value={voucherData.currency_id}
                              onChange={(e) => handleCurrencyChange(e.target.value)}
                            >
                              <option value="">
                                {language === 'ar' 
                                  ? `عملة الشركة الافتراضية (${(companyData?.settings?.currency || (companyData as any)?.currency || 'EGP').toUpperCase()})` 
                                  : `Company Base Currency (${(companyData?.settings?.currency || (companyData as any)?.currency || 'EGP').toUpperCase()})`}
                              </option>
                              {companyCurrencies.map(curr => (
                                <option key={curr.id} value={curr.id}>{curr.code} - {language === 'ar' ? curr.name_ar : curr.name_en}</option>
                              ))}
                            </select>
                            <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-3' : 'right-3'} top-3.5 w-4 h-4 text-zinc-400 pointer-events-none`} />
                          </div>
                          <div className="relative">
                            <DollarSign className={`absolute ${dir === 'rtl' ? 'right-3.5' : 'left-3.5'} top-3.5 w-4 h-4 text-zinc-400 pointer-events-none`} />
                            <input 
                              type="number"
                              step="any"
                              placeholder={language === 'ar' ? 'سعر الصرف' : 'Exchange Rate'}
                              className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-zinc-800 text-xs`}
                              value={voucherData.exchange_rate}
                              onChange={(e) => {
                                setVoucherData({ ...voucherData, exchange_rate: Number(e.target.value) || 1 });
                                setExchangeRateType('manual');
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Received By (يقبض بواسطة / المحصل): Employee / External Party Selection */}
                      <div className="md:col-span-3 bg-zinc-50/70 p-4 rounded-2xl border border-zinc-200/80 space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-2">
                            <User className="w-4 h-4 text-emerald-600" />
                            <span>{language === 'ar' ? 'المحصل / يقبض بواسطة:' : 'Collector / Received By:'}</span>
                          </label>

                          <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-zinc-200">
                            <button
                              type="button"
                              onClick={() => setVoucherData({ ...voucherData, paid_to_type: 'employee', paid_to_external_name: '' })}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${voucherData.paid_to_type === 'employee' ? 'bg-emerald-600 text-white shadow-xs' : 'text-zinc-600 hover:bg-zinc-100'}`}
                            >
                              {language === 'ar' ? 'موظف' : 'Employee'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setVoucherData({ ...voucherData, paid_to_type: 'external', paid_to_employee_id: '' })}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${voucherData.paid_to_type === 'external' ? 'bg-emerald-600 text-white shadow-xs' : 'text-zinc-600 hover:bg-zinc-100'}`}
                            >
                              {language === 'ar' ? 'جهة خارجية' : 'External Party'}
                            </button>
                          </div>
                        </div>

                        {voucherData.paid_to_type === 'employee' ? (
                          <div className="relative">
                            <User className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                            <select
                              className={`w-full ${dir === 'rtl' ? 'pr-12 pl-10' : 'pl-12 pr-10'} py-3 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-zinc-800 text-sm appearance-none cursor-pointer`}
                              value={voucherData.paid_to_employee_id}
                              onChange={(e) => setVoucherData({ ...voucherData, paid_to_employee_id: e.target.value })}
                            >
                              <option value="">{language === 'ar' ? 'اختر المحصل من قائمة الموظفين...' : 'Select employee from employees list...'}</option>
                              {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>
                                  {emp.name} ({emp.employee_code || emp.id.slice(0, 6)})
                                </option>
                              ))}
                            </select>
                            <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                          </div>
                        ) : (
                          <div className="relative">
                            <Globe className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                            <input
                              type="text"
                              required={voucherData.paid_to_type === 'external'}
                              placeholder={language === 'ar' ? 'كتابة اسم المستلم / الجهة الخارجية...' : 'Write collector/external party name...'}
                              className={`w-full ${dir === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-zinc-800 text-sm`}
                              value={voucherData.paid_to_external_name}
                              onChange={(e) => setVoucherData({ ...voucherData, paid_to_external_name: e.target.value })}
                            />
                          </div>
                        )}
                      </div>

                      {/* General Description / Additional Notes inside Basic Info */}
                      <div className="md:col-span-3">
                        <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">{language === 'ar' ? 'البيان العام / ملاحظات إضافية' : 'General Description / Additional Notes'}</label>
                        <textarea 
                          rows={3}
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-3xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none font-bold text-sm text-zinc-800"
                          placeholder={language === 'ar' ? "اكتب بيان/ملاحظات السند هنا..." : "Write voucher notes/description here..."}
                          value={voucherData.notes}
                          onChange={(e) => setVoucherData({...voucherData, notes: e.target.value})}
                        />
                      </div>
                    </div>
                  </section>

                  {/* Card 2: Receipt Items */}
                  <section className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm space-y-6 relative pt-12">
                    <div className="absolute top-4 right-4 flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                      <Layers className="w-4 h-4" />
                      <span className="text-xs font-bold">{language === 'ar' ? 'بنود القبض' : 'Receipt Items'}</span>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                        <h4 className="font-bold text-zinc-900 italic tracking-tight uppercase text-sm">{language === 'ar' ? 'تفاصيل البنود' : 'Item Details'}</h4>
                        <button 
                          type="button"
                          onClick={() => setVoucherData({
                            ...voucherData,
                            items: [...voucherData.items, { type: modalMode === 'customer' ? 'customer' : 'customer', entity_id: '', amount: 0, description: '' }]
                          })}
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-black border border-emerald-100 hover:bg-emerald-100 transition-all shadow-sm"
                        >
                          <Plus size={16} />
                          <span>{language === 'ar' ? 'إضافة بند قبض جديد' : 'Add New Item'}</span>
                        </button>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className={`text-zinc-500 text-[10px] uppercase font-black tracking-widest ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                              <th className="px-2 py-3 w-32 tracking-tighter">{language === 'ar' ? 'النوع' : 'Type'}</th>
                              <th className="px-2 py-3 tracking-tighter">{language === 'ar' ? 'المقبوض منه / الحساب' : 'Received From / Account'}</th>
                              <th className="px-2 py-3 w-32 tracking-tighter uppercase tracking-widest">{t('common.amount')}</th>
                              <th className="px-2 py-3 tracking-tighter uppercase tracking-widest">{t('common.description')}</th>
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
                                      disabled={modalMode === 'customer'}
                                      value={modalMode === 'customer' ? 'customer' : item.type}
                                      onChange={(e) => {
                                        const newItems = [...voucherData.items];
                                        newItems[idx].type = e.target.value;
                                        newItems[idx].entity_id = '';
                                        newItems[idx].settlements = [];
                                        newItems[idx].amount = 0;
                                        setVoucherData({...voucherData, items: newItems});
                                      }}
                                    >
                                      {modalMode === 'customer' ? (
                                        <option value="customer">{t('discounts.column_customer')}</option>
                                      ) : (
                                        <>
                                          <option value="customer">{t('discounts.column_customer')}</option>
                                          <option value="supplier">{t('discounts.column_supplier')}</option>
                                          <option value="expense">{language === 'ar' ? 'بند إيراد / مصروف' : 'Revenue / Expense'}</option>
                                          <option value="account">{language === 'ar' ? 'حساب عام' : 'General Ledger Account'}</option>
                                        </>
                                      )}
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
                                      <option value="">{language === 'ar' ? 'اختر...' : 'Select...'}</option>
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
                                        <option value="">{language === 'ar' ? 'اختر الحساب الفرعي...' : 'Select Sub-account...'}</option>
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
                                      placeholder={language === 'ar' ? 'بيان تفصيلي...' : 'Detailed statement...'}
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
                                              <span className="font-bold text-zinc-400">{language === 'ar' ? 'رقم التسوية:' : 'Settlement No.:'}</span>
                                              <span className="font-mono bg-zinc-100 px-2.5 py-1 rounded-lg text-zinc-600 font-bold border border-zinc-200">
                                                {item.settlement_number || '-'}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <span className="font-bold text-zinc-400">{language === 'ar' ? 'تاريخ التسوية:' : 'Settlement Date:'}</span>
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
                                              const uniqueSettlements = getUniqueSettlementsForVoucherItem(item, idx);
                                              const totalSettled = uniqueSettlements.reduce((sum: number, s: any) => sum + s.settled_amount, 0);
                                              const difference = (item.amount || 0) - totalSettled;
                                              return (
                                                <div className="flex flex-wrap items-center gap-4 text-xs font-bold">
                                                  <div className="flex items-center gap-1.5">
                                                    <span className="text-zinc-400">{language === 'ar' ? 'إجمالي المسوى:' : 'Total Settled:'}</span>
                                                    <span className="text-emerald-600 font-mono font-black bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">{formatNumber(totalSettled)} {t('common.currency')}</span>
                                                  </div>
                                                  <div className="flex items-center gap-1.5">
                                                    <span className="text-zinc-400">{language === 'ar' ? 'الفرق:' : 'Difference:'}</span>
                                                    <span className={`font-mono font-black px-2.5 py-1 rounded-lg border ${difference === 0 ? 'text-zinc-600 bg-zinc-50 border-zinc-200' : difference > 0 ? 'text-blue-600 bg-blue-50 border-blue-100' : 'text-red-600 bg-red-50 border-red-100'}`}>
                                                      {formatNumber(difference)} {t('common.currency')}
                                                    </span>
                                                  </div>
                                                </div>
                                              );
                                            })()}
                                          </div>

                                          {/* Invoices and settlements list */}
                                          {openTransactions.length === 0 ? (
                                            <div className="text-center py-6 text-zinc-400 text-xs font-bold">
                                              {language === 'ar' ? 'لا توجد فواتير أو حركات مفتوحة لهذا الحساب' : 'No open invoices or transactions found'}
                                            </div>
                                          ) : (
                                            <div className="overflow-x-auto">
                                              <table className="w-full text-xs">
                                                <thead>
                                                  <tr className="text-zinc-400 border-b border-zinc-100 text-[11px] font-bold">
                                                    <th className="py-2 text-right">رقم القيد</th>
                                                    <th className="py-2 text-right">نوع الحركة</th>
                                                    <th className="py-2 text-right">رقم الفاتورة / المرجع</th>
                                                    <th className="py-2 text-right">التاريخ</th>
                                                    <th className="py-2 text-center">رقم التسوية</th>
                                                    <th className="py-2 text-center">تاريخ التسوية</th>
                                                    <th className="py-2 text-right">القيمة الأصلية</th>
                                                    <th className="py-2 text-right">المبلغ المفتوح</th>
                                                    <th className="py-2 text-center">تسوية بالكامل</th>
                                                    <th className="py-2 text-center">تسوية بقيمة السند</th>
                                                    <th className="py-2 text-center w-28">المبلغ المسوى</th>
                                                  </tr>
                                                </thead>
                                                <tbody className="divide-y divide-zinc-50">
                                                  {openTransactions.map(t => {
                                                    const uniqueSettlements = getUniqueSettlementsForVoucherItem(item, idx);
                                                    const settlement = uniqueSettlements.find((s: any) => s.target_id === t.id);
                                                    const settledAmount = settlement ? settlement.settled_amount : 0;
                                                    const otherSettlementsTotal = uniqueSettlements
                                                      .filter((s: any) => s.target_id !== t.id)
                                                      .reduce((sum: number, s: any) => sum + s.settled_amount, 0);
                                                    const remainingVoucherAmount = Math.max(0, (item.amount || 0) - otherSettlementsTotal);
                                                    const maxAllocation = Math.min(t.open_amount, remainingVoucherAmount);
                                                    const maxAllowed = Math.min(t.open_amount, remainingVoucherAmount + settledAmount);

                                                    const isFullySettled = settledAmount === t.open_amount && t.open_amount > 0;
                                                    const isVoucherAmountSettled = settledAmount === maxAllocation && maxAllocation > 0;

                                                    return (
                                                      <tr key={t.id} className="hover:bg-zinc-50/50">
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
                                                            disabled={remainingVoucherAmount < t.open_amount && !isFullySettled}
                                                            checked={isFullySettled}
                                                            onChange={(e) => {
                                                              const checked = e.target.checked;
                                                              handleSettlementChange(idx, t, checked ? t.open_amount : 0);
                                                            }}
                                                          />
                                                        </td>
                                                        <td className="py-2.5 text-center">
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
                                                        </td>
                                                        <td className="py-2.5 text-center">
                                                          <input
                                                            type="number"
                                                            step="any"
                                                            className="w-full px-2 py-1 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-black text-center text-emerald-600 outline-none focus:ring-2 focus:ring-emerald-500"
                                                            placeholder="0"
                                                            value={settledAmount || ''}
                                                            max={maxAllowed}
                                                            onChange={(e) => {
                                                              const val = Number(e.target.value);
                                                              const cappedVal = Math.min(Math.max(0, val), maxAllowed);
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
                </div>
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
                  onClick={() => {
                    if (viewReceipt) {
                      printDocument('receipt_vouchers', viewReceipt.id);
                    }
                  }}
                  className="p-2 text-zinc-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                  title="طباعة وتصدير بالنموذج"
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
                                          <span>
                                            تسويات البند (رقم التسوية: {' '}
                                            {item.settlement_number && item.settlement_number !== '-' ? (
                                              <span
                                                onClick={() => {
                                                  setPendingViewDoc({ type: 'settlement', idOrNumber: item.settlement_number });
                                                  setCurrentPage('customer_settlements');
                                                }}
                                                className="text-indigo-600 hover:text-indigo-700 hover:underline cursor-pointer font-bold font-mono transition-colors"
                                              >
                                                {item.settlement_number}
                                              </span>
                                            ) : (
                                              '-'
                                            )}
                                            {' '} - تاريخ التسوية: {item.settlement_date ? formatDate(item.settlement_date) : ''})
                                          </span>
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
                      {accounts.filter(a => a.account_usage === "accounts_receivable" || a.account_usage === "customer").map(account => (
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
                        {accounts.filter(a => ["opening_balance", "capital", "equity", "retained_earnings", "other"].includes(a.account_usage || "")).map(account => (
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
                      {accounts.filter(a => ["cash", "main_cash", "petty_cash", "bank", "credit_card", "debit_card", "cheque", "post_dated_cheque", "wallet"].includes(a.account_usage || "")).map(account => (
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
                        {accounts.filter(a => ["opening_balance", "capital", "equity", "retained_earnings", "other"].includes(a.account_usage || "")).map(account => (
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
            <p className="text-zinc-500 mb-6">{language === 'ar' ? 'هل أنت متأكد من رغبتك في حذف هذا السند؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to delete this voucher? This action cannot be undone.'}</p>
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

      {/* View & Print Receipt Modal (Matching the classic/modern Voucher design) */}
      {viewReceipt && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 md:p-6 bg-zinc-900/60 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col my-auto border border-zinc-100">
            {/* Top Toolbar */}
            <div className="p-4 md:px-6 md:py-4 bg-zinc-50 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-3 no-print">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-emerald-100 text-emerald-700 rounded-xl font-bold">
                  <ReceiptIcon size={20} />
                </span>
                <div>
                  <h3 className="font-bold text-zinc-900 text-base">
                    {getReceiptKind(viewReceipt) === 'customer' ? 'معاينة سند قبض من عميل' : 'معاينة إيصال قبض نقدية'}
                  </h3>
                  <span className="text-xs font-mono text-zinc-500">{viewReceipt.internal_reference || viewReceipt.voucher_number}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => printOfficialReceipt(viewReceipt)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
                >
                  <Printer size={15} />
                  <span>طباعة</span>
                </button>

                <button
                  onClick={() => printOfficialReceipt(viewReceipt)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold text-xs transition-all active:scale-95 cursor-pointer"
                >
                  <FileText size={15} />
                  <span>PDF</span>
                </button>

                <button
                  onClick={() => {
                    const target = viewReceipt;
                    setViewReceipt(null);
                    openEditModal(target);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl font-bold text-xs transition-all active:scale-95 cursor-pointer"
                >
                  <Pencil size={15} />
                  <span>تعديل</span>
                </button>

                <button
                  onClick={() => setViewReceipt(null)}
                  className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200 rounded-xl transition-all"
                  title="إغلاق"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Printable Voucher Paper */}
            <div className="p-4 md:p-8 bg-zinc-100/50 flex justify-center overflow-x-auto">
              <div 
                id="receipt-voucher-printable-area" 
                className="bg-white w-full max-w-3xl p-6 md:p-10 rounded-2xl shadow-sm border border-zinc-200 text-zinc-900 relative overflow-hidden font-sans"
                dir="rtl"
                style={{ minHeight: '480px' }}
              >
                {/* Decorative Top-Left Artistic Curves and Brand Logo */}
                <div className="absolute -top-12 -left-12 w-44 h-44 rounded-full bg-teal-500/15 pointer-events-none" />
                <div className="absolute -top-6 -left-6 w-32 h-32 rounded-full bg-teal-500/25 pointer-events-none flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-teal-600/30 border-2 border-teal-500/40 flex items-center justify-center text-teal-800 font-bold text-xs">
                    {(companyData?.logo_url || (companyData as any)?.logo) ? (
                      <img src={companyData?.logo_url || (companyData as any)?.logo} alt="Logo" className="w-16 h-16 rounded-full object-contain" />
                    ) : (
                      <span>{companyData?.name?.slice(0, 10) || 'شعارك'}</span>
                    )}
                  </div>
                </div>

                {/* Decorative background arc lines */}
                <svg className="absolute top-2 left-20 w-28 h-28 opacity-20 pointer-events-none" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#0d9488" strokeWidth="2" strokeDasharray="4 2" />
                  <circle cx="50" cy="50" r="30" fill="none" stroke="#0d9488" strokeWidth="2" />
                  <circle cx="50" cy="50" r="20" fill="none" stroke="#0d9488" strokeWidth="1.5" strokeDasharray="3 3" />
                </svg>

                {/* Voucher Header */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b-2 border-teal-600/30 pb-5 mb-6">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-black text-teal-700 tracking-tight flex items-center gap-2">
                      {getReceiptKind(viewReceipt) === 'customer' ? 'سند قبض من عميل' : 'إيصال قبض نقدية'}
                    </h1>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-600 font-bold">
                      <span className="bg-teal-50 text-teal-800 px-2.5 py-1 rounded-lg border border-teal-200 font-mono font-black">
                        رقم: {viewReceipt.internal_reference || viewReceipt.voucher_number}
                      </span>
                      {viewReceipt.manual_reference && (
                        <span className="text-zinc-500 font-mono">
                          (مرجع يدوي: {viewReceipt.manual_reference})
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-start md:items-end gap-1.5">
                    <div className="flex items-center gap-2 text-sm font-black text-zinc-800">
                      <span>التاريخ :</span>
                      <span className="font-mono bg-zinc-50 px-2 py-0.5 rounded border border-zinc-200">{formatDate(viewReceipt.date)} م</span>
                    </div>
                    {/* Amount Box */}
                    <div className="mt-1 bg-gradient-to-r from-teal-600 to-emerald-600 text-white px-4 py-2 rounded-xl shadow-sm flex items-center gap-2">
                      <span className="text-xs font-bold">المبلغ:</span>
                      <span className="text-lg md:text-xl font-black font-mono tracking-tight">
                        {formatNumber(viewReceipt.amount)}
                      </span>
                      <span className="text-xs font-bold bg-white/20 px-1.5 py-0.5 rounded">
                        {(companyData?.settings?.currency || 'EGP').toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Voucher Formal Dotted Lines Body */}
                {(() => {
                  let payerName = '---';
                  if (viewReceipt.items && viewReceipt.items.length > 0) {
                    const names = viewReceipt.items.map((it: any) => {
                      if (it.type === 'customer') return customers.find(c => c.id === it.entity_id)?.name || 'عميل';
                      if (it.type === 'supplier') return suppliers.find(s => s.id === it.entity_id)?.name || 'مورد';
                      if (it.type === 'expense') return categories.find(c => c.id === it.entity_id)?.name || 'مصروف';
                      return accounts.find(a => a.id === it.entity_id)?.name || 'حساب';
                    });
                    payerName = names.join(' ، ');
                  } else if (viewReceipt.customer_name || viewReceipt.customer_id) {
                    payerName = viewReceipt.customer_name || customers.find(c => c.id === viewReceipt.customer_id)?.name || 'عميل';
                  }

                  const currencyCode = (companyData?.settings?.currency || 'EGP').toUpperCase();
                  const tafqeetText = tafqeet(Number(viewReceipt.amount) || 0, currencyCode, 'ar');
                  const pmName = viewReceipt.payment_method_name || paymentMethods.find(p => p.id === viewReceipt.payment_method_id)?.name || 'نقداً';
                  const voucherDesc = viewReceipt.description || (viewReceipt as any).notes || 'سند قبض نقدية';

                  return (
                    <div className="space-y-6 my-6 text-zinc-900">
                      {/* Row 1: استلمنا من السيد / السادة */}
                      <div className="flex items-baseline gap-3">
                        <span className="font-black text-teal-900 text-base md:text-lg shrink-0 w-44">
                          استلمنا من السيد / السادة :
                        </span>
                        <div className="flex-1 border-b-2 border-dotted border-teal-700/40 pb-1 px-2 font-bold text-zinc-900 text-base md:text-lg bg-teal-50/20 rounded">
                          {payerName}
                        </div>
                      </div>

                      {/* Row 2: مبلغ وقدره */}
                      <div className="flex items-baseline gap-3">
                        <span className="font-black text-teal-900 text-base md:text-lg shrink-0 w-44">
                          مبلــــغ وقــــدره :
                        </span>
                        <div className="flex-1 border-b-2 border-dotted border-teal-700/40 pb-1 px-2 font-bold text-zinc-800 text-sm md:text-base bg-teal-50/20 rounded italic">
                          {tafqeetText}
                        </div>
                      </div>

                      {/* Row 3: نقداً / شيك رقم */}
                      <div className="flex items-baseline gap-3">
                        <span className="font-black text-teal-900 text-base md:text-lg shrink-0 w-44">
                          نقداً / شيك رقم :
                        </span>
                        <div className="flex-1 border-b-2 border-dotted border-teal-700/40 pb-1 px-2 font-bold text-zinc-800 text-sm md:text-base bg-teal-50/20 rounded">
                          <span className="font-bold text-teal-800">{pmName}</span>
                          {viewReceipt.manual_reference && <span className="mr-3 font-mono text-xs text-zinc-500">رقم: {viewReceipt.manual_reference}</span>}
                          {viewReceipt.entry_number && <span className="mr-3 font-mono text-xs text-zinc-500">(قيد رقم: {viewReceipt.entry_number})</span>}
                        </div>
                      </div>

                      {/* Row 4: وذلك قيمة */}
                      <div className="flex items-baseline gap-3">
                        <span className="font-black text-teal-900 text-base md:text-lg shrink-0 w-44">
                          وذلــــك قيـمـــــة :
                        </span>
                        <div className="flex-1 border-b-2 border-dotted border-teal-700/40 pb-1 px-2 font-bold text-zinc-800 text-sm md:text-base bg-teal-50/20 rounded">
                          {voucherDesc}
                        </div>
                      </div>

                      {/* Breakdown table if multi items exist */}
                      {viewReceipt.items && Array.isArray(viewReceipt.items) && viewReceipt.items.length > 1 && (
                        <div className="mt-6 pt-4 border-t border-zinc-200">
                          <h4 className="text-xs font-black text-teal-900 mb-2 uppercase tracking-wider">تفاصيل بنود القبض:</h4>
                          <table className="w-full text-xs text-right border border-zinc-200 rounded-xl overflow-hidden">
                            <thead className="bg-teal-50/80 text-teal-900 font-black">
                              <tr>
                                <th className="p-2 border-b border-zinc-200 w-12 text-center">م</th>
                                <th className="p-2 border-b border-zinc-200">النوع / الحساب</th>
                                <th className="p-2 border-b border-zinc-200">البيان والتفاصيل</th>
                                <th className="p-2 border-b border-zinc-200 w-28 text-left">المبلغ</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 font-medium">
                              {viewReceipt.items.map((item: any, idx: number) => {
                                let name = '-';
                                if (item.type === 'customer') name = customers.find(c => c.id === item.entity_id)?.name || 'عميل';
                                else if (item.type === 'supplier') name = suppliers.find(s => s.id === item.entity_id)?.name || 'مورد';
                                else if (item.type === 'expense') name = categories.find(c => c.id === item.entity_id)?.name || 'مصروف';
                                else name = accounts.find(a => a.id === item.entity_id)?.name || 'حساب';

                                return (
                                  <tr key={idx} className="hover:bg-zinc-50/50">
                                    <td className="p-2 text-center font-bold text-zinc-400">{idx + 1}</td>
                                    <td className="p-2 font-bold text-zinc-900">{name}</td>
                                    <td className="p-2 text-zinc-600">{item.description || '-'}</td>
                                    <td className="p-2 text-left font-black font-mono text-teal-700">{formatNumber(item.amount)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Bottom Signatures Section */}
                <div className="mt-12 pt-6 border-t-2 border-teal-600/30 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                  <div className="space-y-8">
                    <span className="text-xs font-black text-teal-900 uppercase tracking-wider block">المستلم (المحصّل)</span>
                    <div className="border-b border-zinc-300 w-3/4 mx-auto pb-1 text-xs text-zinc-400">........................</div>
                  </div>

                  <div className="space-y-8">
                    <span className="text-xs font-black text-teal-900 uppercase tracking-wider block">أمين الخزينة / الصراف</span>
                    <div className="border-b border-zinc-300 w-3/4 mx-auto pb-1 text-xs text-zinc-400">........................</div>
                  </div>

                  <div className="space-y-8">
                    <span className="text-xs font-black text-teal-900 uppercase tracking-wider block">المحاسب</span>
                    <div className="border-b border-zinc-300 w-3/4 mx-auto pb-1 text-xs text-zinc-400">........................</div>
                  </div>

                  <div className="space-y-8">
                    <span className="text-xs font-black text-teal-900 uppercase tracking-wider block">المدير المالي / الاعتماد</span>
                    <div className="border-b border-zinc-300 w-3/4 mx-auto pb-1 text-xs text-zinc-400">........................</div>
                  </div>
                </div>

                {/* Company Footer Stamp / Information */}
                <div className="mt-8 pt-4 flex items-center justify-between text-[10px] text-zinc-400 border-t border-zinc-100">
                  <span>{companyData?.name || 'نظام ERP السحابي'} {companyData?.tax_number ? `| س.ت / ض.م: ${companyData.tax_number}` : ''}</span>
                  <span>تمت الطباعة بواسطة النظام المالي</span>
                </div>
              </div>
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
