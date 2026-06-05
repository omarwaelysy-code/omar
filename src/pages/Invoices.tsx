import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Invoice, Customer, Product, InvoiceItem, Account, JournalEntry, JournalEntryItem, ActivityLog, Company } from '../types';
import { 
  Search, Plus, Trash2, X, Eye, Download, Sparkles, Mic, 
  Image as ImageIcon, FileText, Pencil, History, Printer, 
  ChevronLeft, ChevronRight, Maximize2, Minimize2, Hash, 
  Wallet, Calendar, Package, Tag, Layers, Box, Paperclip, 
  Phone, Mail, Lock, LayoutGrid, List, Building2, ChevronDown, 
  CreditCard, RotateCcw, Save
} from 'lucide-react';
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
import { PaginationControls } from '../components/PaginationControls';
import { usePermissions } from '../hooks/usePermissions';
import { formatNumber, formatMoney, formatDate } from '../utils/formatUtils';

import { useLanguage } from '../contexts/LanguageContext';
import { transactionManager, TransactionManager } from '../services/TransactionManager';
import { InvoiceSchema, JournalEntrySchema } from '../lib/schemas';
import { useViewPreference } from '../hooks/useViewPreference';
import { CompanyInvoiceHeader } from '../components/CompanyInvoiceHeader';
import { useNavigation } from '../contexts/NavigationContext';

