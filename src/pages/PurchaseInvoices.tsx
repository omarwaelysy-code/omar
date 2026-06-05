import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Company, Supplier, Product, PaymentMethod, ExpenseCategory, Account, JournalEntry, JournalEntryItem } from '../types';
import { 
  Search, Plus, Trash2, X, ShoppingCart, User, CreditCard, 
  Calendar, Hash, Package, Save, FileText, Pencil, Download, 
  Eye, History, Printer, ArrowRight, ArrowLeft, Minimize2, 
  Maximize2, Phone, Mail, MapPin, Wallet, Layers, Paperclip, 
  Tag, Box, LayoutGrid, List, Receipt, ChevronDown, ChevronLeft, ChevronRight
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
import { CompanyInvoiceHeader } from '../components/CompanyInvoiceHeader';
import DocumentChatter from '../components/DocumentChatter';
import { TransactionManager } from '../services/TransactionManager';
import { InvoiceSchema, JournalEntrySchema } from '../lib/schemas';
import { ExportButtons } from '../components/ExportButtons';
import { ActivityLog } from '../types';
import { formatNumber, formatDate, formatMoney } from '../utils/formatUtils';
import { useViewPreference } from '../hooks/useViewPreference';
import { PaginationControls } from '../components/PaginationControls';
// Currency import removed for now from view cleanup
import { useNavigation } from '../contexts/NavigationContext';

export const PurchaseInvoices: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { showNotification } = useNotification();
  const { pendingViewDoc, setPendingViewDoc, setCurrentPage } = useNavigation();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [companyData, setCompanyData] = useState<Company | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [purchaseInvoices, setPurchaseInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isExpenseCategoryModalOpen, setIsExpenseCategoryModalOpen] = useState(false);
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [previewJournalEntry, setPreviewJournalEntry] = useState<any | null>(null);
  const [previewActivityLog, setPreviewActivityLog] = useState<any | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [activityLogDocumentId, setActivityLogDocumentId] = useState<string | undefined>(undefined);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [view, setView] = useViewPreference('purchase_invoices', 'table');
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
  const [viewInvoice, setViewInvoice] = useState<any | null>(null);

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
    type: 'finished_good' as 'service' | 'finished_good' | 'raw_material' | 'commodity' | 'consumable',
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
  const isInitialLoad = useRef(true);
  const [allReceipts, setAllReceipts] = useState<any[]>([]);
  const [allPayments, setAllPayments] = useState<any[]>([]);
  const [allReturns, setAllReturns] = useState<any[]>([]);
  const [allPurchaseReturns, setAllPurchaseReturns] = useState<any[]>([]);

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [paymentTerms, setPaymentTerms] = useState<string>('due_on_receipt');
  const [paymentTermsDays, setPaymentTermsDays] = useState<number>(0);
  const [advancePercentage, setAdvancePercentage] = useState<number>(0);
  const [dueDate, setDueDate] = useState<string>(new Date().toISOString().slice(0, 10));
  
  // Form Settlements State
  const [formSettlementNumber, setFormSettlementNumber] = useState<string>('');
  const [formSettlementDate, setFormSettlementDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [formSettlements, setFormSettlements] = useState<any[]>([]);
  
  // Invoice State
  const [invoiceData, setInvoiceData] = useState({
    supplier_id: '',
    warehouse_id: '',
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
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      const unsubPI = dbService.subscribePaginated('purchase_invoices', {
        company_id: user.company_id,
        _page: page,
        _limit: limit,
        _sortBy: sortBy,
        _sortOrder: sortOrder,
        _search: searchTerm
      }, (result: any) => {
        setPurchaseInvoices(result.data);
        setTotalRecords(result.total);
        setServerSummary(result.summary);
      });
      const unsubSuppliers = dbService.subscribe<Supplier>('suppliers', user.company_id, setSuppliers);
      const unsubProducts = dbService.subscribe<Product>('products', user.company_id, setProducts);
      const unsubPM = dbService.subscribe<PaymentMethod>('payment_methods', user.company_id, setPaymentMethods);
      const unsubCategories = dbService.subscribe<ExpenseCategory>('expense_categories', user.company_id, setCategories);
      const unsubAccounts = dbService.subscribe<Account>('accounts', user.company_id, setAccounts);
      const unsubWarehouses = dbService.subscribe<any>('warehouses', user.company_id, setWarehouses);
      const unsubEntries = dbService.subscribe<JournalEntry>('journal_entries', user.company_id, setEntries);
      const unsubReceipts = dbService.subscribe<any>('receipt_vouchers', user.company_id, setAllReceipts);
      const unsubPayments = dbService.subscribe<any>('payment_vouchers', user.company_id, setAllPayments);
      const unsubReturns = dbService.subscribe<any>('returns', user.company_id, setAllReturns);
      const unsubPR = dbService.subscribe<any>('purchase_returns', user.company_id, setAllPurchaseReturns);
      
      const fetchSettings = async () => {
        const docs = await dbService.getDocsByFilter<any>('settings', user.company_id, [
          { field: 'type', operator: '==', value: 'discount_settings' }
        ]);
        if (docs.length > 0) {
          setSettings(docs[0]);
        }
      };

      fetchSettings();
      
      const fetchCompany = async () => {
        try {
          const company = await dbService.get<Company>('companies', user.company_id);
          if (company) {
            setCompanyData(company);
          }
        } catch (error) {
          console.error('Failed to load company data:', error);
        }
      };
      
      fetchCompany();
      setLoading(false);
      return () => {
        unsubPI();
        unsubSuppliers();
        unsubProducts();
        unsubPM();
        unsubCategories();
        unsubAccounts();
        unsubWarehouses();
        unsubEntries();
        unsubReceipts();
        unsubPayments();
        unsubReturns();
        unsubPR();
      };
    }
  }, [user, page, limit, sortBy, sortOrder, searchTerm]);

  useEffect(() => {
    if (isModalOpen && !formSettlementNumber && invoiceData.supplier_id) {
      const serial = generateSettlementSerial(formSettlementDate || invoiceData.date, allReceipts, allPayments);
      setFormSettlementNumber(serial);
    }
  }, [isModalOpen, invoiceData.supplier_id, formSettlementDate, invoiceData.date]);

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

  const generateInvoiceNumber = async (selectedDate: string) => {
    return await dbService.getNextSequence('purchase_invoices', selectedDate);
  };

  const getSupplierBalance = (supplierId: string) => {
    let balance = 0;
    entries.forEach((je: any) => {
      je.items?.forEach((item: any) => {
        if (item.supplier_id === supplierId) {
          balance += (item.credit || 0) - (item.debit || 0);
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
      
      if (je.reference_type === 'receipt_voucher' || je.reference_type === 'payment_voucher') {
        return;
      }

      const jeDescMatches = je.description?.toLowerCase().includes(inv.invoice_number.toLowerCase()) ||
                            je.reference_number?.toLowerCase().includes(inv.invoice_number.toLowerCase());
                            
      je.items?.forEach((item: any) => {
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
              id: `${je.id}-${item.account_id}`,
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
          date: s.date || inv.date,
          type_label: s.type_label || 'تسوية',
          number: s.reference_number || s.target_id,
          page_name: s.type || 'receipts',
          amount: Number(s.settled_amount) || 0,
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
    checkInvoices(purchaseInvoices);

    const nextSeq = (maxSeq + 1).toString().padStart(6, '0');
    return `${prefix}-${nextSeq}`;
  };

  const getOppositeMovements = (supplierId: string) => {
    if (!supplierId) return [];

    const movements: any[] = [];

    // 1. Payment Vouchers
    allPayments.forEach(v => {
      if (v.items && Array.isArray(v.items)) {
        v.items.forEach((item: any, idx: number) => {
          if (item.supplier_id === supplierId) {
            const voucherSettled = (item.settlements || []).reduce((sum: number, s: any) => sum + Number(s.settled_amount || s.amount || 0), 0);
            
            let invoiceSettled = 0;
            purchaseInvoices.forEach(inv => {
              if (inv.id !== editingInvoice?.id && inv.settlements && Array.isArray(inv.settlements)) {
                inv.settlements.forEach((s: any) => {
                  if (s.target_id === `${v.id}-${idx}`) {
                    invoiceSettled += Number(s.settled_amount || s.amount || 0);
                  }
                });
              }
            });

            const totalSettled = voucherSettled + invoiceSettled;
            const originalAmount = Number(item.amount) || 0;
            const openAmount = originalAmount - totalSettled;

            if (openAmount > 0.01 || formSettlements.some(fs => fs.target_id === `${v.id}-${idx}`)) {
              const currentSettle = formSettlements.find(fs => fs.target_id === `${v.id}-${idx}`);
              const currentSettleAmt = currentSettle ? Number(currentSettle.settled_amount) : 0;
              
              movements.push({
                id: `${v.id}-${idx}`,
                original_id: v.id,
                date: v.date,
                type_label: 'سند صرف',
                number: v.voucher_number || v.number || v.id,
                page_name: 'payment_vouchers',
                original_amount: originalAmount,
                open_amount: openAmount + currentSettleAmt,
                notes: v.description || v.notes || '',
                je_number: v.entry_number || ''
              });
            }
          }
        });
      }
    });

    // 2. Purchase Returns
    allPurchaseReturns.forEach(r => {
      if (r.supplier_id === supplierId) {
        let invoiceSettled = 0;
        purchaseInvoices.forEach(inv => {
          if (inv.id !== editingInvoice?.id && inv.settlements && Array.isArray(inv.settlements)) {
            inv.settlements.forEach((s: any) => {
              if (s.target_id === r.id) {
                invoiceSettled += Number(s.settled_amount || s.amount || 0);
              }
            });
          }
        });

        const originalAmount = Number(r.total_amount) || 0;
        const openAmount = originalAmount - invoiceSettled;

        if (openAmount > 0.01 || formSettlements.some(fs => fs.target_id === r.id)) {
          const currentSettle = formSettlements.find(fs => fs.target_id === r.id);
          const currentSettleAmt = currentSettle ? Number(currentSettle.settled_amount) : 0;

          movements.push({
            id: r.id,
            original_id: r.id,
            date: r.date,
            type_label: 'مرتجع مشتريات',
            number: r.return_number || r.id,
            page_name: 'purchase_returns',
            original_amount: originalAmount,
            open_amount: openAmount + currentSettleAmt,
            notes: r.description || r.notes || '',
            je_number: r.entry_number || ''
          });
        }
      }
    });

    // 3. Manual JEs
    entries.forEach(je => {
      if (je.reference_type === 'invoice' || je.reference_type === 'receipt_voucher' || je.reference_type === 'payment_voucher') {
        return;
      }
      
      je.items?.forEach((item: any, idx: number) => {
        if (item.supplier_id === supplierId && Number(item.debit) > 0) {
          const originalAmount = Number(item.debit) || 0;
          
          let invoiceSettled = 0;
          purchaseInvoices.forEach(inv => {
            if (inv.id !== editingInvoice?.id && inv.settlements && Array.isArray(inv.settlements)) {
              inv.settlements.forEach((s: any) => {
                if (s.target_id === `${je.id}-${idx}`) {
                  invoiceSettled += Number(s.settled_amount || s.amount || 0);
                }
              });
            }
          });

          const openAmount = originalAmount - invoiceSettled;

          if (openAmount > 0.01 || formSettlements.some(fs => fs.target_id === `${je.id}-${idx}`)) {
            const currentSettle = formSettlements.find(fs => fs.target_id === `${je.id}-${idx}`);
            const currentSettleAmt = currentSettle ? Number(currentSettle.settled_amount) : 0;

            movements.push({
              id: `${je.id}-${idx}`,
              original_id: je.id,
              date: je.date,
              type_label: 'قيد يومية',
              number: je.entry_number || je.id.slice(0, 8),
              page_name: 'journal_entries',
              original_amount: originalAmount,
              open_amount: openAmount + currentSettleAmt,
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

    if (amount <= 0) {
      if (existingIdx > -1) {
        settlements.splice(existingIdx, 1);
      }
    } else {
      const settlementObj = {
        target_id: targetTx.id,
        settled_amount: amount,
        reference_number: targetTx.number,
        entry_number: targetTx.je_number,
        type: targetTx.page_name,
        type_label: targetTx.type_label,
        date: targetTx.date,
        original_amount: targetTx.original_amount,
        settlement_number: formSettlementNumber || generateSettlementSerial(formSettlementDate || invoiceData.date, allReceipts, allPayments),
        settlement_date: formSettlementDate || invoiceData.date
      };

      if (existingIdx > -1) {
        settlements[existingIdx] = {
          ...settlements[existingIdx],
          ...settlementObj
        };
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

  // Auto populate supplier preferences
  useEffect(() => {
    if (invoiceData.supplier_id && isModalOpen && user) {
      const supplier = suppliers.find(s => s.id === invoiceData.supplier_id);
      if (supplier && !editingInvoice) {
        if (supplier.payment_method) {
          setInvoiceData(prev => ({ 
            ...prev, 
            payment_type: supplier.payment_method === 'cash' ? 'cash' : 'credit' 
          }));
        }
        if (supplier.payment_terms) {
          setPaymentTerms(supplier.payment_terms);
          setPaymentTermsDays(supplier.payment_terms_days || 0);
          setAdvancePercentage(supplier.advance_percentage || 0);
          
          const computedDue = calculateDueDate(invoiceData.date, supplier.payment_terms, supplier.payment_terms_days || 0);
          setDueDate(computedDue);
        } else {
          setPaymentTerms('due_on_receipt');
          setPaymentTermsDays(0);
          setAdvancePercentage(0);
          setDueDate(invoiceData.date);
        }
      }
    }
  }, [invoiceData.supplier_id, isModalOpen, editingInvoice, user, suppliers]);

  // Recalculate due date when date or terms change
  useEffect(() => {
    if (isModalOpen) {
      if (isInitialLoad.current) {
        isInitialLoad.current = false;
        return;
      }
      const computedDue = calculateDueDate(invoiceData.date, paymentTerms, paymentTermsDays);
      setDueDate(computedDue);
    }
  }, [invoiceData.date, paymentTerms, paymentTermsDays, isModalOpen]);

  // Real-time Preview Logic
  useEffect(() => {
    if (!isModalOpen || !user) {
      setPreviewJournalEntry(null);
      setPreviewActivityLog(null);
      return;
    }

    // Update invoice number if date changes and we are creating a new invoice
    if (!editingInvoice && isModalOpen) {
      const updateNum = async () => {
        const num = await generateInvoiceNumber(invoiceData.date);
        setInvoiceNumber(num);
      };
      updateNum();
    }
  }, [invoiceData.date, purchaseInvoices, isModalOpen, editingInvoice, user]);

  // Load pending purchase orders for selected supplier
  useEffect(() => {
    if (invoiceData.supplier_id && isModalOpen && user) {
      if (editingInvoice) {
        Promise.all([
          dbService.list<any>('purchase_orders', { 
            company_id: user.company_id,
            invoice_id: editingInvoice.id
          }),
          dbService.list<any>('purchase_orders', {
            company_id: user.company_id,
            supplier_id: invoiceData.supplier_id,
            status: 'pending'
          })
        ]).then(([linked, pending]) => {
          const linkedIds = linked.map(o => o.id);
          setSelectedOrderIds(linkedIds);
          const combined = [...linked, ...pending];
          const unique = combined.filter((o, index, self) => self.findIndex(t => t.id === o.id) === index);
          setPendingOrders(unique);
        }).catch(err => {
          console.error('Error fetching purchase orders for edit:', err);
        });
      } else {
        dbService.list<any>('purchase_orders', { 
          company_id: user.company_id,
          supplier_id: invoiceData.supplier_id,
          status: 'pending'
        }).then(orders => {
          setPendingOrders(orders);
          setSelectedOrderIds([]);
        }).catch(err => {
          console.error('Error fetching pending purchase orders:', err);
        });
      }
    } else {
      setPendingOrders([]);
      setSelectedOrderIds([]);
    }
  }, [invoiceData.supplier_id, isModalOpen, editingInvoice, user]);

  const handleOrderCheckboxChange = (orderId: string, checked: boolean) => {
    setSelectedOrderIds(prev => {
      const next = checked ? [...prev, orderId] : prev.filter(id => id !== orderId);
      const mergedItems: any[] = [];
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
              cost_price: Number(item.unit_price) || 0,
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
    if (pendingViewDoc && pendingViewDoc.type === 'convert_purchase_order' && user) {
      const orderId = pendingViewDoc.idOrNumber;
      setPendingViewDoc(null);
      
      const loadOrderForConversion = async () => {
        try {
          const order = await dbService.get<any>('purchase_orders', orderId);
          if (order) {
            openModal();
            setInvoiceData(prev => ({
              ...prev,
              supplier_id: order.supplier_id,
              warehouse_id: order.warehouse_id || '',
              notes: order.notes || ''
            }));
            setSelectedOrderIds([orderId]);

            const mappedItems = (order.items || []).map((item: any) => ({
              product_id: item.product_id,
              product_name: item.product_name,
              product_code: item.product_code || '',
              product_image_url: item.product_image_url || '',
              quantity: Number(item.quantity) || 0,
              cost_price: Number(item.unit_price) || 0,
              total: Number(item.total) || 0,
              barcode: item.barcode || '',
              image_url: item.product_image_url || ''
            }));
            setItems(mappedItems);
          }
        } catch (err) {
          console.error("Error converting purchase order", err);
        }
      };
      loadOrderForConversion();
    }
  }, [pendingViewDoc, user, setPendingViewDoc]);


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
          
          if (product?.type !== 'service') {
            debitAccountId = product?.inventory_account_id || product?.cost_account_id || '';
            debitAccountName = product?.inventory_account_name || product?.cost_account_name || '';
          } else {
            debitAccountId = product?.cost_account_id || '';
            debitAccountName = product?.cost_account_name || '';
          }
          
          if (!debitAccountId) {
            const fallbackAccount = accounts.find(a => a.name.includes('مخزون') || a.name.includes('مشتريات') || a.name.toLowerCase().includes('inventory') || a.name.toLowerCase().includes('purchase'));
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
        description: t('pi.invoice_description', { number: invoice_number, supplier: supplier?.name || '...' }),
        sub_account_id: invoiceData.payment_type === 'cash' ? invoiceData.payment_method_id : supplier?.id,
        sub_account_type: invoiceData.payment_type === 'cash' ? 'payment_method' : 'supplier'
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
          cost_price: item.price || item.cost_price || product?.cost_price || 0,
          total: (item.quantity || 1) * (item.price || item.cost_price || product?.cost_price || 0)
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
        type: 'finished_good' as any,
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

    const hasPhysicalProduct = items.some(item => {
      const prod = products.find(p => p.id === item.product_id);
      return prod && prod.type !== 'service';
    });

    if (invoiceData.purchase_type === 'items' && hasPhysicalProduct && !invoiceData.warehouse_id) {
      showNotification('يرجى اختيار المخزن', 'error');
      return;
    }

    try {
      const supplier = suppliers.find(s => s.id === invoiceData.supplier_id);
      const paymentMethod = paymentMethods.find(pm => pm.id === invoiceData.payment_method_id);
      
      const subtotal = Number(validItems.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.cost_price || 0)), 0)) || 0;
      const discount_amount = Number(invoiceData.discount) || 0;
      const total_amount = Number(subtotal - discount_amount) || 0;

      // Over-settlement validation
      const totalSettled = formSettlements.reduce((sum, s) => sum + Number(s.settled_amount), 0);
      if (totalSettled > total_amount) {
        showNotification('التسوية أكبر من المبلغ الإجمالي', 'error');
        return;
      }

      const invoice_number = editingInvoice?.invoice_number || invoiceNumber;

      const sanitizedItems = validItems.map(item => ({
        product_id: item.product_id || '',
        expense_category_id: item.expense_category_id || '',
        product_name: item.product_name || '',
        category_name: item.category_name || '',
        quantity: Number(item.quantity) || 0,
        unit_price: Number(item.cost_price) || 0,
        total: Number((Number(item.quantity) || 0) * (Number(item.cost_price) || 0)) || 0
      }));

      const data = {
        settlement_number: formSettlementNumber || null,
        settlement_date: formSettlementDate || null,
        settlements: formSettlements,
        invoice_number,
        supplier_id: invoiceData.supplier_id,
        supplier_name: supplier?.name || '',
        warehouse_id: invoiceData.warehouse_id || null,
        order_ids: selectedOrderIds,
        date: invoiceData.date, 
        subtotal,
        discount_amount,
        total_amount,
        items: sanitizedItems,
        payment_type: invoiceData.payment_type,
        payment_method_id: invoiceData.payment_type === 'cash' ? (invoiceData.payment_method_id || null) : null,
        payment_method_name: invoiceData.payment_type === 'cash' ? (paymentMethod?.name || '') : null,
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
      let supplierAccountId = supplier?.account_id || '';
      let supplierAccountName = supplier?.account_name || '';
      if (!supplierAccountId) {
        const fallback = accounts.find(a => a.name.includes('موردين') || a.name.toLowerCase().includes('supplier'));
        supplierAccountId = fallback?.id || 'suppliers_account_default';
        supplierAccountName = fallback?.name || t('pi.supplier_account_default');
      }

      journalItems.push({
        account_id: supplierAccountId,
        account_name: supplierAccountName,
        debit: 0,
        credit: total_amount,
        description: t('pi.invoice_description', { number: invoice_number, supplier: supplier?.name }) + (invoiceData.notes ? ` - ${invoiceData.notes}` : ''),
        supplier_id: invoiceData.supplier_id,
        supplier_name: supplier?.name,
        sub_account_id: invoiceData.supplier_id,
        sub_account_type: 'supplier'
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
          description: t('pi.discount_description', { number: invoice_number }) + (invoiceData.notes ? ` - ${invoiceData.notes}` : '')
        });
      }

      sanitizedItems.forEach(item => {
        let debitAccountId = '';
        let debitAccountName = '';

        if (invoiceData.purchase_type === 'items') {
          const product = products.find(p => p.id === item.product_id);
          
          if (product?.type !== 'service') {
            debitAccountId = product?.inventory_account_id || product?.cost_account_id || '';
            debitAccountName = product?.inventory_account_name || product?.cost_account_name || '';
          } else {
            debitAccountId = product?.cost_account_id || '';
            debitAccountName = product?.cost_account_name || '';
          }
          
          if (!debitAccountId) {
            const fallback = accounts.find(a => a.name.includes('مخزون') || a.name.includes('مشتريات') || a.name.includes('تكلفة') || a.name.toLowerCase().includes('inventory') || a.name.toLowerCase().includes('purchase'));
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
          debit: Number(item.total) || 0,
          credit: 0,
          description: t('pi.purchase_description', { name: item.product_name || item.category_name, number: invoice_number }) + (invoiceData.notes ? ` - ${invoiceData.notes}` : '')
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
          description: t('pi.payment_description', { number: invoice_number, supplier: supplier?.name }) + (invoiceData.notes ? ` - ${invoiceData.notes}` : ''),
          sub_account_id: invoiceData.payment_method_id,
          sub_account_type: 'payment_method'
        });
        journalItems.push({
          account_id: supplierAccountId,
          account_name: supplierAccountName,
          debit: total_amount,
          credit: 0,
          description: t('pi.settlement_description', { number: invoice_number, supplier: supplier?.name }) + (invoiceData.notes ? ` - ${invoiceData.notes}` : ''),
          supplier_id: invoiceData.supplier_id,
          supplier_name: supplier?.name,
          sub_account_id: invoiceData.supplier_id,
          sub_account_type: 'supplier'
        });
      }

      const total_debit = Number(journalItems.reduce((sum, item) => sum + (Number(item.debit) || 0), 0)) || 0;
      const total_credit = Number(journalItems.reduce((sum, item) => sum + (Number(item.credit) || 0), 0)) || 0;

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
        await TransactionManager.updateWithAccounting(
          'purchase_invoices',
          editingInvoice.id,
          data,
          InvoiceSchema,
          journalEntryData,
          JournalEntrySchema
        );
      } else {
        await TransactionManager.saveWithAccounting(
          'purchase_invoices',
          data,
          InvoiceSchema,
          journalEntryData,
          JournalEntrySchema
        );
      }

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
          warehouse_id: fullData.warehouse_id?.toString() || '',
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
          cost_price: item.unit_price || item.cost_price || 0,
          total: item.total
        })));
        setPaymentTerms(fullData.payment_terms || 'due_on_receipt');
        setPaymentTermsDays(fullData.payment_terms_days || 0);
        setAdvancePercentage(fullData.advance_percentage || 0);
        setDueDate(fullData.due_date ? fullData.due_date.slice(0, 10) : (fullData.date ? fullData.date.slice(0, 10) : new Date().toISOString().slice(0, 10)));
        setInvoiceNumber(fullData.invoice_number);
        setFormSettlementNumber(fullData.settlement_number || '');
        setFormSettlementDate(fullData.settlement_date ? fullData.settlement_date.slice(0, 10) : (fullData.date ? fullData.date.slice(0, 10) : new Date().toISOString().slice(0, 10)));
        setFormSettlements(fullData.settlements || []);
        isInitialLoad.current = true;
        console.log('[EDIT] Form updated with purchase invoice:', fullData.id);
      } catch (error: any) {
        console.error('[EDIT] Error loading purchase invoice:', error);
        showNotification('فشل تحميل بيانات فاتورة الشراء', 'error');
        return;
      }
    } else {
      setEditingInvoice(null);
      const newDate = new Date().toISOString().slice(0, 10);
      setFormSettlementNumber('');
      setFormSettlementDate(newDate);
      setFormSettlements([]);
      setInvoiceData({
        supplier_id: '',
        warehouse_id: '',
        date: newDate,
        payment_type: 'cash',
        payment_method_id: '',
        notes: '',
        discount: 0,
        purchase_type: 'items'
      });
      setItems([]);
      setPaymentTerms('due_on_receipt');
      setPaymentTermsDays(0);
      setAdvancePercentage(0);
      setDueDate(newDate);
      const num = await generateInvoiceNumber(newDate);
      setInvoiceNumber(num);
      isInitialLoad.current = true;
    }
    setIsModalOpen(true);
  };

  useEffect(() => {
    if (pendingViewDoc && pendingViewDoc.type === 'purchase_invoice' && user) {
      const loadPendingDoc = async () => {
        try {
          const existing = purchaseInvoices.find(inv => inv.invoice_number === pendingViewDoc.idOrNumber || inv.id === pendingViewDoc.idOrNumber);
          if (existing) {
            openModal(existing);
            setPendingViewDoc(null);
            return;
          }
          const docs = await dbService.getDocsByFilter<any>('purchase_invoices', user.company_id, [
            { field: 'invoice_number', operator: '==', value: pendingViewDoc.idOrNumber }
          ]);
          if (docs && docs.length > 0) {
            openModal(docs[0]);
          } else {
            const docById = await dbService.get<any>('purchase_invoices', pendingViewDoc.idOrNumber);
            if (docById) {
              openModal(docById);
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
  }, [pendingViewDoc, purchaseInvoices, user, setPendingViewDoc]);

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
      warehouse_id: '',
      date: new Date().toISOString().slice(0, 10),
      payment_type: 'cash',
      payment_method_id: '',
      notes: '',
      discount: 0,
      purchase_type: 'items'
    });
    setItems([]);
    setPaymentTerms('due_on_receipt');
    setPaymentTermsDays(0);
    setAdvancePercentage(0);
    setDueDate(new Date().toISOString().slice(0, 10));
    setFormSettlementNumber('');
    setFormSettlementDate(new Date().toISOString().slice(0, 10));
    setFormSettlements([]);
    setSelectedOrderIds([]);
    setPendingOrders([]);
  };

  const filteredInvoices = purchaseInvoices.filter(i => 
    i.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {!isModalOpen ? (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">{t('pi.title')}</h2>
          <p className="text-zinc-500">{t('pi.subtitle')}</p>
          {(serverSummary.total_amount !== undefined) && (
            <div className={`mt-2 flex items-center gap-4 text-sm ${t('dir') === 'rtl' ? 'flex-row-reverse' : ''}`}>
              <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100 font-bold">
                {t('pi.total_amount')}: {formatMoney(serverSummary.total_amount)} {t('common.currency')}
              </span>
              {serverSummary.total_discount !== undefined && (
                <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100 font-bold">
                   إجمالي الخصومات: {formatMoney(serverSummary.total_discount)} {t('common.currency')}
                </span>
              )}
              {serverSummary.total_discount !== undefined && (
                <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-100 font-bold">
                   الصافي: {formatMoney(serverSummary.total_amount - serverSummary.total_discount)} {t('common.currency')}
                </span>
              )}
            </div>
          )}
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
            className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-200"
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
          <>
            <div ref={tableRef} id="purchase-invoices-list-table" className="overflow-x-auto hidden md:block">
            <table className={`w-full ${t('dir') === 'rtl' ? 'text-right' : 'text-left'}`}>
              <thead>
                <tr className="bg-zinc-50/50 text-zinc-500 text-xs uppercase tracking-wider">
                  <th className={`px-6 py-4 font-bold cursor-pointer hover:text-emerald-600 transition-colors group ${t('dir') === 'rtl' ? 'text-right' : 'text-left'}`} onClick={() => handleSort('invoice_number')}>
                    <div className="flex items-center gap-1">
                      {t('pi.invoice_number')}
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {sortBy === 'invoice_number' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className={`px-6 py-4 font-bold cursor-pointer hover:text-emerald-600 transition-colors group ${t('dir') === 'rtl' ? 'text-right' : 'text-left'}`} onClick={() => handleSort('supplier_name')}>
                    <div className="flex items-center gap-1">
                      {t('pi.supplier')}
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {sortBy === 'supplier_name' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className={`px-6 py-4 font-bold cursor-pointer hover:text-emerald-600 transition-colors group ${t('dir') === 'rtl' ? 'text-right' : 'text-left'}`} onClick={() => handleSort('date')}>
                    <div className="flex items-center gap-1">
                      {t('common.date')}
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {sortBy === 'date' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className={`px-6 py-4 font-bold ${t('dir') === 'rtl' ? 'text-right' : 'text-left'}`}>حالة الدفع</th>
                  <th className={`px-6 py-4 font-bold cursor-pointer hover:text-emerald-600 transition-colors group ${t('dir') === 'rtl' ? 'text-right' : 'text-left'}`} onClick={() => handleSort('total_amount')}>
                    <div className="flex items-center gap-1">
                      {t('pi.total_amount')}
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {sortBy === 'total_amount' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className={`px-6 py-4 font-bold ${t('dir') === 'rtl' ? 'text-right' : 'text-left'}`}>{language === 'ar' ? 'رقم القيد' : 'Entry No.'}</th>
                  <th className={`px-6 py-4 font-bold ${t('dir') === 'rtl' ? 'text-left' : 'text-right'}`}>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-zinc-400 italic">{t('pi.no_invoices')}</td>
                  </tr>
                ) : filteredInvoices.map((inv) => (
                  <tr 
                    key={inv.id} 
                    className="hover:bg-zinc-50/50 transition-colors group cursor-pointer"
                    onClick={() => openModal(inv)}
                  >
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs bg-emerald-50 px-2 py-1 rounded text-emerald-700 font-bold">{inv.invoice_number}</span>
                    </td>
                    <td className="px-6 py-4 font-bold text-zinc-900">{inv.supplier_name}</td>
                    <td className="px-6 py-4 text-zinc-500">{formatDate(inv.date)}</td>
                    <td className="px-6 py-4">
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
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${statusClasses[status]}`}>
                            {statusLabels[status]}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 font-bold text-zinc-900">
                      {formatNumber(inv.total_amount)} {t('common.currency')}
                    </td>
                    <td className={`px-6 py-4 ${t('dir') === 'rtl' ? 'text-right' : 'text-left'}`}>
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
                    <td className={`px-6 py-4 ${t('dir') === 'rtl' ? 'text-left' : 'text-right'}`}>
                      <div className={`flex items-center ${t('dir') === 'rtl' ? 'justify-start' : 'justify-end'} gap-2 opacity-0 group-hover:opacity-100 transition-opacity`}>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActivityLogDocumentId(inv.id);
                            setIsActivityLogOpen(true);
                          }}
                          className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all no-pdf"
                          title={t('common.activity_log')}
                        >
                          <History size={18} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewInvoice(inv);
                          }}
                          className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 rounded-xl transition-all no-pdf"
                        >
                          <Eye size={18} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            openModal(inv);
                          }}
                          className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all no-pdf"
                        >
                          <Pencil size={18} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(inv.id);
                          }}
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
            <PaginationControls page={page} limit={limit} total={totalRecords} onPageChange={setPage} onLimitChange={setLimit} />
          </>
        ) : (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredInvoices.map((inv) => (
              <div 
                key={inv.id} 
                onClick={() => openModal(inv)}
                className="p-6 bg-zinc-50/50 rounded-3xl border border-zinc-100 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5 transition-all group relative overflow-hidden cursor-pointer"
              >
                <div className="absolute top-4 left-4 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setViewInvoice(inv);
                    }}
                    className="p-2 bg-white text-emerald-500 rounded-xl border border-emerald-50 shadow-sm hover:bg-emerald-50 transition-all font-bold"
                  >
                    <Eye size={16} />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      openModal(inv);
                    }}
                    className="p-2 bg-white text-blue-500 rounded-xl border border-blue-50 shadow-sm hover:bg-blue-50 transition-all font-bold"
                  >
                    <Pencil size={16} />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(inv.id);
                    }}
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
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-200/50 mt-4">
                  <div className="space-y-1">
                    <p className="text-zinc-400 text-[10px] uppercase font-black tracking-widest">{t('common.date')}</p>
                    <p className="text-zinc-900 font-bold text-sm tracking-tight">{formatDate(inv.date)}</p>
                  </div>
                  <div className="space-y-1 text-left">
                    <p className="text-zinc-400 text-[10px] uppercase font-black tracking-widest">حالة الدفع</p>
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
                  <div className="col-span-2 space-y-1 mt-1 pt-3 border-t border-zinc-200/50 flex justify-between items-end">
                    <div>
                      <p className="text-zinc-400 text-[10px] uppercase font-black tracking-widest">{t('pi.total_amount')}</p>
                      <p className="font-black text-2xl tracking-tighter text-emerald-600">
                        {formatNumber(inv.total_amount)} <span className="text-sm font-bold">{t('common.currency')}</span>
                      </p>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
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
            <div 
              key={inv.id} 
              onClick={() => openModal(inv)}
              className="p-4 space-y-4 cursor-pointer hover:bg-zinc-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[10px] bg-emerald-50 px-2 py-1 rounded text-emerald-700 font-bold w-fit">{inv.invoice_number}</span>
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
                  <h4 className="font-bold text-zinc-900 text-lg">{inv.supplier_name}</h4>
                </div>
                <div className={t('dir') === 'rtl' ? 'text-left' : 'text-right'}>
                  <p className="font-bold text-emerald-600 text-lg">
                    {formatNumber(inv.total_amount)} {t('common.currency')}
                  </p>
                  <span className="text-xs text-zinc-400">{formatDate(inv.date)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
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
    </>
  ) : (
    <div className="bg-white rounded-3xl border border-zinc-200 shadow-md overflow-hidden animate-in slide-in-from-bottom-4 duration-300 flex flex-col min-h-[80vh] relative">
      {/* Form Header */}
      <div className="p-4 md:p-6 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-[70]">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={closeModal} 
            className="flex items-center gap-2 px-4 py-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all font-black text-sm"
          >
            {t('dir') === 'rtl' ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            <span>{t('dir') === 'rtl' ? 'العودة للقائمة' : 'Back to List'}</span>
          </button>
        </div>

        <div className="flex-1 flex justify-center">
          <button 
            type="button"
            onClick={() => setShowSidePanel(!showSidePanel)}
            className={`flex items-center gap-3 px-6 py-2.5 rounded-2xl text-sm font-black transition-all border shadow-sm ${showSidePanel ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'}`}
          >
            <History size={18} />
            <span>{t('dir') === 'rtl' ? 'قيد اليومية \\ سجل التعديلات' : 'Journal Entry / Edit Log'}</span>
          </button>
        </div>

        <div className="flex items-center gap-4">
          {editingInvoice && (
            <div className="hidden lg:flex items-center gap-2 bg-zinc-100 p-1.5 rounded-2xl">
              <button 
                type="button"
                onClick={handleBackInvoice}
                className="flex items-center gap-1 px-3 py-1.5 hover:bg-white rounded-xl transition-all text-zinc-600 disabled:opacity-30 text-xs font-black"
                disabled={purchaseInvoices.findIndex(inv => inv.id === editingInvoice.id) === purchaseInvoices.length - 1}
              >
                {t('dir') === 'rtl' ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                {t('common.previous')}
              </button>
              <button 
                type="button"
                onClick={handleNextInvoice}
                className="flex items-center gap-1 px-3 py-1.5 hover:bg-white rounded-xl transition-all text-zinc-600 disabled:opacity-30 text-xs font-black"
                disabled={purchaseInvoices.findIndex(inv => inv.id === editingInvoice.id) === 0}
              >
                {t('common.next')}
                {t('dir') === 'rtl' ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
              </button>
            </div>
          )}
          <h3 className="text-xl md:text-2xl font-black text-zinc-900 tracking-tight">
            {editingInvoice ? t('pi.edit_invoice') : t('pi.add_invoice')}
          </h3>
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
                    {/* Card 1: معلومات النوع والمورد */}
                    <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6 relative">
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
                      <div className="flex items-center gap-2 mb-4 text-emerald-600">
                        <FileText className="w-5 h-5" />
                        <h2 className="font-semibold text-lg">المعلومات الأساسية</h2>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 pb-6">
                        <button 
                          type="button"
                          onClick={() => {
                            setInvoiceData({...invoiceData, purchase_type: 'items'});
                            setItems([]);
                          }}
                          className={`flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 border ${invoiceData.purchase_type === 'items' ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg scale-105 z-10' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                        >
                          <Package size={18} />
                          {t('pi.purchase_items')}
                        </button>
                        <button 
                          type="button"
                          onClick={() => {
                            setInvoiceData({...invoiceData, purchase_type: 'expenses'});
                            setItems([]);
                          }}
                          className={`flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 border ${invoiceData.purchase_type === 'expenses' ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg scale-105 z-10' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                        >
                          <Receipt size={18} />
                          {t('pi.purchase_expenses')}
                        </button>
                      </div>

                      <div className={`grid grid-cols-1 md:grid-cols-2 ${invoiceData.purchase_type === 'items' ? 'lg:grid-cols-3' : ''} gap-6 pt-4 border-t border-slate-100`}>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">{t('pi.supplier')}</label>
                          <div className="relative">
                            <User className="absolute start-3 top-2.5 text-slate-400" size={16} />
                            <select 
                              required
                              className="w-full ps-10 pe-10 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-bold text-slate-800 appearance-none"
                              value={invoiceData.supplier_id}
                              onChange={(e) => {
                                if (e.target.value === 'new_supplier') {
                                  setIsSupplierModalOpen(true);
                                } else {
                                  setInvoiceData({...invoiceData, supplier_id: e.target.value});
                                  setFormSettlements([]);
                                  setFormSettlementNumber('');
                                }
                              }}
                            >
                              <option value="">{t('pi.select_supplier')}</option>
                              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                              <option value="new_supplier" className="font-bold text-emerald-600">+ {t('suppliers.add_new')}</option>
                            </select>
                            <ChevronDown className="absolute end-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                          </div>
                        </div>

                        {invoiceData.purchase_type === 'items' && (
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">{language === 'ar' ? 'المخزن' : 'Warehouse'}</label>
                            <div className="relative">
                              <Box className="absolute start-3 top-2.5 text-slate-400" size={16} />
                              <select 
                                required
                                className="w-full ps-10 pe-10 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-bold text-slate-800 appearance-none"
                                value={invoiceData.warehouse_id}
                                onChange={(e) => setInvoiceData({...invoiceData, warehouse_id: e.target.value})}
                              >
                                <option value="">{language === 'ar' ? 'اختر المخزن' : 'Select Warehouse'}</option>
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                              </select>
                              <ChevronDown className="absolute end-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                          </div>
                        )}

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">{t('common.date')}</label>
                          <div className="relative">
                            <Calendar className="absolute start-3 top-2.5 text-slate-400" size={16} />
                            <input 
                              required
                              type="date" 
                              className="w-full ps-10 pe-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-bold text-slate-800"
                              value={invoiceData.date}
                              onChange={(e) => setInvoiceData({...invoiceData, date: e.target.value})}
                            />
                          </div>
                        </div>

                        {editingInvoice?.entry_number && (
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">{language === 'ar' ? 'رقم القيد المرتبط' : 'Linked Journal Entry'}</label>
                            <div className="relative">
                              <Layers className="absolute start-3 top-2.5 text-emerald-500" size={16} />
                              <input 
                                readOnly
                                type="text" 
                                className="w-full ps-10 pe-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg outline-none transition-all font-bold text-emerald-800"
                                value={editingInvoice.entry_number}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Currency - REMOVED */}

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">{t('common.notes')}</label>
                        <textarea 
                          rows={2}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all resize-none font-medium text-sm text-slate-600"
                          placeholder={t('pi.notes_placeholder')}
                          value={invoiceData.notes}
                          onChange={(e) => setInvoiceData({...invoiceData, notes: e.target.value})}
                        />
                      </div>

                      {pendingOrders.length > 0 && (
                        <div className="pt-4 border-t border-slate-100 space-y-3">
                          <label className="block text-xs font-bold text-emerald-600 tracking-tighter px-2 uppercase flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            {language === 'ar' ? 'ربط بأوامر الشراء المعلقة' : 'Link Pending Purchase Orders'}
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
                                      <td className="py-3 text-zinc-900 font-bold">{formatMoney(order.total_amount)} {t('pi.currency')}</td>
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
                    <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                      <div className="flex items-center gap-2 mb-4 text-emerald-600">
                        <Wallet className="w-5 h-5" />
                        <h2 className="font-semibold text-lg">إعدادات الدفع</h2>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-3">{t('pi.payment_type')}</label>
                          <div className="grid grid-cols-2 gap-3">
                            <button 
                              type="button"
                              onClick={() => setInvoiceData({...invoiceData, payment_type: 'cash'})}
                              className={`py-2.5 rounded-lg font-bold transition-all border flex items-center justify-center gap-2 ${invoiceData.payment_type === 'cash' ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                            >
                              <Wallet size={16} />
                              {t('pi.cash')}
                            </button>
                            <button 
                              type="button"
                              onClick={() => setInvoiceData({...invoiceData, payment_type: 'credit'})}
                              className={`py-2.5 rounded-lg font-bold transition-all border flex items-center justify-center gap-2 ${invoiceData.payment_type === 'credit' ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                            >
                              <Layers size={16} />
                              {t('pi.credit')}
                            </button>
                          </div>
                        </div>

                        {invoiceData.payment_type === 'cash' && (
                          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                            <label className="block text-sm font-medium text-slate-700 mb-2">{t('pi.payment_method')}</label>
                            <div className="relative">
                              <CreditCard className="absolute start-3 top-2.5 text-slate-400" size={16} />
                              <select 
                                required
                                className="w-full ps-10 pe-10 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-bold text-slate-800 appearance-none"
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
                              <ChevronDown className="absolute end-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                          </motion.div>
                        )}
                      </div>

                      {invoiceData.payment_type === 'credit' && (
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
                      {invoiceData.payment_type === 'credit' && invoiceData.supplier_id && (() => {
                        const currentSupplier = suppliers.find(s => s.id === invoiceData.supplier_id);
                        const totalInvoiceAmount = items.reduce((sum, i) => sum + (Number(i.total) || 0), 0) - invoiceData.discount;
                        const supplierBalance = getSupplierBalance(invoiceData.supplier_id);
                        const totalTentativeBalance = supplierBalance + totalInvoiceAmount;
                        
                        if (currentSupplier && currentSupplier.credit_limit > 0 && totalTentativeBalance > currentSupplier.credit_limit) {
                          return (
                            <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 animate-in fade-in slide-in-from-top-2 duration-300">
                              <span className="text-xl">⚠️</span>
                              <div className="flex-1 text-sm font-medium">
                                <p className="font-bold text-rose-950 mb-1">
                                  {language === 'ar' ? 'تنبيه: تجاوز حد الائتمان للمورد!' : 'Warning: Supplier Credit Limit Exceeded!'}
                                </p>
                                <p>
                                  {language === 'ar' 
                                    ? `سيؤدي حفظ هذه الفاتورة إلى تجاوز حد الائتمان المسموح به للمورد (${formatMoney(currentSupplier.credit_limit)}). رصيد المورد الحالي: ${formatMoney(supplierBalance)} + إجمالي الفاتورة: ${formatMoney(totalInvoiceAmount)} = الإجمالي المتوقع: ${formatMoney(totalTentativeBalance)}.`
                                    : `Saving this invoice will exceed the supplier's credit limit (${formatMoney(currentSupplier.credit_limit)}). Current supplier balance: ${formatMoney(supplierBalance)} + Invoice total: ${formatMoney(totalInvoiceAmount)} = Tentative total: ${formatMoney(totalTentativeBalance)}.`}
                                </p>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </section>
                    
                    {/* Card 3: الأصناف */}
                    <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                        <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                              {invoiceData.purchase_type === 'items' ? <Package size={24} className="text-emerald-600" /> : <Receipt size={24} className="text-emerald-600" />}
                              {invoiceData.purchase_type === 'items' ? t('pi.invoice_items') : t('pi.expense_items')}
                            </h3>
                            <button 
                              type="button"
                              onClick={() => setShowSidePanel(!showSidePanel)}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${showSidePanel ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                            >
                              <History size={14} />
                              {t('pi.toggle_side_panel')}
                            </button>
                          </div>
                          <button 
                            type="button"
                            onClick={addItem}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-all active:scale-95 shadow-md shadow-emerald-500/10"
                          >
                            <Plus size={18} />
                            {t('common.add')}
                          </button>
                        </div>

                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                          <table className={`w-full ${t('dir') === 'rtl' ? 'text-right' : 'text-left'} border-collapse text-sm`}>
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-3 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest w-16 text-center">{t('common.image')}</th>
                                <th className="px-3 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">{invoiceData.purchase_type === 'items' ? t('pi.item') : t('pi.expense_item')}</th>
                                <th className="px-3 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest w-24 text-center">{t('pi.quantity')}</th>
                                <th className="px-3 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest w-32 text-center">{t('pi.price')}</th>
                                <th className={`px-3 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest w-32 ${t('dir') === 'rtl' ? 'text-left' : 'text-right'}`}>{t('pi.total')}</th>
                                <th className="px-3 py-4 w-12"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 italic">
                              {items.length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic font-medium">{t('pi.no_items_added')}</td>
                                </tr>
                              ) : items.map((item, index) => (
                                <tr key={index} className="hover:bg-slate-50/50 transition-colors group">
                                  <td className="px-3 py-3 text-center">
                                    {invoiceData.purchase_type === 'items' && (item as any).product_image_url ? (
                                      <img 
                                        src={(item as any).product_image_url} 
                                        alt="Product" 
                                        className="w-10 h-10 object-cover rounded-lg mx-auto border border-slate-200 shadow-sm"
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : (
                                      <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center mx-auto border border-slate-200">
                                        <Box size={16} className="text-slate-300" />
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3 py-3">
                                    <div className="relative">
                                      {invoiceData.purchase_type === 'items' ? (
                                        <select 
                                          required
                                          className={`w-full ps-3 pe-8 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-bold text-slate-800 appearance-none text-xs ${t('dir') === 'rtl' ? 'text-right' : 'text-left'}`}
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
                                          className={`w-full ps-3 pe-8 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-bold text-slate-800 appearance-none text-xs ${t('dir') === 'rtl' ? 'text-right' : 'text-left'}`}
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
                                      <ChevronDown className="absolute end-2 top-2.5 w-3 h-3 text-slate-400 pointer-events-none" />
                                    </div>
                                  </td>
                                  <td className="px-3 py-3">
                                    <input 
                                      required
                                      type="number" 
                                      step="any"
                                      className="w-full bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 px-3 py-2 text-xs outline-none text-center font-bold text-slate-800 transition-all border-dashed"
                                      value={item.quantity}
                                      onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                                    />
                                  </td>
                                  <td className="px-3 py-3">
                                    <input 
                                      required
                                      type="number" 
                                      step="any"
                                      className="w-full bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 px-3 py-2 text-xs outline-none text-center font-bold text-slate-800 transition-all border-dashed"
                                      value={item.cost_price}
                                      onChange={(e) => updateItem(index, 'cost_price', Number(e.target.value))}
                                    />
                                  </td>
                                  <td className={`px-3 py-3 font-bold text-slate-900 text-xs ${t('dir') === 'rtl' ? 'text-left' : 'text-right'}`}>
                                    {formatNumber(item.total || 0)}
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    <button 
                                      type="button"
                                      onClick={() => removeItem(index)}
                                      className="p-1.5 text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Totals Section within Card 3 */}
                        <div className="mt-6 pt-6 border-t border-slate-100 space-y-3">
                          <div className={`flex justify-between items-center py-2 italic font-bold text-slate-600`}>
                            <span>{t('pi.subtotal')}:</span>
                            <span className="text-slate-900">
                              {formatNumber(calculateSubtotal())} {companyData?.settings?.currency || ''}
                            </span>
                          </div>
                          <div className={`flex justify-between items-center py-2 italic font-bold text-slate-600`}>
                            <div className="flex items-center gap-2">
                              <span>{t('pi.discount')}:</span>
                              <input 
                                type="number" 
                                className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                                value={invoiceData.discount}
                                onChange={(e) => setInvoiceData({ ...invoiceData, discount: parseFloat(e.target.value) || 0 })}
                              />
                            </div>
                            <span className="text-emerald-500">
                              -{formatNumber(invoiceData.discount)} {companyData?.settings?.currency || ''}
                            </span>
                          </div>
                          <div className="flex flex-col gap-2 p-6 bg-slate-900 text-white rounded-2xl italic shadow-lg">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-lg">{t('pi.grand_total')}</span>
                              <div className="text-right">
                                <span className="font-black text-2xl text-emerald-400">
                                  {formatNumber(calculateTotal())} {companyData?.settings?.currency || ''}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                    </section>

                    {/* Settlements Table Card in Form */}
                    {invoiceData.supplier_id && invoiceData.payment_type === 'credit' && (
                      <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
                          <div className="flex items-center gap-2 text-emerald-600">
                            <Layers className="w-5 h-5" />
                            <h2 className="font-semibold text-zinc-900">
                              {language === 'ar' ? 'جدول تسويات الفاتورة' : 'Invoice Settlements Table'}
                            </h2>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-xs font-bold font-mono">
                            <div className="flex items-center gap-2">
                              <span className="text-zinc-400 font-sans">{language === 'ar' ? 'رقم التسوية:' : 'Settlement No:'}</span>
                              <input 
                                disabled 
                                type="text" 
                                className="w-48 bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1 text-center text-zinc-500 font-mono text-xs"
                                value={formSettlementNumber}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-zinc-400 font-sans">{language === 'ar' ? 'تاريخ التسوية:' : 'Settlement Date:'}</span>
                              <input 
                                type="date" 
                                className="bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1 text-center text-zinc-700 text-xs"
                                value={formSettlementDate}
                                onChange={(e) => setFormSettlementDate(e.target.value)}
                              />
                            </div>
                            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100 text-xs font-sans">
                              <span>{language === 'ar' ? 'إجمالي المسوى:' : 'Total Settled:'}</span>
                              <span>{formatNumber(formSettlements.reduce((sum, s) => sum + Number(s.settled_amount), 0))} {companyData?.settings?.currency || ''}</span>
                            </div>
                            <div className="flex items-center gap-2 bg-slate-50 text-slate-700 px-3 py-1 rounded-full border border-slate-200 text-xs font-sans">
                              <span>{language === 'ar' ? 'الفرق:' : 'Difference:'}</span>
                              <span>{formatNumber(Math.max(0, calculateTotal() - formSettlements.reduce((sum, s) => sum + Number(s.settled_amount), 0)))} {companyData?.settings?.currency || ''}</span>
                            </div>
                          </div>
                        </div>

                        {(() => {
                          const openTransactions = getOppositeMovements(invoiceData.supplier_id);
                          if (openTransactions.length === 0) {
                            return (
                              <p className="text-zinc-400 text-sm italic py-4 text-center">
                                {language === 'ar' ? 'لا توجد حركات مستحقة للتسوية.' : 'No outstanding transactions for settlement.'}
                              </p>
                            );
                          }
                          return (
                            <div className="overflow-x-auto">
                              <table className={`w-full text-sm ${dir === 'rtl' ? 'text-right' : 'text-left'} border-collapse`}>
                                <thead>
                                  <tr className="border-b border-zinc-100 text-zinc-400 text-xs font-bold uppercase tracking-wider">
                                    <th className="pb-2 text-right">{language === 'ar' ? 'رقم القيد' : 'Entry No'}</th>
                                    <th className="pb-2 text-right">{language === 'ar' ? 'نوع الحركة' : 'Type'}</th>
                                    <th className="pb-2 text-right">{language === 'ar' ? 'رقم الحركة / المرجع' : 'Ref No'}</th>
                                    <th className="pb-2 text-right">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
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
                                    const remainingInvoiceAmount = Math.max(0, calculateTotal() - otherSettledSum);
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
                                        <td className="py-2.5 text-zinc-500 font-semibold">{formatNumber(t.original_amount)}</td>
                                        <td className="py-2.5 text-zinc-900 font-black">{formatNumber(t.open_amount)}</td>
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
                          );
                        })()}
                      </section>
                    )}

                    <div className="pt-6 flex gap-4 sticky bottom-0 bg-white/80 backdrop-blur-md pb-4 md:pb-0 z-20 border-t border-slate-100">
                      <button 
                        type="button"
                        onClick={closeModal}
                        className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all border border-slate-200 active:scale-95"
                      >
                        {t('common.cancel')}
                      </button>
                      <button 
                        type="submit"
                        className="flex-[2] py-3 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-3"
                      >
                        <Save className="w-5 h-5" />
                        {editingInvoice ? t('pi.edit_invoice') : t('pi.add_invoice')}
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
                <CompanyInvoiceHeader 
                  company={companyData} 
                  documentNumber={viewInvoice.invoice_number}
                  documentDate={viewInvoice.date}
                  title={t('pi.title')}
                />

                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <p className="text-xs font-bold text-[#a1a1aa] uppercase tracking-widest mb-1">{t('pi.invoice_from')}</p>
                    <p className="text-xl font-bold text-[#18181b]">{viewInvoice.supplier_name}</p>
                    {viewInvoice.warehouse_id && (
                      <p className="text-xs text-slate-500 font-medium mt-1">
                        {language === 'ar' ? 'المخزن:' : 'Warehouse:'} <span className="text-emerald-600 font-bold">{warehouses.find((w: any) => w.id?.toString() === viewInvoice.warehouse_id?.toString())?.name || viewInvoice.warehouse_id}</span>
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
                    <div className="mb-1 text-center">
                      <p className="text-xs font-bold text-[#a1a1aa] uppercase tracking-widest mb-1">{t('common.date')}</p>
                      <p className="text-lg font-medium text-[#18181b]">{formatDate(viewInvoice.date)}</p>
                    </div>
                    <div className="flex gap-2">
                      <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border
                        ${viewInvoice.payment_type === 'cash' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                          : 'bg-amber-50 text-amber-700 border-amber-100'
                        }`}>
                        {viewInvoice.payment_type === 'cash' ? (language === 'ar' ? 'سداد نقدي' : 'Cash') : (language === 'ar' ? 'سداد آجل' : 'Credit')}
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
                          <td className="px-4 py-3 text-[#71717a]">{formatNumber(item.price || item.cost_price || 0)} {companyData?.settings?.currency || ''}</td>
                          <td className="px-4 py-3 font-bold text-[#18181b]">{formatNumber(item.total)} {companyData?.settings?.currency || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50/50 font-bold border-t border-slate-100">
                      <tr>
                        <td colSpan={4} className={`px-6 py-3 ${t('dir') === 'rtl' ? 'text-left' : 'text-right'} text-slate-400 font-bold text-[10px] uppercase tracking-wider`}>{t('pi.subtotal')}</td>
                        <td className="px-6 py-3 text-slate-900 text-base">{formatNumber(viewInvoice.subtotal || viewInvoice.total_amount || 0)} {companyData?.settings?.currency || ''}</td>
                      </tr>
                      {viewInvoice.discount > 0 && (
                        <tr>
                          <td colSpan={4} className={`px-6 py-3 ${t('dir') === 'rtl' ? 'text-left' : 'text-right'} text-red-400 font-bold text-[10px] uppercase tracking-wider`}>{t('pi.discount')}</td>
                          <td className="px-6 py-3 text-red-600 text-base">-{formatNumber(viewInvoice.discount)} {companyData?.settings?.currency || ''}</td>
                        </tr>
                      )}
                      <tr className="bg-slate-900 text-white">
                        <td colSpan={4} className={`px-6 py-5 ${t('dir') === 'rtl' ? 'text-left' : 'text-right'} font-black text-lg uppercase tracking-tight`}>{t('pi.grand_total')}</td>
                        <td className="px-6 py-5 text-2xl font-black text-emerald-400">{formatNumber(viewInvoice.total_amount)} {companyData?.settings?.currency || ''}</td>
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
                      <h4 className="font-bold text-slate-800 text-sm border-b border-slate-150 pb-2">
                        {language === 'ar' ? 'جدول تسويات الفاتورة' : 'Invoice Settlements Table'}
                      </h4>
                      <div className="overflow-x-auto rounded-2xl border border-slate-150 shadow-sm">
                        <table className={`w-full text-sm ${t('dir') === 'rtl' ? 'text-right' : 'text-left'} border-collapse bg-slate-50/20`}>
                          <thead>
                            <tr className="bg-slate-50 text-slate-500 text-xs font-bold border-b border-slate-200">
                              <th className={`px-4 py-3 ${t('dir') === 'rtl' ? 'text-right' : 'text-left'}`}>
                                {language === 'ar' ? 'التاريخ' : 'Date'}
                              </th>
                              <th className={`px-4 py-3 ${t('dir') === 'rtl' ? 'text-right' : 'text-left'}`}>
                                {language === 'ar' ? 'نوع الحركة' : 'Transaction Type'}
                              </th>
                              <th className={`px-4 py-3 ${t('dir') === 'rtl' ? 'text-right' : 'text-left'}`}>
                                {language === 'ar' ? 'رقم الحركة / المرجع' : 'Transaction No. / Ref'}
                              </th>
                              <th className={`px-4 py-3 ${t('dir') === 'rtl' ? 'text-right' : 'text-left'}`}>
                                {language === 'ar' ? 'الملاحظات' : 'Notes'}
                              </th>
                              <th className={`px-4 py-3 ${t('dir') === 'rtl' ? 'text-left' : 'text-right'}`}>
                                {language === 'ar' ? 'المبلغ المسوى' : 'Settled Amount'}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {settlements.map((s: any) => {
                              // If language is English, map type labels
                              let displayTypeLabel = s.type_label;
                              if (language !== 'ar') {
                                if (s.type_label === 'سند قبض') displayTypeLabel = 'Receipt Voucher';
                                else if (s.type_label === 'سند صرف') displayTypeLabel = 'Payment Voucher';
                                else if (s.type_label === 'مرتجع مبيعات') displayTypeLabel = 'Sales Return';
                                else if (s.type_label === 'مرتجع مشتريات') displayTypeLabel = 'Purchase Return';
                                else if (s.type_label === 'قيد يومية') displayTypeLabel = 'Journal Entry';
                              }
                              
                              return (
                                <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="px-4 py-3 font-mono text-xs">{formatDate(s.date)}</td>
                                  <td className="px-4 py-3 text-xs font-bold">{displayTypeLabel}</td>
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
                                  <td className={`px-4 py-3 ${t('dir') === 'rtl' ? 'text-left' : 'text-right'} font-black text-emerald-600`}>
                                    {formatNumber(s.amount)} {companyData?.settings?.currency || ''}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

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
                        className={`w-full px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${t('dir') === 'rtl' ? 'text-right' : 'text-left'}`}
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
                      <p className="text-[10px] text-emerald-600 mt-1 font-medium">{t('suppliers.counter_account_note')}</p>
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
                        readOnly
                        type="text"
                        className={`w-full ${t('dir') === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-100 border border-zinc-200 rounded-xl focus:ring-0 outline-none transition-all font-mono opacity-70 cursor-not-allowed`}
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