export const Invoices: React.FC = () => {
  const { t, dir, language } = useLanguage();
  const { user } = useAuth();
  const { canView, canCreate, canEdit, canDelete } = usePermissions('invoices');
  const { showNotification } = useNotification();
  const { pendingViewDoc, setPendingViewDoc, setCurrentPage } = useNavigation();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [allReceipts, setAllReceipts] = useState<any[]>([]);
  const [allPayments, setAllPayments] = useState<any[]>([]);
  const [allReturns, setAllReturns] = useState<any[]>([]);
  const [allPurchaseReturns, setAllPurchaseReturns] = useState<any[]>([]);
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
  const isInitialLoad = useRef(true);
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
    type: 'finished_good' as 'service' | 'finished_good' | 'raw_material' | 'commodity' | 'consumable',
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
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [paymentTerms, setPaymentTerms] = useState<string>('due_on_receipt');
  const [paymentTermsDays, setPaymentTermsDays] = useState<number>(0);
  const [advancePercentage, setAdvancePercentage] = useState<number>(0);
  const [dueDate, setDueDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [description, setDescription] = useState<string>('');
  const [paymentType, setPaymentType] = useState<'cash' | 'credit'>('credit');
  const [paymentMethodId, setPaymentMethodId] = useState<string | ''>('');
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  
  // Form Settlements State
  const [formSettlementNumber, setFormSettlementNumber] = useState<string>('');
  const [formSettlementDate, setFormSettlementDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [formSettlements, setFormSettlements] = useState<any[]>([]);
  const [rowSettlementDates, setRowSettlementDates] = useState<Record<string, string>>({});
  const [allInvoices, setAllInvoices] = useState<any[]>([]);
  const [allPurchaseInvoices, setAllPurchaseInvoices] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [companyData, setCompanyData] = useState<Company | null>(null);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [view, setView] = useViewPreference('invoices', 'table');
  const [invoiceType, setInvoiceType] = useState<'items' | 'services'>('items');

  useEffect(() => {
    if (user) {
      const unsubInvoices = dbService.subscribePaginated<Invoice>('invoices', {
        company_id: user.company_id,
        _page: page,
        _limit: limit,
        _sortBy: sortBy,
        _sortOrder: sortOrder,
        _search: searchTerm
      }, (result) => {
        setInvoices(result.data);
        setTotalRecords(result.total);
        setServerSummary(result.summary);
      });
      const unsubCustomers = dbService.subscribe<Customer>('customers', user.company_id, setCustomers);
      const unsubProducts = dbService.subscribe<Product>('products', user.company_id, setProducts);
      const unsubPM = dbService.subscribe<any>('payment_methods', user.company_id, setPaymentMethods);
      const unsubAccounts = dbService.subscribe<Account>('accounts', user.company_id, setAccounts);
      const unsubWarehouses = dbService.subscribe<any>('warehouses', user.company_id, setWarehouses);
      const unsubEntries = dbService.subscribe<JournalEntry>('journal_entries', user.company_id, setEntries);
      const unsubReceipts = dbService.subscribe<any>('receipt_vouchers', user.company_id, setAllReceipts);
      const unsubPayments = dbService.subscribe<any>('payment_vouchers', user.company_id, setAllPayments);
      const unsubReturns = dbService.subscribe<any>('returns', user.company_id, setAllReturns);
      const unsubPR = dbService.subscribe<any>('purchase_returns', user.company_id, setAllPurchaseReturns);
      const unsubAllInvoices = dbService.subscribe<any>('invoices', user.company_id, setAllInvoices);
      const unsubAllPurchaseInvoices = dbService.subscribe<any>('purchase_invoices', user.company_id, setAllPurchaseInvoices);
      
      const fetchSettings = async () => {
        const docs = await dbService.getDocsByFilter<any>('settings', user.company_id, [
          { field: 'type', operator: '==', value: 'discount_settings' }
        ]);
        if (docs.length > 0) {
          setSettings(docs[0]);
        }
      };

      const loadCompanyData = async () => {
        try {
          const company = await dbService.get<Company>('companies', user.company_id);
          if (company) {
            setCompanyData(company);
          }
        } catch (error) {
          console.error('Failed to load company data:', error);
        }
      };

      fetchSettings();
      loadCompanyData();
      setLoading(false);
      return () => {
        unsubInvoices();
        unsubCustomers();
        unsubProducts();
        unsubPM();
        unsubAccounts();
        unsubWarehouses();
        unsubEntries();
        unsubReceipts();
        unsubPayments();
        unsubReturns();
        unsubPR();
        unsubAllInvoices();
        unsubAllPurchaseInvoices();
      };
    }
  }, [user, page, limit, sortBy, sortOrder, searchTerm]);

  const generateInvoiceNumber = async (dateStr: string) => {
    const next = await dbService.getNextSequence('invoices', dateStr);
    return next;
  };

  const getCustomerBalance = (customerId: string) => {
    let balance = 0;
    entries.forEach((je: any) => {
      je.items?.forEach((item: any) => {
        if (item.customer_id === customerId) {
          balance += (item.debit || 0) - (item.credit || 0);
        }
      });
    });
    return balance;
  };

  const getInvoiceSettlements = (inv: any) => {
    if (!inv) return [];
    const voucherSettlements: any[] = [];
    
    // Receipt Vouchers
    allReceipts.forEach(v => {
      if (v.items && Array.isArray(v.items)) {
        v.items.forEach((item: any) => {
          if (item.settlements && Array.isArray(item.settlements)) {
            item.settlements.forEach((s: any) => {
              if (s.target_id === inv.id) {
                voucherSettlements.push({
                  id: `${v.id}-${s.target_id}`,
                  date: v.date,
                  type_label: 'سند قبض',
                  number: v.voucher_number || v.number || v.id,
                  page_name: 'receipts',
                  amount: Number(s.settled_amount) || 0,
                  notes: v.description || v.notes || ''
                });
              }
            });
          }
        });
      }
    });

    // Payment Vouchers
    allPayments.forEach(v => {
      if (v.items && Array.isArray(v.items)) {
        v.items.forEach((item: any) => {
          if (item.settlements && Array.isArray(item.settlements)) {
            item.settlements.forEach((s: any) => {
              if (s.target_id === inv.id) {
                voucherSettlements.push({
                  id: `${v.id}-${s.target_id}`,
                  date: v.date,
                  type_label: 'سند صرف',
                  number: v.voucher_number || v.number || v.id,
                  page_name: 'payment_vouchers',
                  amount: Number(s.settled_amount) || 0,
                  notes: v.description || v.notes || ''
                });
              }
            });
          }
        });
      }
    });

    // Returns
    const returnSettlements: any[] = [];
    const returnsList = inv.customer_id ? allReturns : allPurchaseReturns;
    returnsList.forEach(r => {
      const descMatches = r.description?.toLowerCase().includes(inv.invoice_number.toLowerCase()) ||
                          r.notes?.toLowerCase().includes(inv.invoice_number.toLowerCase()) ||
                          r.return_number?.toLowerCase().includes(inv.invoice_number.toLowerCase());
      
      const isCorrectEntity = inv.customer_id 
        ? r.customer_id === inv.customer_id 
        : r.supplier_id === inv.supplier_id;
        
      if (descMatches && isCorrectEntity) {
        returnSettlements.push({
          id: r.id,
          date: r.date,
          type_label: inv.customer_id ? 'مرتجع مبيعات' : 'مرتجع مشتريات',
          number: r.return_number || r.id,
          page_name: inv.customer_id ? 'returns' : 'purchase_returns',
          amount: Number(r.total_amount) || 0,
          notes: r.description || r.notes || ''
        });
      }
    });

    // Manual JEs
    const jeSettlements: any[] = [];
    entries.forEach(je => {
      if (je.reference_id === inv.id || je.reference_number === inv.invoice_number) {
        return;
      }
      
      const standardTypes = ['invoice', 'purchase_invoice', 'receipt', 'payment', 'return', 'purchase_return', 'opening_balance', 'receipt_voucher', 'payment_voucher'];
      if (je.reference_type && standardTypes.includes(je.reference_type)) {
        return;
      }

      const jeDescMatches = je.description?.toLowerCase().includes(inv.invoice_number.toLowerCase()) ||
                            je.reference_number?.toLowerCase().includes(inv.invoice_number.toLowerCase());
                            
      je.items?.forEach((item: any, idx: number) => {
        const isCorrectAccount = inv.customer_id 
          ? item.customer_id === inv.customer_id
          : item.supplier_id === inv.supplier_id;
          
        if (isCorrectAccount) {
          const isSettlingLine = inv.customer_id
            ? (Number(item.credit) > 0)
            : (Number(item.debit) > 0);
            
          const lineDescMatches = item.description?.toLowerCase().includes(inv.invoice_number.toLowerCase());
          
          if (isSettlingLine && (jeDescMatches || lineDescMatches)) {
            jeSettlements.push({
              id: `${je.id}-${idx}`,
              date: je.date,
              type_label: 'قيد يومية',
              number: je.entry_number || je.id.slice(0, 8),
              page_name: 'journal_entries',
              amount: inv.customer_id ? Number(item.credit) : Number(item.debit),
              notes: item.description || je.description || ''
            });
          }
        }
      });
    });

    // Invoice-side settlements
    const invoiceSideSettlements: any[] = [];
    if (inv.settlements && Array.isArray(inv.settlements)) {
      inv.settlements.forEach((s: any) => {
        invoiceSideSettlements.push({
          id: `${inv.id}-${s.target_id}`,
          date: s.settlement_date || s.date || inv.date,
          type_label: s.type_label || 'تسوية',
          number: s.settlement_number || s.reference_number || s.target_id,
          page_name: s.type || 'receipts',
          amount: Number(s.settled_amount || s.amount) || 0,
          notes: s.notes || ''
        });
      });
    }

    return [...voucherSettlements, ...returnSettlements, ...jeSettlements, ...invoiceSideSettlements];
  };

  const getPaymentStatus = (inv: any) => {
    if (!inv) return 'unpaid';
    if (inv.payment_type === 'cash') return 'paid';
    
    const settlements = getInvoiceSettlements(inv);
    const totalSettled = settlements.reduce((sum, s) => sum + s.amount, 0);
    
    if (totalSettled <= 0) return 'unpaid';
    if (totalSettled >= inv.total_amount - 0.01) return 'paid';
    return 'partial';
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

    const nextSeq = (maxSeq + 1).toString().padStart(6, '0');
    return `${prefix}-${nextSeq}`;
  };

  const getSettlementsForTarget = (targetId: string, excludeInvoiceId?: string) => {
    let settledSum = 0;
    
    const sumInvoiceSettlements = (invoicesList: any[]) => {
      invoicesList.forEach(inv => {
        if (excludeInvoiceId && inv.id === excludeInvoiceId) return;
        if (inv.settlements && Array.isArray(inv.settlements)) {
          inv.settlements.forEach((s: any) => {
            if (s.target_id === targetId) {
              settledSum += Number(s.settled_amount) || 0;
            }
          });
        }
      });
    };
    
    const sumVoucherSettlements = (vouchersList: any[]) => {
      vouchersList.forEach(v => {
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

    sumInvoiceSettlements(allInvoices);
    sumInvoiceSettlements(allPurchaseInvoices);
    sumVoucherSettlements(allReceipts);
    sumVoucherSettlements(allPayments);

    return settledSum;
  };

  const handleRowDateChange = (targetTx: any, newDate: string) => {
    const newDates = {
      ...rowSettlementDates,
      [targetTx.id]: newDate
    };
    setRowSettlementDates(newDates);

    const settlements = [...formSettlements];
    const existingIdx = settlements.findIndex(s => s.target_id === targetTx.id);
    if (existingIdx > -1) {
      const currentS = settlements[existingIdx];
      const serial = generateSettlementSerial(newDate, allReceipts, allPayments);
      settlements[existingIdx] = {
        ...currentS,
        settlement_date: newDate,
        settlement_number: serial
      };
      setFormSettlements(settlements);
    }
  };

  const getOppositeMovements = (customerId: string) => {
    if (!customerId) return [];

    const movements: any[] = [];

    // 1. Receipt Vouchers
    allReceipts.forEach(v => {
      if (v.items && Array.isArray(v.items)) {
        v.items.forEach((item: any, idx: number) => {
          if (item.customer_id === customerId || (item.type === 'customer' && item.entity_id === customerId)) {
            const voucherSettled = (item.settlements || []).reduce((sum: number, s: any) => sum + Number(s.settled_amount || s.amount || 0), 0);
            const invoiceSettled = getSettlementsForTarget(`${v.id}-${idx}`, editingInvoice?.id);
            const totalSettled = voucherSettled + invoiceSettled;
            const originalAmount = Number(item.amount) || 0;
            const openAmount = originalAmount - totalSettled;

            if (openAmount > 0.01 || formSettlements.some(fs => fs.target_id === `${v.id}-${idx}`)) {
              movements.push({
                id: `${v.id}-${idx}`,
                original_id: v.id,
                date: v.date,
                type_label: 'سند قبض',
                number: v.voucher_number || v.number || v.id,
                page_name: 'receipts',
                original_amount: originalAmount,
                open_amount: openAmount,
                notes: v.description || v.notes || '',
                je_number: v.entry_number || ''
              });
            }
          }
        });
      }
    });

    // 2. Sales Returns
    allReturns.forEach(r => {
      if (r.customer_id === customerId) {
        const invoiceSettled = getSettlementsForTarget(r.id, editingInvoice?.id);
        const originalAmount = Number(r.total_amount) || 0;
        const openAmount = originalAmount - invoiceSettled;

        if (openAmount > 0.01 || formSettlements.some(fs => fs.target_id === r.id)) {
          movements.push({
            id: r.id,
            original_id: r.id,
            date: r.date,
            type_label: 'مرتجع مبيعات',
            number: r.return_number || r.id,
            page_name: 'returns',
            original_amount: originalAmount,
            open_amount: openAmount,
            notes: r.description || r.notes || '',
            je_number: r.entry_number || ''
          });
        }
      }
    });

    // 3. Manual JEs
    entries.forEach(je => {
      const standardTypes = ['invoice', 'purchase_invoice', 'receipt', 'payment', 'return', 'purchase_return', 'opening_balance', 'receipt_voucher', 'payment_voucher'];
      if (je.reference_type && standardTypes.includes(je.reference_type)) {
        return;
      }
      
      je.items?.forEach((item: any, idx: number) => {
        if (item.customer_id === customerId && Number(item.credit) > 0) {
          const originalAmount = Number(item.credit) || 0;
          const invoiceSettled = getSettlementsForTarget(`${je.id}-${idx}`, editingInvoice?.id);
          const openAmount = originalAmount - invoiceSettled;

          if (openAmount > 0.01 || formSettlements.some(fs => fs.target_id === `${je.id}-${idx}`)) {
            movements.push({
              id: `${je.id}-${idx}`,
              original_id: je.id,
              date: je.date,
              type_label: 'قيد يومية',
              number: je.entry_number || je.id.slice(0, 8),
              page_name: 'journal_entries',
              original_amount: originalAmount,
              open_amount: openAmount,
              notes: item.description || je.description || '',
              je_number: je.entry_number || je.id.slice(0, 8)
            });
          }
        }
      });
    });

    return movements;
  };

  const handleSettlementChange = (targetTx: any, amount: number) => {
    const settlements = [...formSettlements];
    const existingIdx = settlements.findIndex(s => s.target_id === targetTx.id);
    const rowDate = rowSettlementDates[targetTx.id] || date.slice(0, 10);

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
        reference_number: targetTx.number,
        entry_number: targetTx.je_number,
        type: targetTx.page_name,
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

    setFormSettlements(settlements);
  };

  const calculateDueDate = (invoiceDateStr: string, terms: string, customDays: number) => {
    if (!invoiceDateStr) return invoiceDateStr;
    const invDate = new Date(invoiceDateStr);
    if (isNaN(invDate.getTime())) return invoiceDateStr;

    if (terms === 'due_on_receipt' || terms === 'cash') {
      return invoiceDateStr;
    } else if (terms === 'eom') {
      const y = invDate.getFullYear();
      const m = invDate.getMonth();
      const lastDay = new Date(y, m + 1, 0);
      return lastDay.toISOString().slice(0, 10);
    } else if (terms === 'eom_30') {
      const y = invDate.getFullYear();
      const m = invDate.getMonth();
      const lastDay = new Date(y, m + 1, 30);
      return lastDay.toISOString().slice(0, 10);
    } else {
      let days = 0;
      if (terms === 'net_7') days = 7;
      else if (terms === 'net_15') days = 15;
      else if (terms === 'net_30') days = 30;
      else if (terms === 'net_45') days = 45;
      else if (terms === 'net_60') days = 60;
      else if (terms === 'net_90') days = 90;
      else if (terms === 'net_180') days = 180;
      else if (terms === 'custom') days = customDays || 0;
      
      invDate.setDate(invDate.getDate() + days);
      return invDate.toISOString().slice(0, 10);
    }
  };

  // Auto populate customer preferences
  useEffect(() => {
    if (selectedCustomerId && isModalOpen && user) {
      const customer = customers.find(c => c.id === selectedCustomerId);
      if (customer && !editingInvoice) {
        if (customer.payment_method) {
          setPaymentType(customer.payment_method === 'cash' ? 'cash' : 'credit');
        }
        if (customer.payment_terms) {
          setPaymentTerms(customer.payment_terms);
          setPaymentTermsDays(customer.payment_terms_days || 0);
          setAdvancePercentage(customer.advance_percentage || 0);
          
          const computedDue = calculateDueDate(date, customer.payment_terms, customer.payment_terms_days || 0);
          setDueDate(computedDue);
        } else {
          setPaymentTerms('due_on_receipt');
          setPaymentTermsDays(0);
          setAdvancePercentage(0);
          setDueDate(date);
        }
      }
    }
  }, [selectedCustomerId, isModalOpen, editingInvoice, user, customers]);

  // Recalculate due date when date or terms change
  useEffect(() => {
    if (isModalOpen) {
      if (isInitialLoad.current) {
        isInitialLoad.current = false;
        return;
      }
      const computedDue = calculateDueDate(date, paymentTerms, paymentTermsDays);
      setDueDate(computedDue);
    }
  }, [date, paymentTerms, paymentTermsDays, isModalOpen]);

  useEffect(() => {
    if (isProductModalOpen) {
      const prefixMap: Record<string, string> = {
        'service': 'SRV',
        'finished_good': 'FG',
        'raw_material': 'RM',
        'commodity': 'CMD',
        'consumable': 'CON'
      };
      
      const prefix = prefixMap[productFormData.type] || 'PRD';
      
      const typeProducts = products.filter(p => p.type === productFormData.type);
      
      let maxNum = 0;
      typeProducts.forEach(p => {
        const parts = p.code?.split('-');
        if (parts && parts.length > 1) {
          const num = parseInt(parts[1]);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        } else if (p.code?.startsWith(prefix)) {
          const numStr = p.code.substring(prefix.length);
          const num = parseInt(numStr);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      });
      
      const nextNum = (maxNum + 1).toString().padStart(4, '0');
      const newCode = `${prefix}-${nextNum}`;
      
      if (productFormData.code !== newCode) {
        setProductFormData(prev => ({ ...prev, code: newCode }));
      }
    }
  }, [productFormData.type, isProductModalOpen, products]);

  const handlePrint = () => {
    // Add print-specific styles dynamically to ensure only the invoice content is printed
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        body * {
          visibility: hidden !important;
        }
        #invoice-capture-area, #invoice-capture-area * {
          visibility: visible !important;
        }
        #invoice-capture-area {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          padding: 0 !important;
          margin: 0 !important;
          box-shadow: none !important;
          border: none !important;
        }
        .no-print {
          display: none !important;
        }
        /* Ensure images and barcodes are rendered */
        img {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        svg {
          max-width: 100% !important;
        }
      }
    `;
    document.head.appendChild(style);
    window.print();
    // Remove the style after printing (optional but cleaner)
    setTimeout(() => document.head.removeChild(style), 1000);
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
      const updateNum = async () => {
        const num = await generateInvoiceNumber(date);
        setInvoiceNumber(num);
      };
      updateNum();
    }
  }, [date, invoices, isModalOpen, editingInvoice, user]);

  // Load pending sales orders for selected customer
  useEffect(() => {
    if (selectedCustomerId && isModalOpen && user) {
      if (editingInvoice) {
        Promise.all([
          dbService.list<any>('sales_orders', { 
            company_id: user.company_id,
            invoice_id: editingInvoice.id
          }),
          dbService.list<any>('sales_orders', {
            company_id: user.company_id,
            customer_id: selectedCustomerId,
            status: 'pending'
          })
        ]).then(([linked, pending]) => {
          const linkedIds = linked.map(o => o.id);
          setSelectedOrderIds(linkedIds);
          const combined = [...linked, ...pending];
          const unique = combined.filter((o, index, self) => self.findIndex(t => t.id === o.id) === index);
          setPendingOrders(unique);
        }).catch(err => {
          console.error('Error fetching sales orders for edit:', err);
        });
      } else {
        dbService.list<any>('sales_orders', { 
          company_id: user.company_id,
          customer_id: selectedCustomerId,
          status: 'pending'
        }).then(orders => {
          setPendingOrders(orders);
          setSelectedOrderIds([]);
        }).catch(err => {
          console.error('Error fetching pending sales orders:', err);
        });
      }
    } else {
      setPendingOrders([]);
      setSelectedOrderIds([]);
    }
  }, [selectedCustomerId, isModalOpen, editingInvoice, user]);

  const handleOrderCheckboxChange = (orderId: string, checked: boolean) => {
    setSelectedOrderIds(prev => {
      const next = checked ? [...prev, orderId] : prev.filter(id => id !== orderId);
      const mergedItems: InvoiceItem[] = [];
      next.forEach(id => {
        const order = pendingOrders.find(o => o.id === id);
        if (order) {
          (order.items || []).forEach((item: any) => {
            mergedItems.push({
              product_id: item.product_id,
              product_name: item.product_name,
              product_code: item.product_code || '',
              product_image_url: item.product_image_url || '',
              quantity: Number(item.quantity) || 0,
              unit_price: Number(item.unit_price) || 0,
              total: Number(item.total) || 0,
              barcode: item.barcode || '',
              image_url: item.product_image_url || ''
            });
          });
        }
      });
      setItems(mergedItems);
      return next;
    });
  };

  useEffect(() => {
    if (pendingViewDoc && pendingViewDoc.type === 'convert_sales_order' && user) {
      const orderId = pendingViewDoc.idOrNumber;
      setPendingViewDoc(null);
      
      const loadOrderForConversion = async () => {
        try {
          const order = await dbService.get<any>('sales_orders', orderId);
          if (order) {
            openModal();
            setSelectedCustomerId(order.customer_id);
            setSelectedOrderIds([orderId]);
            if (order.notes) setDescription(order.notes);
            if (order.warehouse_id) setSelectedWarehouseId(order.warehouse_id);

            const mappedItems = (order.items || []).map((item: any) => ({
              product_id: item.product_id,
              product_name: item.product_name,
              product_code: item.product_code || '',
              product_image_url: item.product_image_url || '',
              quantity: Number(item.quantity) || 0,
              unit_price: Number(item.unit_price) || 0,
              total: Number(item.total) || 0,
              barcode: item.barcode || '',
              image_url: item.product_image_url || ''
            }));
            setItems(mappedItems);
          }
        } catch (err) {
          console.error("Error converting sales order", err);
        }
      };
      loadOrderForConversion();
    }
  }, [pendingViewDoc, user, setPendingViewDoc]);


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
          : `إضافة فاتورة جديدة للعميل ${customer?.name || '...'} بمبلغ ${formatMoney(total_amount)}`,
        created_at: new Date().toISOString(),
        entity: 'invoices'
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
        description: `فاتورة مبيعات رقم ${invoice_number} - ${customer?.name || '...'}`,
        sub_account_id: paymentType === 'cash' ? paymentMethodId : customer?.id,
        sub_account_type: paymentType === 'cash' ? 'payment_method' : 'customer'
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
      total: product.sale_price,
      barcode: product.barcode || '',
      image_url: product.image_url || ''
    }]);
  };

  const addEmptyRow = () => {
    setItems(prev => [...prev, {
      product_id: '',
      product_name: '',
      quantity: 1,
      unit_price: 0,
      total: 0,
      barcode: '',
      image_url: ''
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
          item.barcode = product.barcode || '';
          item.image_url = product.image_url || '';
        } else {
          item.product_name = '';
          item.product_image_url = '';
          item.unit_price = 0;
          item.total = 0;
          item.barcode = '';
          item.image_url = '';
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
    
    const hasPhysicalProduct = items.some(item => {
      const prod = products.find(p => p.id === item.product_id);
      return prod && prod.type !== 'service';
    });

    if (invoiceType === 'items' && hasPhysicalProduct && !selectedWarehouseId) {
      showNotification('يرجى اختيار المخزن', 'error');
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
      const subtotal = Number(validItems.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_price || 0)), 0)) || 0;
      const discount_amount = Number(discount) || 0;
      const total_amount = Number(subtotal - discount_amount) || 0;

      // Over-settlement validation
      const totalSettled = formSettlements.reduce((sum, s) => sum + Number(s.settled_amount), 0);
      if (totalSettled > total_amount) {
        showNotification('التسوية أكبر من المبلغ الإجمالي', 'error');
        return;
      }
      
      const customer = customers.find(c => c.id === selectedCustomerId);
      const paymentMethod = paymentMethods.find(pm => pm.id === paymentMethodId);
      
      const sanitizedItems = validItems.map(i => ({
        product_id: i.product_id,
        product_name: i.product_name,
        product_code: i.product_code || '',
        product_image_url: i.product_image_url || i.image_url || '',
        quantity: Number(i.quantity) || 0,
        unit_price: Number(i.unit_price) || 0,
        total: Number((Number(i.quantity) || 0) * (Number(i.unit_price) || 0)) || 0,
        barcode: i.barcode || '',
        image_url: i.image_url || ''
      }));

      const invoiceData = { 
        settlement_number: null,
        settlement_date: null,
        settlements: formSettlements,
        invoice_number: invoiceNumber,
        customer_id: selectedCustomerId, 
        customer_name: customer?.name || '',
        warehouse_id: selectedWarehouseId || null,
        order_ids: selectedOrderIds,
        date, 
        description,
        items: sanitizedItems,
        subtotal,
        discount_amount,
        total_amount,
        payment_type: paymentType,
        payment_method_id: paymentType === 'cash' ? (paymentMethodId || null) : null,
        payment_method_name: paymentType === 'cash' ? (paymentMethod?.name || '') : null,
        company_id: user.company_id,
        created_at: new Date().toISOString(),
        created_by: user.id,
        payment_terms: paymentTerms,
        payment_terms_days: paymentTermsDays,
        advance_percentage: advancePercentage,
        due_date: dueDate
      };

      // Journal items generation
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
        debit: total_amount,
        credit: 0,
        description: `فاتورة مبيعات رقم ${invoiceNumber}${description ? ` - ${description}` : ''} - ${customer?.name}`,
        customer_id: selectedCustomerId,
        customer_name: customer?.name,
        sub_account_id: selectedCustomerId,
        sub_account_type: 'customer'
      });

      if (discount > 0) {
        const discountAccount = accounts.find(a => a.id === settings?.customer_discount_account_id) || 
                                 accounts.find(a => a.name.includes('خصم مسموح به') || a.name.includes('خصم مبيعات'));
        journalItems.push({
          account_id: discountAccount?.id || 'sales_discount_default',
          account_name: discountAccount?.name || 'حساب الخصم المسموح به (افتراضي)',
          debit: discount,
          credit: 0,
          description: `خصم مسموح به - فاتورة رقم ${invoiceNumber}${description ? ` - ${description}` : ''}`
        });
      }

      sanitizedItems.forEach(item => {
        const product = products.find(p => p.id === item.product_id);
        let creditAccountId = product?.revenue_account_id || '';
        let creditAccountName = product?.revenue_account_name || '';
        if (!creditAccountId) {
          const fallback = accounts.find(a => a.name.includes('مبيعات') || a.name.includes('إيراد'));
          creditAccountId = fallback?.id || 'sales_account_default';
          creditAccountName = fallback?.name || 'حساب المبيعات (افتراضي)';
        }
        journalItems.push({
          account_id: creditAccountId,
          account_name: creditAccountName,
          debit: 0,
          credit: item.total,
          description: `مبيعات صنف: ${item.product_name} - فاتورة ${invoiceNumber}${description ? ` - ${description}` : ''}`
        });
      });

      if (paymentType === 'cash') {
        const pm = paymentMethods.find(p => p.id === paymentMethodId);
        let cashAccountId = pm?.account_id || '';
        let cashAccountName = pm?.account_name || '';
        if (!cashAccountId) {
          const fallback = accounts.find(a => a.name.includes('نقدية') || a.name.includes('خزينة') || a.name.includes('صندوق'));
          cashAccountId = fallback?.id || 'cash_account_default';
          cashAccountName = fallback?.name || 'حساب النقدية (افتراضي)';
        }
        journalItems.push({
          account_id: cashAccountId,
          account_name: cashAccountName,
          debit: total_amount,
          credit: 0,
          description: `تحصيل فاتورة مبيعات رقم ${invoiceNumber} - ${customer?.name}`,
          sub_account_id: paymentMethodId,
          sub_account_type: 'payment_method'
        });
        journalItems.push({
          account_id: customerAccountId,
          account_name: customerAccountName,
          debit: 0,
          credit: total_amount,
          description: `سداد فاتورة مبيعات رقم ${invoiceNumber} - ${customer?.name}`,
          customer_id: selectedCustomerId,
          customer_name: customer?.name,
          sub_account_id: selectedCustomerId,
          sub_account_type: 'customer'
        });
      }

      const total_debit = Number(journalItems.reduce((sum, item) => sum + (Number(item.debit) || 0), 0).toFixed(2)) || 0;
      const total_credit = Number(journalItems.reduce((sum, item) => sum + (Number(item.credit) || 0), 0).toFixed(2)) || 0;

      const journalEntryData = {
        date,
        reference_number: invoiceNumber,
        reference_type: 'invoice',
        description: t('invoices.journal_description', { number: invoiceNumber }),
        items: journalItems,
        total_debit,
        total_credit,
        company_id: user.company_id,
        created_at: new Date().toISOString(),
        created_by: user.id
      };

      if (editingInvoice) {
        // For editing, we still use TransactionManager approach by deleting old journal and adding new one
        await dbService.deleteJournalEntryByReference(editingInvoice.id, user.company_id);
        await TransactionManager.updateWithAccounting(
          'invoices',
          editingInvoice.id,
          invoiceData,
          InvoiceSchema,
          journalEntryData,
          JournalEntrySchema
        );
      } else {
        await TransactionManager.saveWithAccounting(
          'invoices',
          invoiceData,
          InvoiceSchema,
          journalEntryData,
          JournalEntrySchema
        );
      }

      closeModal();
      showNotification(editingInvoice ? t('invoices.invoice_updated') : t('invoices.invoice_saved'), 'success');
      
      if (!editingInvoice) {
        // Activity log in background
        dbService.logActivity(user.id, user.username, user.company_id, t('invoices.log_add'), t('invoices.log_add_msg', { number: invoiceNumber }), 'invoices');
      }

    } catch (e: any) {
      console.error('Save failed:', e);
      showNotification(e.message || 'حدث خطأ أثناء حفظ الفاتورة', 'error');
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
      showNotification(t('common.delete_success'), 'success');
      setIsDeleteModalOpen(false);
      setInvoiceToDelete(null);
    } catch (e: any) {
      console.error(e);
      showNotification(e.message || t('common.delete_error'), 'error');
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
        type: 'finished_good' as any,
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

  const openModal = async () => {
    isInitialLoad.current = true;
    setEditingInvoice(null);
    setSelectedCustomerId('');
    setSelectedWarehouseId('');
    const newDate = new Date().toISOString().slice(0, 10);
    setDate(newDate);
    const num = await generateInvoiceNumber(newDate);
    setInvoiceNumber(num);
    setItems([]);
    setDescription('');
    setPaymentType('credit');
    setPaymentMethodId('');
    setPaymentTerms('due_on_receipt');
    setPaymentTermsDays(0);
    setAdvancePercentage(0);
    setDueDate(newDate);
    setFormSettlementNumber('');
    setFormSettlementDate(newDate);
    setFormSettlements([]);
    setRowSettlementDates({});
    setIsModalOpen(true);
    setIsFullScreen(false);
  };

  const handleViewInvoice = (invoice: Invoice) => {
    setViewInvoice(invoice);
  };

  const openEditModal = async (invoice: Invoice) => {
    console.log('[EDIT] Opening Edit Modal for ID:', invoice.id);
    try {
      // Fetch latest full data to be sure we have everything including items
      const fullData = await dbService.get<Invoice>('invoices', invoice.id);
      console.log('[EDIT] Full data received from API:', fullData);
      
      if (!fullData) throw new Error('Could not fetch invoice details');

      setEditingInvoice(fullData);
      setSelectedCustomerId(fullData.customer_id);
      setSelectedWarehouseId(fullData.warehouse_id || '');
      
      // Determine invoice type based on items or warehouse_id
      if (fullData.warehouse_id) {
        setInvoiceType('items');
      } else {
        const hasPhysical = (fullData.items || []).some((item: any) => {
          const prod = products.find(p => p.id === item.product_id);
          return prod && prod.type !== 'service';
        });
        setInvoiceType(hasPhysical ? 'items' : 'services');
      }

      setDate(fullData.date.slice(0, 10));
      setInvoiceNumber(fullData.invoice_number);
      setItems(fullData.items || []);
      setDiscount(fullData.discount_amount || fullData.discount || 0);
      setDescription(fullData.description || '');
      setPaymentType(fullData.payment_type || 'credit');
      setPaymentMethodId(fullData.payment_method_id || '');
      setPaymentTerms(fullData.payment_terms || 'due_on_receipt');
      setPaymentTermsDays(fullData.payment_terms_days || 0);
      setAdvancePercentage(fullData.advance_percentage || 0);
      setDueDate(fullData.due_date ? fullData.due_date.slice(0, 10) : fullData.date.slice(0, 10));
      setFormSettlementNumber(fullData.settlement_number || '');
      setFormSettlementDate(fullData.settlement_date ? fullData.settlement_date.slice(0, 10) : fullData.date.slice(0, 10));
      setFormSettlements(fullData.settlements || []);
      const datesDict: Record<string, string> = {};
      if (fullData.settlements && Array.isArray(fullData.settlements)) {
        fullData.settlements.forEach((s: any) => {
          if (s.target_id) {
            datesDict[s.target_id] = s.settlement_date || s.date || fullData.date.slice(0, 10);
          }
        });
      }
      setRowSettlementDates(datesDict);
      isInitialLoad.current = true;
      setIsModalOpen(true);
      setIsFullScreen(false);
      
      console.log('[EDIT] Form state updated with:', {
        id: fullData.id,
        customer_id: fullData.customer_id,
        date: fullData.date.slice(0, 10),
        items: (fullData.items || []).length,
        payment_type: fullData.payment_type
      });
    } catch (error: any) {
      console.error('[EDIT] Error opening edit modal:', error);
      showNotification('فشل تحميل بيانات الفاتورة: ' + error.message, 'error');
    }
  };

  useEffect(() => {
    if (pendingViewDoc && pendingViewDoc.type === 'invoice' && user) {
      const loadPendingDoc = async () => {
        try {
          const existing = invoices.find(inv => inv.invoice_number === pendingViewDoc.idOrNumber || inv.id === pendingViewDoc.idOrNumber);
          if (existing) {
            openEditModal(existing);
            setPendingViewDoc(null);
            return;
          }
          const docs = await dbService.getDocsByFilter<Invoice>('invoices', user.company_id, [
            { field: 'invoice_number', operator: '==', value: pendingViewDoc.idOrNumber }
          ]);
          if (docs && docs.length > 0) {
            openEditModal(docs[0]);
          } else {
            const docById = await dbService.get<Invoice>('invoices', pendingViewDoc.idOrNumber);
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
  }, [pendingViewDoc, invoices, user, setPendingViewDoc]);

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
    setDescription('');
    setPaymentType('credit');
    setPaymentMethodId('');
    setPaymentTerms('due_on_receipt');
    setPaymentTermsDays(0);
    setAdvancePercentage(0);
    setDueDate(new Date().toISOString().slice(0, 10));
    setFormSettlementNumber('');
    setFormSettlementDate(new Date().toISOString().slice(0, 10));
    setFormSettlements([]);
    setRowSettlementDates({});
    setIsFullScreen(false);
    setSelectedOrderIds([]);
    setPendingOrders([]);
  };

  const filteredInvoices = invoices.filter(i => 
    i.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500 gap-4">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
          <Lock size={40} />
        </div>
        <h3 className="text-xl font-bold">عذراً، ليس لديك صلاحية للوصول إلى هذه الصفحة</h3>
        <p className="text-sm">يرجى التواصل مع مدير النظام للحصول على الصلاحيات اللازمة.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir={dir}>
      {!isModalOpen ? (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 italic serif">{t('invoices.title')}</h2>
              <p className="text-slate-500">{t('invoices.subtitle')}</p>
              {(serverSummary.total_amount !== undefined) && (
                <div className="mt-2 flex items-center gap-4 text-sm">
                  <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100 font-bold">إجمالي الفواتير: {formatMoney(serverSummary.total_amount)} {t('invoices.currency')}</span>
                  <span className="bg-red-50 text-red-700 px-3 py-1 rounded-full border border-red-100 font-bold">إجمالي الخصومات: {formatMoney(serverSummary.total_discount || 0)} {t('invoices.currency')}</span>
                  <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-100 font-bold">الصافي: {formatMoney((serverSummary.total_amount || 0) - (serverSummary.total_discount || 0))} {t('invoices.currency')}</span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button 
                onClick={() => setIsActivityLogOpen(true)}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-slate-600 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
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
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
                >
                  <Plus size={20} />
                  {t('invoices.add_invoice')}
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center gap-4">
              <div className="relative flex-1">
                <Search className={`absolute ${dir === 'rtl' ? 'left-3' : 'right-3'} top-3 text-slate-400`} size={18} />
                <input
                  type="text"
                  placeholder={t('invoices.search_placeholder')}
                  className={`w-full ${dir === 'rtl' ? 'pl-10 pr-4' : 'pr-10 pl-4'} py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setView('table')}
                  className={`p-2 rounded-lg transition-all ${view === 'table' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  title={language === 'ar' ? 'عرض الجدول' : 'Table View'}
                >
                  <List size={18} />
                </button>
                <button
                  onClick={() => setView('card')}
                  className={`p-2 rounded-lg transition-all ${view === 'card' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  title={language === 'ar' ? 'عرض الكروت' : 'Card View'}
                >
                  <LayoutGrid size={18} />
                </button>
              </div>
            </div>

            {view === 'table' ? (
              <div ref={tableRef} id="invoices-list-table" className="overflow-x-auto hidden md:block">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/50 text-slate-500 text-[10px] uppercase tracking-widest font-bold">
                      <th className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'} cursor-pointer hover:text-emerald-600 transition-colors group`} onClick={() => handleSort('invoice_number')}>
                        <div className="flex items-center gap-1">
                          {t('invoices.column_number')}
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                            {sortBy === 'invoice_number' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                          </span>
                        </div>
                      </th>
                      <th className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'} cursor-pointer hover:text-emerald-600 transition-colors group`} onClick={() => handleSort('customer_name')}>
                        <div className="flex items-center gap-1">
                          {t('invoices.column_customer')}
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                            {sortBy === 'customer_name' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                          </span>
                        </div>
                      </th>
                      <th className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'} cursor-pointer hover:text-emerald-600 transition-colors group`} onClick={() => handleSort('date')}>
                        <div className="flex items-center gap-1">
                          {t('invoices.column_date')}
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                            {sortBy === 'date' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                          </span>
                        </div>
                      </th>
                      <th className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>وصف الفاتورة</th>
                      <th className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'} cursor-pointer hover:text-emerald-600 transition-colors group`} onClick={() => handleSort('payment_type')}>
                        <div className="flex items-center gap-1">
                          {t('invoices.form_payment_type')}
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                            {sortBy === 'payment_type' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                          </span>
                        </div>
                      </th>
                      <th className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>حالة الدفع</th>
                      <th className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'} cursor-pointer hover:text-emerald-600 transition-colors group`} onClick={() => handleSort('total_amount')}>
                        <div className="flex items-center gap-1">
                          {t('invoices.column_amount')}
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                            {sortBy === 'total_amount' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                          </span>
                        </div>
                      </th>
                      <th className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{language === 'ar' ? 'رقم القيد' : 'Entry No.'}</th>
                      <th className={`px-6 py-4 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>{t('invoices.column_actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredInvoices.map((inv) => (
                      <tr 
                        key={inv.id} 
                        className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                        onClick={() => canEdit && openEditModal(inv)}
                      >
                        <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                          <span className="font-mono text-xs bg-emerald-50 px-2 py-1 rounded text-emerald-700 font-bold border border-emerald-100">{inv.invoice_number}</span>
                        </td>
                        <td className={`px-6 py-4 font-bold text-slate-900 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                          <div>{inv.customer_name}</div>
                          {inv.source_orders && (
                            <div className="text-[10px] text-emerald-600 font-bold mt-0.5 font-mono">
                              {language === 'ar' ? 'أوامر بيع: ' : 'Orders: '}{inv.source_orders}
                            </div>
                          )}
                        </td>
                        <td className={`px-6 py-4 text-slate-500 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{formatDate(inv.date)}</td>
                        <td className={`px-6 py-4 text-slate-500 max-w-[200px] truncate ${dir === 'rtl' ? 'text-right' : 'text-left'}`} title={inv.description}>
                          {inv.description || '-'}
                        </td>
                        <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            inv.payment_type === 'cash' 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {inv.payment_type === 'cash' ? 'نقدي' : 'آجل'}
                          </span>
                        </td>
                        <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                          {(() => {
                            const status = getPaymentStatus(inv);
                            const statusLabels = {
                              paid: language === 'ar' ? 'مدفوعة' : 'Paid',
                              partial: language === 'ar' ? 'مدفوعة جزئياً' : 'Partially Paid',
                              unpaid: language === 'ar' ? 'غير مدفوعة' : 'Unpaid'
                            };
                            const statusClasses = {
                              paid: 'bg-emerald-100 text-emerald-805 text-emerald-800 border-emerald-200',
                              partial: 'bg-blue-100 text-blue-805 text-blue-800 border-blue-200',
                              unpaid: 'bg-red-100 text-red-805 text-red-800 border-red-200'
                            };
                            return (
                              <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${statusClasses[status]}`}>
                                {statusLabels[status]}
                              </span>
                            );
                          })()}
                        </td>
                        <td className={`px-6 py-4 font-bold text-slate-900 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                          {formatMoney(inv.total_amount)} {t('invoices.currency')}
                        </td>
                        <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                          {inv.entry_number ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPendingViewDoc({ type: 'journal', idOrNumber: inv.entry_number! });
                                setCurrentPage('journal_entries');
                              }}
                              className="text-emerald-600 hover:text-emerald-700 hover:underline font-mono text-xs font-bold bg-emerald-50 px-2 py-1 rounded border border-emerald-100/50 transition-all active:scale-95"
                            >
                              {inv.entry_number}
                            </button>
                          ) : (
                            <span className="text-slate-400 font-mono text-xs">-</span>
                          )}
                        </td>
                        <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>
                          <div className={`flex items-center ${dir === 'rtl' ? 'justify-start' : 'justify-end'} gap-2 opacity-0 group-hover:opacity-100 transition-opacity`}>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setActivityLogDocumentId(inv.id);
                                setIsActivityLogOpen(true);
                              }}
                              className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all no-pdf"
                              title={t('common.activity_log')}
                            >
                              <History size={18} />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewInvoice(inv);
                              }}
                              className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all no-pdf"
                              title={t('common.view')}
                            >
                              <Eye size={18} />
                            </button>
                            {canEdit && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditModal(inv);
                                }}
                                className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all no-pdf"
                                title={t('common.edit')}
                              >
                                <Pencil size={18} />
                              </button>
                            )}
                            {canDelete && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(inv.id);
                                }}
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all no-pdf"
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
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-500 italic font-medium">{t('common.no_data')}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredInvoices.map((inv) => (
                  <div 
                    key={inv.id} 
                    onClick={() => canEdit && openEditModal(inv)}
                    className="p-6 bg-slate-50/50 rounded-3xl border border-slate-100 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5 transition-all group relative overflow-hidden cursor-pointer"
                  >
                    <div className="absolute top-4 left-4 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewInvoice(inv);
                        }}
                        className="p-2 bg-white text-emerald-500 rounded-xl border border-emerald-50 shadow-sm hover:bg-emerald-50 transition-all font-bold"
                      >
                        <Eye size={16} />
                      </button>
                      {canEdit && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(inv);
                          }}
                          className="p-2 bg-white text-blue-500 rounded-xl border border-blue-50 shadow-sm hover:bg-blue-50 transition-all font-bold"
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                      {canDelete && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(inv.id);
                          }}
                          className="p-2 bg-white text-red-500 rounded-xl border border-red-50 shadow-sm hover:bg-red-50 transition-all font-bold"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>

                    <div className="flex justify-between items-start">
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-[10px] bg-white px-2 py-1 rounded text-emerald-700 font-bold w-fit border border-emerald-100">{inv.invoice_number}</span>
                        <h4 className="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors text-xl mt-1 tracking-tight">{inv.customer_name}</h4>
                      </div>
                      {inv.entry_number && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingViewDoc({ type: 'journal', idOrNumber: inv.entry_number! });
                            setCurrentPage('journal_entries');
                          }}
                          className="font-mono text-[9px] bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded text-emerald-700 font-bold border border-emerald-100/50 transition-all active:scale-95 z-10"
                        >
                          {inv.entry_number}
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200/50 mt-4">
                      <div className="space-y-1">
                        <p className="text-slate-400 text-[10px] uppercase font-black tracking-widest">التاريخ</p>
                        <p className="text-slate-900 font-bold text-sm tracking-tight">{formatDate(inv.date)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-slate-400 text-[10px] uppercase font-black tracking-widest">الحالة</p>
                        {(() => {
                          const status = getPaymentStatus(inv);
                          const statusLabels = {
                            paid: language === 'ar' ? 'مدفوعة' : 'Paid',
                            partial: language === 'ar' ? 'مدفوعة جزئياً' : 'Partially Paid',
                            unpaid: language === 'ar' ? 'غير مدفوعة' : 'Unpaid'
                          };
                          const statusClasses = {
                            paid: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                            partial: 'bg-blue-100 text-blue-800 border-blue-200',
                            unpaid: 'bg-red-100 text-red-800 border-red-200'
                          };
                          return (
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[8px] font-bold border ${statusClasses[status]}`}>
                              {statusLabels[status]}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="col-span-2 space-y-1 mt-1 pt-3 border-t border-slate-200/50 flex justify-between items-end">
                        <div>
                          <p className="text-slate-400 text-[10px] uppercase font-black tracking-widest">إجمالي المبلغ</p>
                          <p className="font-black text-2xl tracking-tighter text-emerald-600">
                            {formatMoney(inv.total_amount)} <span className="text-sm font-bold">{t('invoices.currency')}</span>
                          </p>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActivityLogDocumentId(inv.id);
                            setIsActivityLogOpen(true);
                          }}
                          className="p-2 text-slate-400 hover:text-emerald-500 bg-white border border-slate-100 rounded-xl transition-all"
                          title={t('common.activity_log')}
                        >
                          <History size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredInvoices.length === 0 && !loading && (
                  <div className="col-span-full p-12 text-center text-slate-500 font-bold italic">{t('common.no_data')}</div>
                )}
              </div>
            )}

            {/* Mobile List View */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredInvoices.map((inv) => (
                <div 
                  key={inv.id} 
                  onClick={() => canEdit && openEditModal(inv)}
                  className="p-4 space-y-4 cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] bg-emerald-50 px-2 py-1 rounded text-emerald-700 font-bold w-fit border border-emerald-100">{inv.invoice_number}</span>
                        {inv.entry_number && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingViewDoc({ type: 'journal', idOrNumber: inv.entry_number! });
                              setCurrentPage('journal_entries');
                            }}
                            className="font-mono text-[9px] bg-emerald-50 px-2 py-1 rounded text-emerald-700 font-bold border border-emerald-100/50"
                          >
                            {inv.entry_number}
                          </button>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider ${
                          inv.payment_type === 'cash' 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {inv.payment_type === 'cash' ? 'نقدي' : 'آجل'}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-lg">{inv.customer_name}</h4>
                    </div>
                      <div className={`${dir === 'rtl' ? 'text-left' : 'text-right'}`}>
                        <p className="font-bold text-emerald-600 text-lg">{formatMoney(inv.total_amount)} {t('invoices.currency')}</p>
                        <span className="text-xs text-slate-400">{formatDate(inv.date)}</span>
                      </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={() => handleViewInvoice(inv)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-50 text-slate-600 rounded-2xl text-sm font-bold border border-slate-100 active:scale-95 transition-transform"
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

            <PaginationControls 
              page={page} 
              limit={limit} 
              total={totalRecords} 
              onPageChange={setPage} 
              onLimitChange={setLimit} 
            />
          </div>
        </>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden animate-in slide-in-from-bottom-4 duration-300 flex flex-col min-h-[80vh] relative">
          {/* Form Header */}
          <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-[70]">
            <div className="flex items-center gap-3">
              <button 
                onClick={closeModal} 
                className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all font-black text-sm"
              >
                <ChevronRight size={20} />
                <span>العودة للقائمة</span>
              </button>
            </div>

              <div className="flex-1 flex justify-center">
                <button 
                  type="button"
                  onClick={() => setShowSidePanel(!showSidePanel)}
                  className={`flex items-center gap-3 px-6 py-2.5 rounded-2xl text-sm font-black transition-all border shadow-sm ${showSidePanel ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-zinc-50'}`}
                >
                  <History size={18} />
                  <span>قيد اليومية \ سجل التعديلات</span>
                </button>
              </div>

              <div className="flex items-center gap-4">
                {editingInvoice && (
                  <div className="hidden lg:flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl">
                    <button 
                      type="button"
                      onClick={handlePrevInvoice}
                      className="flex items-center gap-1 px-3 py-1.5 hover:bg-white rounded-xl transition-all text-slate-600 disabled:opacity-30 text-xs font-black"
                      disabled={invoices.findIndex(inv => inv.id === editingInvoice.id) === 0}
                    >
                      <ChevronRight size={16} />
                      السابق
                    </button>
                    <button 
                      type="button"
                      onClick={handleNextInvoice}
                      className="flex items-center gap-1 px-3 py-1.5 hover:bg-white rounded-xl transition-all text-slate-600 disabled:opacity-30 text-xs font-black"
                      disabled={invoices.findIndex(inv => inv.id === editingInvoice.id) === invoices.length - 1}
                    >
                      التالي
                      <ChevronLeft size={16} />
                    </button>
                  </div>
                )}
                <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">{editingInvoice ? 'تعديل الفاتورة' : 'إنشاء فاتورة جديدة'}</h3>
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
                    <div className="h-full bg-white border-r border-slate-100 flex flex-col">
                      <div className="p-4 border-b border-slate-100 flex items-center justify-between lg:hidden">
                        <h3 className="font-bold text-slate-900">سجل النشاط والقيد</h3>
                        <button onClick={() => setShowSidePanel(false)} className="p-2 text-slate-400 hover:text-slate-600">
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

                  <form id="invoice-form" onSubmit={handleSubmit} className="space-y-8">
                    {/* Card 1: المعلومات الأساسية */}
                    <section className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm space-y-6 relative pt-12">
                      {editingInvoice && (
                        <div className={`absolute ${dir === 'rtl' ? 'left-12' : 'right-12'} top-4 z-20 pointer-events-none select-none opacity-80 transform -rotate-12`}>
                          {(() => {
                            const status = getPaymentStatus(editingInvoice);
                            const statusLabels = {
                              paid: language === 'ar' ? 'مدفوعة' : 'Paid',
                              partial: language === 'ar' ? 'مدفوعة جزئياً' : 'Partially Paid',
                              unpaid: language === 'ar' ? 'غير مدفوعة' : 'Unpaid'
                            };
                            const statusColors = {
                              paid: 'text-emerald-600 border-emerald-600 bg-emerald-50/70',
                              partial: 'text-blue-600 border-blue-600 bg-blue-50/70',
                              unpaid: 'text-red-500 border-red-500 bg-red-50/70'
                            };
                            const colorClass = statusColors[status] || statusColors.unpaid;
                            return (
                              <div className={`px-6 py-2 border-y-2 border-dashed ${colorClass} font-black text-xl tracking-widest uppercase rounded`}>
                                {statusLabels[status]}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                      <div className="absolute top-4 right-4 flex items-center gap-2 text-emerald-600 bg-emerald-50/50 px-3 py-1 rounded-full border border-emerald-100">
                        <FileText className="w-4 h-4" />
                        <span className="text-xs font-bold">invoices.basic_info</span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="order-3 md:order-1">
                          <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">{t('invoices.column_date')}</label>
                          <div className="relative">
                            <input
                              required
                              type="date"
                              className={`w-full ${dir === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3 rounded-2xl bg-zinc-50 border border-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 text-sm`}
                              value={date}
                              onChange={(e) => setDate(e.target.value)}
                            />
                            <Calendar className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                          </div>
                        </div>

                        <div className="order-2 md:order-2 lg:col-span-1">
                          <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">{t('invoices.form_customer')} {selectedCustomerId ? `(ID: ${selectedCustomerId.slice(-4)})` : ''}</label>
                          <div className="relative group">
                            <select 
                              required
                              className={`w-full ${dir === 'rtl' ? 'pr-12' : 'pl-12'} py-3 rounded-2xl bg-zinc-50 border border-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 appearance-none cursor-pointer text-sm`}
                              value={selectedCustomerId}
                              onChange={(e) => {
                                if (e.target.value === 'new_customer') {
                                  setIsCustomerModalOpen(true);
                                } else {
                                  setSelectedCustomerId(e.target.value);
                                  setFormSettlements([]);
                                  setFormSettlementNumber('');
                                }
                              }}
                            >
                              <option value="">{t('common.select_customer')}</option>
                              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              <option value="new_customer" className="font-bold text-emerald-600 italic">+ {t('customers.add')}</option>
                            </select>
                            <Building2 className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                            <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                          </div>
                        </div>

                        {invoiceType === 'items' && (
                          <div className="order-3 md:order-3 lg:col-span-1">
                            <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">{language === 'ar' ? 'المخزن' : 'Warehouse'}</label>
                            <div className="relative group">
                              <select 
                                required
                                className={`w-full ${dir === 'rtl' ? 'pr-12' : 'pl-12'} py-3 rounded-2xl bg-zinc-50 border border-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 appearance-none cursor-pointer text-sm`}
                                value={selectedWarehouseId}
                                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                              >
                                <option value="">{language === 'ar' ? 'اختر المخزن' : 'Select Warehouse'}</option>
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                              </select>
                              <Box className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                              <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                            </div>
                          </div>
                        )}

                        <div className={`order-1 ${invoiceType === 'items' ? 'md:order-4' : 'md:order-3'}`}>
                          <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">{t('invoices.column_number')}</label>
                          <div className="relative">
                            <input
                              required
                              type="text"
                              readOnly
                              className={`w-full ${dir === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3 rounded-2xl bg-zinc-100 border border-zinc-200 cursor-not-allowed outline-none font-bold text-zinc-500 text-sm`}
                              value={invoiceNumber}
                            />
                            <Hash className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                          </div>
                        </div>

                        {editingInvoice?.entry_number && (
                          <div className="order-1 md:order-5">
                            <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">{language === 'ar' ? 'رقم القيد المرتبط' : 'Linked Journal Entry'}</label>
                            <div className="relative">
                              <input
                                readOnly
                                type="text"
                                className={`w-full ${dir === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3 rounded-2xl bg-emerald-50 border border-emerald-200 outline-none font-bold text-emerald-800 text-sm`}
                                value={editingInvoice.entry_number}
                              />
                              <Layers className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-emerald-500 pointer-events-none`} />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="pt-4 border-t border-zinc-100">
                        <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">{language === 'ar' ? 'موضوع الفاتورة' : 'Invoice Subject'}</label>
                        <textarea
                          className="w-full px-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 min-h-[100px] resize-none text-sm placeholder:text-zinc-300"
                          placeholder={language === 'ar' ? 'أدخل وصفاً عاماً يظهر في أعلى الفاتورة...' : 'Enter a general description...'}
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                        />
                      </div>

                      {pendingOrders.length > 0 && (
                        <div className="pt-4 border-t border-zinc-100 space-y-3">
                          <label className="block text-xs font-bold text-emerald-600 tracking-tighter px-2 uppercase flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            {language === 'ar' ? 'ربط بأوامر البيع المعلقة' : 'Link Pending Sales Orders'}
                          </label>
                          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 overflow-hidden">
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs text-right">
                                <thead>
                                  <tr className="text-zinc-400 font-bold border-b border-zinc-200 pb-2">
                                    <th className="py-2 text-center w-10"></th>
                                    <th className="py-2 text-right">{language === 'ar' ? 'رقم الأمر' : 'Order No'}</th>
                                    <th className="py-2 text-right">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                                    <th className="py-2 text-right">{language === 'ar' ? 'الإجمالي' : 'Total'}</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100">
                                  {pendingOrders.map(order => (
                                    <tr key={order.id} className="hover:bg-zinc-100/50">
                                      <td className="py-3 text-center">
                                        <input 
                                          type="checkbox"
                                          checked={selectedOrderIds.includes(order.id)}
                                          onChange={(e) => handleOrderCheckboxChange(order.id, e.target.checked)}
                                          className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                                        />
                                      </td>
                                      <td className="py-3 font-mono text-emerald-700 font-bold">{order.order_number}</td>
                                      <td className="py-3 text-zinc-500">{formatDate(order.date)}</td>
                                      <td className="py-3 text-zinc-900 font-bold">{formatMoney(order.total_amount)} {t('invoices.currency')}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}
                    </section>

                    {/* Card 2: إعدادات الدفع */}
                    <section className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm space-y-6 relative pt-12">
                      <div className="absolute top-4 right-4 flex items-center gap-2 text-emerald-600 bg-emerald-50/50 px-3 py-1 rounded-full border border-emerald-100">
                        <Wallet className="w-4 h-4" />
                        <span className="text-xs font-bold">invoices.payment_settings</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6">
                        <button 
                          type="button"
                          onClick={() => setPaymentType('cash')}
                          className={`flex-1 py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-3 border ${paymentType === 'cash' ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg scale-[1.02]' : 'bg-zinc-50 text-zinc-500 border-zinc-200 hover:bg-zinc-100'}`}
                        >
                          <Wallet size={18} />
                          {t('invoices.payment_cash')}
                        </button>
                        <button 
                          type="button"
                          onClick={() => setPaymentType('credit')}
                          className={`flex-1 py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-3 border ${paymentType === 'credit' ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg scale-[1.02]' : 'bg-zinc-50 text-zinc-500 border-zinc-200 hover:bg-zinc-100'}`}
                        >
                          <CreditCard size={18} />
                          {t('invoices.payment_credit')}
                        </button>
                      </div>

                      {paymentType === 'cash' && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pt-6 border-t border-zinc-100">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <label className="block text-sm font-medium text-zinc-700 mb-2">{t('invoices.form_payment_method')}</label>
                              <div className="relative group">
                                <CreditCard className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-3 w-4 h-4 text-zinc-400 Transition-colors`} />
                                <select 
                                  required
                                  className={`w-full ${dir === 'rtl' ? 'pr-10' : 'pl-10'} py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 appearance-none cursor-pointer`}
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
                                  <option value="new_payment_method" className="font-bold text-emerald-600 italic">+ {t('payment_methods.add')}</option>
                                </select>
                                <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-3' : 'right-3'} top-3 w-4 h-4 text-zinc-400 pointer-events-none`} />
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {paymentType === 'credit' && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pt-6 border-t border-zinc-100">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <label className="block text-sm font-bold text-zinc-700 mb-2">
                                {language === 'ar' ? 'شروط السداد' : 'Payment Terms'}
                              </label>
                              <div className="relative group">
                                <Calendar className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-3.5 w-4 h-4 text-zinc-400 pointer-events-none`} />
                                <select 
                                  className={`w-full ${dir === 'rtl' ? 'pr-10' : 'pl-10'} py-2.5 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 appearance-none cursor-pointer`}
                                  value={paymentTerms}
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
                                    
                                    setPaymentTerms(term);
                                    setPaymentTermsDays(days);
                                    setAdvancePercentage(pct);
                                  }}
                                >
                                  <option value="cash">{language === 'ar' ? 'نقدي عند التسليم' : 'Cash on Delivery'}</option>
                                  <option value="due_on_receipt">{language === 'ar' ? 'مستحق فور استلام الفاتورة' : 'Due on Receipt'}</option>
                                  <option value="net_7">{language === 'ar' ? 'خلال 7 أيام' : 'Net 7 Days'}</option>
                                  <option value="net_15">{language === 'ar' ? 'خلال 15 يوماً' : 'Net 15 Days'}</option>
                                  <option value="net_30">{language === 'ar' ? 'خلال 30 يوماً' : 'Net 30 Days'}</option>
                                  <option value="net_45">{language === 'ar' ? 'خلال 45 يوماً' : 'Net 45 Days'}</option>
                                  <option value="net_60">{language === 'ar' ? 'خلال 60 يوماً' : 'Net 60 Days'}</option>
                                  <option value="net_90">{language === 'ar' ? 'خلال 90 يوماً' : 'Net 90 Days'}</option>
                                  <option value="net_180">{language === 'ar' ? 'خلال 180 يوماً' : 'Net 180 Days'}</option>
                                  <option value="eom">{language === 'ar' ? 'نهاية الشهر (EOM)' : 'End of Month (EOM)'}</option>
                                  <option value="eom_30">{language === 'ar' ? 'السداد بعد 30 يوم من نهاية الشهر' : '30 Days EOM'}</option>
                                  <option value="advance">{language === 'ar' ? 'دفعة مقدمة قبل التوريد' : 'Advance Payment (100%)'}</option>
                                  <option value="advance_50_50">{language === 'ar' ? '50% مقدم والباقي عند التسليم' : '50% Advance / 50% on Delivery'}</option>
                                  <option value="custom">{language === 'ar' ? 'مخصص (أيام / نسب مقدمة مخصصة)' : 'Custom Days & Percentage'}</option>
                                </select>
                                <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-3' : 'right-3'} top-3.5 w-4 h-4 text-zinc-400 pointer-events-none`} />
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-bold text-zinc-700 mb-2">
                                {language === 'ar' ? 'تاريخ الاستحقاق' : 'Due Date'}
                              </label>
                              <div className="relative">
                                <input
                                  type="date"
                                  className="w-full px-4 py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800"
                                  value={dueDate}
                                  onChange={(e) => setDueDate(e.target.value)}
                                />
                              </div>
                            </div>

                            {paymentTerms === 'custom' && (
                              <>
                                <div>
                                  <label className="block text-sm font-bold text-zinc-700 mb-2">
                                    {language === 'ar' ? 'فترة السداد بالأيام' : 'Payment Terms (Days)'}
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    className="w-full px-4 py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800"
                                    value={paymentTermsDays}
                                    onChange={(e) => setPaymentTermsDays(Number(e.target.value) || 0)}
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-bold text-zinc-700 mb-2">
                                    {language === 'ar' ? 'نسبة الدفعة المقدمة %' : 'Advance Percentage %'}
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    className="w-full px-4 py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800"
                                    value={advancePercentage}
                                    onChange={(e) => setAdvancePercentage(Number(e.target.value) || 0)}
                                  />
                                </div>
                              </>
                            )}
                          </div>
                        </motion.div>
                      )}

                      {/* Credit Limit Warning Banner */}
                      {paymentType === 'credit' && selectedCustomerId && (() => {
                        const currentCustomer = customers.find(c => c.id === selectedCustomerId);
                        const totalInvoiceAmount = items.reduce((sum, i) => sum + (Number(i.total) || 0), 0) - discount;
                        const customerBalance = getCustomerBalance(selectedCustomerId);
                        const totalTentativeBalance = customerBalance + totalInvoiceAmount;
                        
                        if (currentCustomer && currentCustomer.credit_limit > 0 && totalTentativeBalance > currentCustomer.credit_limit) {
                          return (
                            <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 animate-in fade-in slide-in-from-top-2 duration-300">
                              <span className="text-xl">⚠️</span>
                              <div className="flex-1 text-sm font-medium">
                                <p className="font-bold text-rose-950 mb-1">
                                  {language === 'ar' ? 'تنبيه: تجاوز حد الائتمان!' : 'Warning: Credit Limit Exceeded!'}
                                </p>
                                <p>
                                  {language === 'ar' 
                                    ? `سيؤدي حفظ هذه الفاتورة إلى تجاوز حد الائتمان المسموح به للعميل (${formatMoney(currentCustomer.credit_limit)}). الرصيد الحالي للعميل: ${formatMoney(customerBalance)} + إجمالي الفاتورة: ${formatMoney(totalInvoiceAmount)} = الإجمالي المتوقع: ${formatMoney(totalTentativeBalance)}.`
                                    : `Saving this invoice will exceed the customer's credit limit (${formatMoney(currentCustomer.credit_limit)}). Current balance: ${formatMoney(customerBalance)} + Invoice total: ${formatMoney(totalInvoiceAmount)} = Tentative total: ${formatMoney(totalTentativeBalance)}.`}
                                </p>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* Currency Selection - REMOVED */}
                    </section>

                    {/* Card 3: الأصناف */}
                    <section className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm space-y-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                        <div className="flex items-center gap-2 text-emerald-600">
                          <Package className="w-5 h-5" />
                          <h2 className="font-semibold text-zinc-900">{t('invoices.form_items')}</h2>
                        </div>

                        <div className="flex gap-2 bg-zinc-50 p-1 rounded-lg border border-zinc-200">
                          <button 
                            type="button"
                            onClick={() => {
                              setInvoiceType('items');
                              setItems([]);
                            }}
                            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${invoiceType === 'items' ? 'bg-white text-emerald-600 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`}
                          >
                            مبيعات سلع
                          </button>
                          <button 
                            type="button"
                            onClick={() => {
                              setInvoiceType('services');
                              setItems([]);
                            }}
                            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${invoiceType === 'services' ? 'bg-white text-emerald-600 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`}
                          >
                            مبيعات خدمات
                          </button>
                        </div>

                        <button 
                          type="button"
                          onClick={() => addEmptyRow()}
                          className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-sm text-sm"
                        >
                          <Plus size={18} />
                          {t('invoices.form_add_item')}
                        </button>
                      </div>

                      <div className="overflow-x-auto rounded-xl border border-zinc-200 overflow-hidden">
                        <table className="w-full text-sm text-right border-collapse">
                          <thead>
                            <tr className="bg-zinc-50 border-b border-zinc-200">
                              <th className="px-6 py-4 font-bold text-zinc-700">{t('invoices.item_name')}</th>
                              <th className="px-6 py-4 font-bold text-zinc-700 w-24">صورة</th>
                              <th className="px-6 py-4 font-bold text-zinc-700 w-32">باركود</th>
                              <th className="px-6 py-4 font-bold text-zinc-700 w-32">{t('invoices.item_quantity')}</th>
                              <th className="px-6 py-4 font-bold text-zinc-700 w-40">{t('invoices.item_price')}</th>
                              <th className="px-6 py-4 font-bold text-zinc-700 w-40">{t('invoices.item_total')}</th>
                              <th className="px-6 py-4 w-20"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100">
                            {items.map((item, index) => (
                              <tr key={index} className="group hover:bg-zinc-50 transition-colors">
                                <td className="px-6 py-4">
                                  {invoiceType === 'items' ? (
                                    <div className="relative">
                                      <select 
                                        className="w-full bg-white border border-zinc-200 rounded-lg px-4 py-2 outline-none font-bold text-zinc-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 appearance-none transition-all"
                                        value={item.product_id}
                                        onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                                      >
                                        <option value="">{t('common.select_product')}</option>
                                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                      </select>
                                      <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-3' : 'right-3'} top-3 w-4 h-4 text-zinc-400 pointer-events-none`} />
                                    </div>
                                  ) : (
                                    <input 
                                      type="text" 
                                      className="w-full bg-white border border-zinc-200 rounded-lg px-4 py-2 outline-none font-bold text-zinc-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-bold"
                                      placeholder="وصف الخدمة..."
                                      value={item.product_name || ''}
                                      onChange={(e) => updateItem(index, 'product_name', e.target.value)}
                                    />
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex flex-col items-center gap-1">
                                    {item.image_url ? (
                                      <div className="relative group w-10 h-10">
                                        <img src={item.image_url} alt="" className="w-full h-full object-cover rounded shadow-sm" referrerPolicy="no-referrer" />
                                        <button 
                                          onClick={() => updateItem(index, 'image_url', '')}
                                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                          <X size={8} />
                                        </button>
                                      </div>
                                    ) : (
                                      <label className="cursor-pointer p-2 bg-zinc-50 border border-zinc-200 border-dashed rounded-lg hover:bg-zinc-100 transition-colors">
                                        <ImageIcon size={16} className="text-zinc-400" />
                                        <input 
                                          type="file" 
                                          className="hidden" 
                                          accept="image/*" 
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                              const reader = new FileReader();
                                              reader.onloadend = () => updateItem(index, 'image_url', reader.result as string);
                                              reader.readAsDataURL(file);
                                            }
                                          }} 
                                        />
                                      </label>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex flex-col items-center gap-1">
                                    <input 
                                      type="text" 
                                      placeholder="الباركود..."
                                      className="w-full bg-white border border-zinc-200 rounded-lg px-2 py-1 text-center font-bold text-xs text-zinc-800 outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-mono"
                                      value={item.barcode || ''}
                                      onChange={(e) => updateItem(index, 'barcode', e.target.value)}
                                    />
                                    {item.barcode && (
                                      <div className="mt-1 bg-white p-1 rounded border border-zinc-100 shadow-sm">
                                        <Barcode 
                                          value={item.barcode} 
                                          width={0.6} 
                                          height={15} 
                                          fontSize={6}
                                          margin={0}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <input 
                                    type="number" 
                                    className="w-full bg-white border border-zinc-200 rounded-lg px-4 py-2 text-center font-bold text-zinc-800 outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold"
                                    value={item.quantity}
                                    onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                  />
                                </td>
                                <td className="px-6 py-4">
                                  <input 
                                    type="number" 
                                    className="w-full bg-white border border-zinc-200 rounded-lg px-4 py-2 text-center font-bold text-zinc-800 outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold"
                                    value={item.unit_price}
                                    onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                                  />
                                </td>
                                <td className="px-6 py-4 text-left font-black text-emerald-600 text-lg">
                                  {formatMoney(item.total)}
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <button 
                                    type="button"
                                    onClick={() => removeItem(index)}
                                    className="p-2 text-zinc-300 hover:text-emerald-500 transition-colors"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {items.length === 0 && (
                              <tr>
                                <td colSpan={8} className="px-6 py-12 text-center text-zinc-400 italic">
                                  {t('common.no_items')}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>

                    {/* Totals & Notes Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <section className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm space-y-6">
                        <div className="flex items-center gap-2 mb-4 text-emerald-600">
                          <Layers className="w-5 h-5" />
                          <h2 className="font-semibold text-zinc-900">ملخص الفاتورة</h2>
                        </div>

                        <div className="bg-zinc-50 rounded-lg p-6 border border-zinc-100 space-y-4">
                          <div className="flex justify-between items-center text-zinc-600">
                            <span className="font-medium text-sm">{t('invoices.summary_subtotal')}</span>
                            <span className="font-bold text-lg">
                              {formatMoney(items.reduce((sum, i) => sum + (Number(i.total) || 0), 0))}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-emerald-600">
                            <div className="flex items-center gap-4">
                              <span className="font-medium text-sm">{t('invoices.summary_discount')}</span>
                              <input 
                                type="number" 
                                className="w-24 bg-white border border-zinc-200 rounded-lg px-2 py-1 text-center font-bold text-emerald-600 focus:ring-2 focus:ring-emerald-500 outline-none"
                                value={Number(discount)}
                                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                              />
                            </div>
                            <span className="font-bold text-lg">-{formatMoney(discount)}</span>
                          </div>
                          <div className="flex justify-between items-center text-emerald-600">
                            <span className="font-black text-lg">{t('invoices.summary_total')}</span>
                            <div className="flex flex-col items-end">
                              <span className="font-black text-2xl tracking-tighter text-left">
                                {formatMoney(items.reduce((sum, i) => sum + (Number(i.total) || 0), 0) - discount)} {companyData?.settings?.currency || ''}
                              </span>
                            </div>
                          </div>
                        </div>
                      </section>

                      {/* Notes Card */}
                      <section className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm space-y-6">
                        <div className="flex items-center gap-2 mb-4 text-emerald-600">
                          <Tag className="w-5 h-5" />
                          <h2 className="font-semibold text-zinc-900">{language === 'ar' ? 'الملاحظات' : 'Notes'}</h2>
                        </div>
                        <textarea 
                          className="w-full min-h-[150px] bg-zinc-50 border border-zinc-200 rounded-lg p-4 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all font-medium text-zinc-700 font-bold"
                          placeholder={language === 'ar' ? 'أدخل أي ملاحظات إضافية هنا...' : 'Enter any additional notes...'}
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                        />
                      </section>
                    </div>

                    {/* Settlements Table Card in Form */}
                    {selectedCustomerId && paymentType === 'credit' && (() => {
                      const invoiceGrandTotal = Math.max(0, items.reduce((sum, i) => sum + (Number(i.total) || 0), 0) - discount);
                      const openTransactions = getOppositeMovements(selectedCustomerId);
                      if (openTransactions.length === 0) {
                        return (
                          <section className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm space-y-4">
                            <p className="text-zinc-400 text-sm italic py-4 text-center">
                              {language === 'ar' ? 'لا توجد حركات مستحقة للتسوية.' : 'No outstanding transactions for settlement.'}
                            </p>
                          </section>
                        );
                      }
                      return (
                        <section className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm space-y-4">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
                            <div className="flex items-center gap-2 text-emerald-600">
                              <Layers className="w-5 h-5" />
                              <h2 className="font-semibold text-zinc-900">
                                {language === 'ar' ? 'جدول تسويات الفاتورة' : 'Invoice Settlements Table'}
                              </h2>
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-xs font-bold font-mono">
                              <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100 text-xs font-sans">
                                <span>{language === 'ar' ? 'إجمالي المسوى:' : 'Total Settled:'}</span>
                                <span>{formatMoney(formSettlements.reduce((sum, s) => sum + Number(s.settled_amount), 0))} {companyData?.settings?.currency || ''}</span>
                              </div>
                              <div className="flex items-center gap-2 bg-slate-50 text-slate-700 px-3 py-1 rounded-full border border-slate-200 text-xs font-sans">
                                <span>{language === 'ar' ? 'الفرق:' : 'Difference:'}</span>
                                <span>{formatMoney(Math.max(0, invoiceGrandTotal - formSettlements.reduce((sum, s) => sum + Number(s.settled_amount), 0)))} {companyData?.settings?.currency || ''}</span>
                              </div>
                            </div>
                          </div>

                          <div className="overflow-x-auto">
                            <table className={`w-full text-sm ${dir === 'rtl' ? 'text-right' : 'text-left'} border-collapse`}>
                              <thead>
                                <tr className="border-b border-zinc-100 text-zinc-400 text-xs font-bold uppercase tracking-wider">
                                  <th className="pb-2 text-right">{language === 'ar' ? 'رقم القيد' : 'Entry No'}</th>
                                  <th className="pb-2 text-right">{language === 'ar' ? 'نوع الحركة' : 'Type'}</th>
                                  <th className="pb-2 text-right">{language === 'ar' ? 'رقم الحركة / المرجع' : 'Ref No'}</th>
                                  <th className="pb-2 text-right">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                                  <th className="pb-2 text-right">{language === 'ar' ? 'رقم التسوية' : 'Settlement No'}</th>
                                  <th className="pb-2 text-right">{language === 'ar' ? 'تاريخ التسوية' : 'Settlement Date'}</th>
                                  <th className="pb-2 text-right">{language === 'ar' ? 'المبلغ الأصلي' : 'Original Amt'}</th>
                                  <th className="pb-2 text-right">{language === 'ar' ? 'المبلغ المفتوح' : 'Open Amt'}</th>
                                  <th className="pb-2 text-center w-24">{language === 'ar' ? 'تسوية كاملة' : 'Full Settle'}</th>
                                  <th className="pb-2 text-center w-32">{language === 'ar' ? 'تسوية بمبلغ الدفعة' : 'Settle with Payment'}</th>
                                  <th className="pb-2 text-center w-32">{language === 'ar' ? 'تسوية جزئية' : 'Partial Settle'}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-50 text-zinc-700 font-bold">
                                {openTransactions.map((t: any) => {
                                  const settlement = formSettlements.find((s: any) => s.target_id === t.id);
                                  const settledAmount = settlement ? Number(settlement.settled_amount) : 0;
                                  const isFullySettled = Math.abs(settledAmount - t.open_amount) < 0.01;

                                  const otherSettledSum = formSettlements.filter((s: any) => s.target_id !== t.id).reduce((sum: number, s: any) => sum + Number(s.settled_amount), 0);
                                  const remainingInvoiceAmount = Math.max(0, invoiceGrandTotal - otherSettledSum);
                                  const maxAllocation = Math.min(remainingInvoiceAmount, t.open_amount);
                                  const isInvoiceAmountSettled = settledAmount > 0 && Math.abs(settledAmount - maxAllocation) < 0.01;

                                  return (
                                    <tr key={t.id} className="hover:bg-zinc-50/50 transition-colors">
                                      <td className="py-2.5">
                                        {t.je_number && t.je_number !== '-' ? (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              closeModal();
                                              setPendingViewDoc({ type: 'journal', idOrNumber: t.je_number });
                                              setCurrentPage('journal_entries');
                                            }}
                                            className="text-emerald-600 hover:text-emerald-700 hover:underline font-mono font-black"
                                          >
                                            {t.je_number}
                                          </button>
                                        ) : (
                                          <span className="text-zinc-400 font-mono font-normal">-</span>
                                        )}
                                      </td>
                                      <td className="py-2.5 text-zinc-500 font-semibold">{t.type_label}</td>
                                      <td className="py-2.5">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            closeModal();
                                            setPendingViewDoc({ type: t.page_name === 'journal_entries' ? 'journal' : t.page_name === 'receipts' ? 'receipt' : t.page_name, idOrNumber: t.number });
                                            setCurrentPage(t.page_name);
                                          }}
                                          className="text-emerald-600 hover:text-emerald-700 hover:underline font-mono font-black"
                                        >
                                          {t.number}
                                        </button>
                                      </td>
                                      <td className="py-2.5 text-zinc-400 font-normal font-mono">{formatDate(t.date)}</td>
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
                                          value={rowSettlementDates[t.id] || date.slice(0, 10)}
                                          onChange={(e) => handleRowDateChange(t, e.target.value)}
                                        />
                                      </td>
                                      <td className="py-2.5 text-zinc-500 font-semibold">{formatMoney(t.original_amount)}</td>
                                      <td className="py-2.5 text-zinc-900 font-black">{formatMoney(t.open_amount)}</td>
                                      <td className="py-2.5 text-center">
                                        <input
                                          type="checkbox"
                                          className="w-4 h-4 rounded border-zinc-350 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                          checked={isFullySettled}
                                          onChange={(e) => {
                                            const checked = e.target.checked;
                                            handleSettlementChange(t, checked ? t.open_amount : 0);
                                          }}
                                        />
                                      </td>
                                      <td className="py-2.5 text-center">
                                        <input
                                          type="checkbox"
                                          className="w-4 h-4 rounded border-zinc-350 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                          disabled={maxAllocation <= 0 && settledAmount === 0}
                                          checked={isInvoiceAmountSettled}
                                          onChange={(e) => {
                                            const checked = e.target.checked;
                                            handleSettlementChange(t, checked ? maxAllocation : 0);
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
                                          max={t.open_amount}
                                          onChange={(e) => {
                                            const val = Number(e.target.value);
                                            const cappedVal = Math.min(Math.max(0, val), t.open_amount);
                                            handleSettlementChange(t, cappedVal);
                                          }}
                                        />
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </section>
                      );
                    })()}

                    {/* Actions removed from bottom of scrollable area as they are in the fixed footer */}
                  </form>
                </div>
              </div>
            </div>

            {/* Form Footer */}
            <div className="p-4 md:p-6 border-t border-slate-100 bg-white/80 backdrop-blur-md sticky bottom-0 z-[70] flex items-center justify-between gap-4">
              <button 
                type="button"
                onClick={closeModal}
                className="flex-1 max-w-[200px] py-4 rounded-2xl bg-zinc-100 text-zinc-600 font-black hover:bg-zinc-200 transition-all flex items-center justify-center gap-3 active:scale-95"
              >
                <RotateCcw size={20} />
                إلغاء
              </button>
              <button 
                type="submit"
                form="invoice-form"
                onClick={handleSubmit}
                className="flex-1 py-4 rounded-2xl bg-emerald-600 text-white font-black hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/20 active:scale-95"
              >
                <Save size={20} />
                حفظ
              </button>
            </div>
          </div>
      )}

      {/* View Modal */}
      {viewInvoice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full h-full md:h-auto md:max-w-6xl md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col md:max-h-[90vh] border border-slate-200">
            <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg md:text-xl font-bold text-slate-900">{t('invoices.view_invoice')}</h3>
              <button onClick={() => setViewInvoice(null)} className="p-2 text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row h-full">
              <div ref={invoiceRef} id="invoice-capture-area" className="flex-1 p-6 md:p-8 space-y-8 bg-white overflow-y-auto" style={{ color: '#18181b' }}>
                <CompanyInvoiceHeader 
                  company={companyData} 
                  documentNumber={viewInvoice.invoice_number}
                  documentDate={formatDate(viewInvoice.date)}
                />

                <div className="grid grid-cols-2 gap-8 py-2">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('invoices.invoice_to')}</p>
                    <p className="text-2xl font-black text-slate-900 tracking-tight">{viewInvoice.customer_name}</p>
                    {viewInvoice.customer_id && (
                      <p className="text-xs text-slate-500 font-medium">كود العميل: {viewInvoice.customer_id.slice(-6).toUpperCase()}</p>
                    )}
                    {viewInvoice.source_orders && (
                      <p className="text-xs text-emerald-600 font-bold font-mono">
                        {language === 'ar' ? 'أوامر بيع مرتبطة: ' : 'Linked Orders: '}{viewInvoice.source_orders}
                      </p>
                    )}
                    {viewInvoice.warehouse_id && (
                      <p className="text-xs text-slate-500 font-medium">
                        {language === 'ar' ? 'المخزن:' : 'Warehouse:'} <span className="text-emerald-600 font-bold">{warehouses.find(w => w.id?.toString() === viewInvoice.warehouse_id?.toString())?.name || viewInvoice.warehouse_id}</span>
                      </p>
                    )}
                    {viewInvoice.entry_number && (
                      <p className="text-xs text-slate-500 font-medium mt-1">
                        {language === 'ar' ? 'رقم القيد:' : 'Journal Entry:'} <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewInvoice(null);
                            setPendingViewDoc({ type: 'journal', idOrNumber: viewInvoice.entry_number! });
                            setCurrentPage('journal_entries');
                          }}
                          className="text-emerald-600 hover:text-emerald-700 hover:underline font-mono font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100/50"
                        >
                          {viewInvoice.entry_number}
                        </button>
                      </p>
                    )}
                    {viewInvoice.payment_type === 'credit' && viewInvoice.payment_terms && (
                      <p className="text-xs text-slate-500 font-medium mt-1">
                        {language === 'ar' ? 'شروط السداد:' : 'Payment Terms:'} <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-100/50">
                          {viewInvoice.payment_terms === 'cash' ? (language === 'ar' ? 'نقدي عند التسليم' : 'Cash on Delivery') :
                           viewInvoice.payment_terms === 'due_on_receipt' ? (language === 'ar' ? 'مستحق فور الاستلام' : 'Due on Receipt') :
                           viewInvoice.payment_terms === 'net_7' ? (language === 'ar' ? 'خلال 7 أيام' : 'Net 7 Days') :
                           viewInvoice.payment_terms === 'net_15' ? (language === 'ar' ? 'خلال 15 يوماً' : 'Net 15 Days') :
                           viewInvoice.payment_terms === 'net_30' ? (language === 'ar' ? 'خلال 30 يوماً' : 'Net 30 Days') :
                           viewInvoice.payment_terms === 'net_45' ? (language === 'ar' ? 'خلال 45 يوماً' : 'Net 45 Days') :
                           viewInvoice.payment_terms === 'net_60' ? (language === 'ar' ? 'خلال 60 يوماً' : 'Net 60 Days') :
                           viewInvoice.payment_terms === 'net_90' ? (language === 'ar' ? 'خلال 90 يوماً' : 'Net 90 Days') :
                           viewInvoice.payment_terms === 'net_180' ? (language === 'ar' ? 'خلال 180 يوماً' : 'Net 180 Days') :
                           viewInvoice.payment_terms === 'eom' ? (language === 'ar' ? 'نهاية الشهر' : 'End of Month (EOM)') :
                           viewInvoice.payment_terms === 'eom_30' ? (language === 'ar' ? 'السداد بعد 30 يوم من نهاية الشهر' : '30 Days EOM') :
                           viewInvoice.payment_terms === 'advance' ? (language === 'ar' ? 'دفعة مقدمة قبل التوريد' : 'Advance Payment') :
                           viewInvoice.payment_terms === 'advance_50_50' ? (language === 'ar' ? '50% مقدم والباقي عند التسليم' : '50% Advance / 50% Delivery') :
                           (language === 'ar' ? `مخصص (${viewInvoice.payment_terms_days} يوم)` : `Custom (${viewInvoice.payment_terms_days} Days)`)}
                        </span>
                      </p>
                    )}
                    {viewInvoice.payment_type === 'credit' && viewInvoice.due_date && (
                      <p className="text-xs text-slate-500 font-medium mt-1">
                        {language === 'ar' ? 'تاريخ الاستحقاق:' : 'Due Date:'} <span className="text-zinc-700 font-bold bg-zinc-50 px-2 py-0.5 rounded border border-zinc-200">
                          {formatDate(viewInvoice.due_date)}
                        </span>
                      </p>
                    )}
                  </div>
                  <div className={`flex flex-col ${dir === 'rtl' ? 'items-start' : 'items-end'} justify-center gap-2`}>
                    <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border
                      ${viewInvoice.payment_type === 'cash' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                        : 'bg-amber-50 text-amber-700 border-amber-100'
                      }`}>
                      {viewInvoice.payment_type === 'cash' ? 'سداد نقدي' : 'سداد آجل'}
                    </div>
                    {(() => {
                      const status = getPaymentStatus(viewInvoice);
                      const statusLabels = {
                        paid: language === 'ar' ? 'مدفوعة' : 'Paid',
                        partial: language === 'ar' ? 'مدفوعة جزئياً' : 'Partially Paid',
                        unpaid: language === 'ar' ? 'غير مدفوعة' : 'Unpaid'
                      };
                      const statusClasses = {
                        paid: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                        partial: 'bg-blue-100 text-blue-800 border-blue-200',
                        unpaid: 'bg-red-100 text-red-800 border-red-200'
                      };
                      return (
                        <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${statusClasses[status]}`}>
                          {statusLabels[status]}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {viewInvoice.description && (
                  <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">وصف الفاتورة</p>
                    <p className="text-slate-700 whitespace-pre-wrap">{viewInvoice.description}</p>
                  </div>
                )}

                <div className="border border-[#f4f4f5] rounded-2xl overflow-hidden">
                  <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'} text-sm`}>
                    <thead className="bg-[#fafafa] text-[#71717a] uppercase text-[10px] font-bold tracking-widest">
                      <tr>
                        <th className="px-4 py-3 w-16 text-center">{t('products.column_image')}</th>
                        <th className="px-4 py-3">{t('invoices.column_product')}</th>
                        <th className="px-4 py-3 text-center">باركود</th>
                        <th className="px-4 py-3 w-24">{t('invoices.column_quantity')}</th>
                        <th className="px-4 py-3 w-32">{t('invoices.column_price')}</th>
                        <th className="px-4 py-3 w-32">{t('invoices.column_total')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#fafafa]">
                      {viewInvoice.items?.map((item, index) => (
                        <tr key={index}>
                          <td className="px-4 py-3 text-center">
                            {(item.image_url || item.product_image_url) ? (
                              <img 
                                src={item.image_url || item.product_image_url} 
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
                          <td className="px-4 py-3 text-center min-w-[120px]">
                            {item.barcode && (
                              <div className="flex flex-col items-center justify-center p-1 bg-white rounded-lg border border-slate-100">
                                <Barcode 
                                  value={item.barcode} 
                                  width={1} 
                                  height={25} 
                                  fontSize={8}
                                  background="white"
                                  lineColor="#000000"
                                  margin={2}
                                />
                                <span className="text-[8px] mt-0.5 text-slate-500 font-mono font-bold tracking-tighter">{item.barcode}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-[#71717a]">{item.quantity}</td>
                          <td className="px-4 py-3 text-[#71717a]">{formatMoney(item.unit_price)} {t('invoices.currency')}</td>
                          <td className="px-4 py-3 font-bold text-[#18181b]">{formatMoney(item.total)} {t('invoices.currency')}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50/50 font-bold border-t border-slate-100">
                      <tr>
                        <td colSpan={5} className={`px-6 py-3 ${dir === 'rtl' ? 'text-left' : 'text-right'} text-slate-400 font-bold text-[10px] uppercase tracking-wider`}>{t('invoices.summary_subtotal')}</td>
                        <td className="px-6 py-3 text-slate-900 text-base">{formatMoney(viewInvoice.subtotal)} {t('invoices.currency')}</td>
                      </tr>
                      {Number(viewInvoice.discount_amount || viewInvoice.discount) > 0 && (
                        <tr>
                          <td colSpan={5} className={`px-6 py-3 ${dir === 'rtl' ? 'text-left' : 'text-right'} text-red-400 font-bold text-[10px] uppercase tracking-wider`}>{t('invoices.summary_discount')}</td>
                          <td className="px-6 py-3 text-red-600 text-base">-{formatMoney(viewInvoice.discount_amount || viewInvoice.discount)} {t('invoices.currency')}</td>
                        </tr>
                      )}
                      <tr className="bg-slate-900 text-white">
                        <td colSpan={5} className={`px-6 py-5 ${dir === 'rtl' ? 'text-left' : 'text-right'} font-black text-lg uppercase tracking-tight`}>{t('invoices.summary_total')}</td>
                        <td className="px-6 py-5 text-2xl font-black text-brand-primary">{formatMoney(viewInvoice.total_amount)} {t('invoices.currency')}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Settlements Table */}
                {(() => {
                  const settlements = getInvoiceSettlements(viewInvoice);
                  if (settlements.length === 0) return null;
                  
                  return (
                    <div className="space-y-3 mt-8">
                      <h4 className="font-bold text-slate-800 text-sm border-b border-slate-150 pb-2">جدول تسويات الفاتورة</h4>
                      <div className="overflow-x-auto rounded-2xl border border-slate-150 shadow-sm">
                        <table className="w-full text-sm text-right border-collapse bg-slate-50/20">
                          <thead>
                            <tr className="bg-slate-50 text-slate-500 text-xs font-bold border-b border-slate-200">
                              <th className="px-4 py-3 text-right">التاريخ</th>
                              <th className="px-4 py-3 text-right">نوع الحركة</th>
                              <th className="px-4 py-3 text-right">رقم الحركة / المرجع</th>
                              <th className="px-4 py-3 text-right">الملاحظات</th>
                              <th className="px-4 py-3 text-left">المبلغ المسوى</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {settlements.map((s: any) => (
                              <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-4 py-3 font-mono text-xs">{formatDate(s.date)}</td>
                                <td className="px-4 py-3 text-xs font-bold">{s.type_label}</td>
                                <td className="px-4 py-3 font-mono text-xs text-emerald-600 font-bold">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setViewInvoice(null);
                                      setPendingViewDoc({ type: s.page_name === 'journal_entries' ? 'journal' : s.page_name === 'receipts' ? 'receipt' : s.page_name, idOrNumber: s.number });
                                      setCurrentPage(s.page_name);
                                    }}
                                    className="hover:underline"
                                  >
                                    {s.number}
                                  </button>
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate" title={s.notes}>{s.notes || '-'}</td>
                                <td className="px-4 py-3 text-left font-black text-emerald-600">{formatMoney(s.amount)} {t('invoices.currency')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="hidden lg:block w-80 border-r border-slate-100 bg-slate-50/30">
                <InlineActivityLog category="invoices" documentId={viewInvoice.id} />
              </div>
            </div>
            
            <div className="p-4 md:p-6 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex gap-2">
                <button 
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-6 py-3 bg-white text-slate-700 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                >
                  <Printer size={20} />
                  طباعة
                </button>
                <button 
                  onClick={() => handleExportInvoicePDF(viewInvoice)}
                  className="flex items-center gap-2 px-6 py-3 bg-white text-slate-700 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                >
                  <Download size={20} />
                  PDF
                </button>
              </div>
              <button 
                onClick={() => setViewInvoice(null)}
                className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-200"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-4xl md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col border border-slate-200">
            <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg md:text-xl font-bold text-slate-900">إضافة عميل جديد</h3>
              <button onClick={() => setIsCustomerModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-xl transition-all"><X size={24} /></button>
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              <form onSubmit={handleCustomerSubmit} className="p-4 md:p-8 space-y-5 flex-1 overflow-y-auto pb-32 md:pb-8">
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-tighter">اسم العميل</label>
                    <div className="relative">
                      <Search className="absolute start-3 top-3 text-slate-400" size={18} />
                      <input
                        required
                        type="text"
                        className="w-full ps-10 pe-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={customerFormData.name}
                        onChange={(e) => setCustomerFormData({ ...customerFormData, name: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-tighter">رقم الهاتف</label>
                    <div className="relative">
                      <Phone className="absolute start-3 top-3 text-slate-400" size={18} />
                      <input
                        required
                        type="tel"
                        pattern="[0-9]{11,}"
                        className="w-full ps-10 pe-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-left"
                        value={customerFormData.mobile}
                        onChange={(e) => setCustomerFormData({ ...customerFormData, mobile: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-tighter">البريد الإلكتروني</label>
                    <div className="relative">
                      <Mail className="absolute start-3 top-3 text-slate-400" size={18} />
                      <input
                        type="email"
                        className="w-full ps-10 pe-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-left"
                        value={customerFormData.email}
                        onChange={(e) => setCustomerFormData({ ...customerFormData, email: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-tighter">العنوان</label>
                    <textarea
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      rows={2}
                      value={customerFormData.address}
                      onChange={(e) => setCustomerFormData({ ...customerFormData, address: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-tighter">رصيد أول</label>
                      <div className="relative">
                        <Wallet className="absolute start-3 top-3 text-slate-400" size={18} />
                        <input 
                          type="number" 
                          className="w-full ps-10 pe-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          value={customerFormData.opening_balance}
                          onChange={(e) => setCustomerFormData({ ...customerFormData, opening_balance: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-tighter">تاريخ الرصيد</label>
                      <div className="relative">
                        <Calendar className="absolute start-3 top-3 text-slate-400" size={18} />
                        <input 
                          type="date" 
                          className="w-full ps-10 pe-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-mono"
                          value={customerFormData.opening_balance_date}
                          onChange={(e) => setCustomerFormData({ ...customerFormData, opening_balance_date: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-tighter">الحساب المحاسبي</label>
                    <select
                      required
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
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
                    <div className="animate-in slide-in-from-top-2 duration-200 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                      <label className="block text-sm font-bold text-emerald-900 mb-1 uppercase tracking-tighter">حساب مقابل رصيد أول المدة</label>
                      <select
                        required
                        className="w-full px-4 py-3 bg-white border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
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
                <div className="pt-8 flex gap-3">
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                  >
                    حفظ العميل
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsCustomerModalOpen(false)}
                    className="px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all active:scale-95 border border-slate-200"
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-4xl md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col border border-slate-200">
            <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg md:text-xl font-bold text-slate-900">إضافة صنف جديد</h3>
              <button onClick={() => setIsProductModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-xl transition-all"><X size={24} /></button>
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              <form onSubmit={handleProductSubmit} className="p-4 md:p-8 space-y-5 flex-1 overflow-y-auto pb-32 md:pb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-tighter">كود الصنف</label>
                    <div className="relative">
                      <Hash className="absolute start-3 top-3 text-slate-400" size={18} />
                      <input
                        required
                        readOnly
                        type="text"
                        className="w-full ps-10 pe-4 py-3 bg-slate-100 border border-slate-200 rounded-xl focus:ring-0 outline-none transition-all font-mono opacity-70 cursor-not-allowed"
                        value={productFormData.code}
                        onChange={(e) => setProductFormData({ ...productFormData, code: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-tighter">اسم الصنف</label>
                    <div className="relative">
                      <Package className="absolute start-3 top-3 text-slate-400" size={18} />
                      <input
                        required
                        type="text"
                        className="w-full ps-10 pe-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={productFormData.name}
                        onChange={(e) => setProductFormData({ ...productFormData, name: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-tighter">نوع الصنف</label>
                  <div className="relative">
                    <Layers className="absolute start-3 top-3 text-slate-400" size={18} />
                    <select
                      required
                      className="w-full ps-10 pe-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none"
                      value={productFormData.type}
                      onChange={(e) => setProductFormData({ ...productFormData, type: e.target.value as any })}
                    >
                      <option value="finished_good">{t('products.type_finished_good')}</option>
                      <option value="service">{t('products.type_service')}</option>
                      <option value="raw_material">{t('products.type_raw_material')}</option>
                      <option value="commodity">{t('products.type_commodity')}</option>
                      <option value="consumable">{t('products.type_consumable')}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-tighter">سعر البيع</label>
                    <div className="relative">
                      <Tag className="absolute start-3 top-3 text-slate-400" size={18} />
                      <input
                        required
                        type="number"
                        step="0.01"
                        className="w-full ps-10 pe-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-mono"
                        value={productFormData.sale_price}
                        onChange={(e) => setProductFormData({ ...productFormData, sale_price: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-tighter">سعر التكلفة</label>
                    <div className="relative">
                      <Tag className="absolute start-3 top-3 text-slate-400" size={18} />
                      <input
                        required
                        type="number"
                        step="0.01"
                        className="w-full ps-10 pe-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-mono"
                        value={productFormData.cost_price}
                        onChange={(e) => setProductFormData({ ...productFormData, cost_price: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-tighter">الوصف</label>
                  <textarea
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    rows={2}
                    value={productFormData.description}
                    onChange={(e) => setProductFormData({ ...productFormData, description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-tighter">المرفق (صورة أو PDF)</label>
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
                        className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-slate-50 border border-slate-200 border-dashed rounded-xl cursor-pointer hover:bg-slate-100 hover:border-emerald-500 transition-all font-bold text-slate-500"
                      >
                        <Paperclip size={18} className="text-slate-400 group-hover:text-emerald-500" />
                        <span className="text-sm group-hover:text-emerald-900">
                          {productFormData.image_url ? 'تغيير المرفق' : 'اختر ملفاً...'}
                        </span>
                      </label>
                    </div>
                    {productFormData.image_url && (
                      <div className="mt-2 relative flex justify-center bg-white p-2 rounded-xl border border-slate-200 overflow-hidden shadow-sm">
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
                            <span className="text-[10px] font-bold text-slate-500">PDF</span>
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
                    <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-tighter">الباركود (اختياري)</label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-3 text-slate-400" size={18} />
                      <input
                        type="text"
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-mono"
                        value={productFormData.barcode}
                        onChange={(e) => setProductFormData({ ...productFormData, barcode: e.target.value })}
                      />
                    </div>
                    {productFormData.barcode && (
                      <div className="mt-2 flex justify-center bg-white p-2 rounded-xl border border-slate-100 overflow-hidden shadow-sm">
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
                    <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-tighter">حساب الإيرادات</label>
                    <select
                      required
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
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
                    <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-tighter">حساب التكلفة</label>
                    <select
                      required
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
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

                <div className="pt-8 flex gap-3">
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                  >
                    حفظ الصنف
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsProductModalOpen(false)}
                    className="px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all active:scale-95 border border-slate-200"
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-6xl md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col border border-slate-200">
            <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg md:text-xl font-bold text-slate-900">إضافة طريقة دفع جديدة</h3>
              <button onClick={() => setIsPaymentMethodModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-xl transition-all"><X size={24} /></button>
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              <form onSubmit={handlePaymentMethodSubmit} className="p-4 md:p-8 space-y-5 flex-1 overflow-y-auto pb-32 md:pb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-tighter">كود الطريقة</label>
                    <div className="relative">
                      <Hash className="absolute start-3 top-3 text-slate-400" size={18} />
                      <input
                        required
                        type="text"
                        className="w-full ps-10 pe-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-mono"
                        value={paymentMethodFormData.code}
                        onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, code: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-tighter">اسم الطريقة</label>
                    <div className="relative">
                      <Wallet className="absolute start-3 top-3 text-slate-400" size={18} />
                      <input
                        required
                        type="text"
                        className="w-full ps-10 pe-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={paymentMethodFormData.name}
                        onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, name: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-tighter">النوع</label>
                    <div className="relative">
                      <Layers className="absolute start-3 top-3 text-slate-400" size={18} />
                      <select
                        className="w-full ps-10 pe-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none"
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
                    <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-tighter">الحساب المحاسبي</label>
                    <select
                      required
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
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
                    <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-tighter">الرصيد الافتتاحي</label>
                    <div className="relative">
                      <Wallet className="absolute start-3 top-3 text-slate-400" size={18} />
                      <input 
                        type="number" 
                        className="w-full ps-10 pe-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-mono"
                        value={paymentMethodFormData.opening_balance}
                        onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, opening_balance: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-tighter">تاريخ الرصيد</label>
                    <div className="relative">
                      <Calendar className="absolute start-3 top-3 text-slate-400" size={18} />
                      <input 
                        type="date" 
                        className="w-full ps-10 pe-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-mono"
                        value={paymentMethodFormData.opening_balance_date}
                        onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, opening_balance_date: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {paymentMethodFormData.opening_balance !== 0 && (
                  <div className="space-y-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <div>
                      <label className="block text-sm font-bold text-emerald-900 mb-1 uppercase tracking-tighter">حساب الطرف الآخر (للرصيد الافتتاحي)</label>
                      <select
                        required
                        className="w-full px-4 py-3 bg-white border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
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
                  <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-tighter">تفاصيل إضافية</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 text-slate-400" size={18} />
                    <textarea
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      rows={3}
                      value={paymentMethodFormData.details}
                      onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, details: e.target.value })}
                    />
                  </div>
                </div>
                <div className="pt-8 flex gap-3">
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                  >
                    حفظ الطريقة
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsPaymentMethodModalOpen(false)}
                    className="px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all active:scale-95 border border-slate-200"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
              <div className="hidden md:block w-80 border-r border-slate-100 bg-slate-50/30">
                <InlineActivityLog category="payment_methods" documentId={undefined} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 animate-in zoom-in-95 duration-200 border border-slate-200">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <Trash2 className="text-red-500" size={32} />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2 text-center">تأكيد الحذف</h3>
            <p className="text-slate-500 mb-8 text-center leading-relaxed">هل أنت متأكد من رغبتك في حذف هذه الفاتورة؟ لا يمكن التراجع عن هذا الإجراء وسيتم إلغاء كافة القيود المحاسبية المرتبطة بها.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setInvoiceToDelete(null);
                }}
                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all active:scale-95 border border-slate-200"
              >
                إلغاء
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 active:scale-95"
              >
                تأكيد الحذف
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
