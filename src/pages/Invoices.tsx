import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Invoice, Customer, Product, InvoiceItem, Account, JournalEntry, JournalEntryItem, ActivityLog, Company, Operation, Department, CostCenter, Currency, ExchangeRate } from '../types';
import { 
  Search, Plus, Trash2, X, Eye, Download, Sparkles, Mic, 
  Image as ImageIcon, FileText, Pencil, History, Printer, 
  ChevronLeft, ChevronRight, Maximize2, Minimize2, Hash, 
  Wallet, Calendar, Package, Tag, Layers, Box, Paperclip, 
  Phone, Mail, Lock, LayoutGrid, List, Building2, ChevronDown, ChevronUp,
  CreditCard, RotateCcw, Save, ExternalLink, CheckCheck, Copy, Coins
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Barcode from 'react-barcode';
import { SmartAIInput } from '../components/SmartAIInput';
import { exportToPDF as exportToPDFUtil, printElement } from '../utils/pdfUtils';
import { exportToExcel, formatDataForExcel } from '../utils/excelUtils';
import { dbService, apiRequest } from '../services/dbService';
import { PageActivityLog } from '../components/PageActivityLog';
import { InlineActivityLog } from '../components/InlineActivityLog';
import { JournalEntryPreview } from '../components/JournalEntryPreview';
import { TransactionSidePanel } from '../components/TransactionSidePanel';
import DocumentChatter from '../components/DocumentChatter';
import { ExportButtons } from '../components/ExportButtons';
import { PaginationControls } from '../components/PaginationControls';
import { usePermissions } from '../hooks/usePermissions';
import { formatNumber, formatMoney, formatDate } from '../utils/formatUtils';
import { printDocument } from '../utils/printEngine';

import { useLanguage } from '../contexts/LanguageContext';
import { transactionManager, TransactionManager } from '../services/TransactionManager';
import { InvoiceSchema, JournalEntrySchema } from '../lib/schemas';
import { useViewPreference } from '../hooks/useViewPreference';
import { CompanyInvoiceHeader } from '../components/CompanyInvoiceHeader';
import { useNavigation } from '../contexts/NavigationContext';
import { BarcodeScanner } from '../components/BarcodeScanner';
import type { BarcodeScannerSettings } from '../hooks/useBarcodeScanner';
import { DEFAULT_BARCODE_SETTINGS } from '../hooks/useBarcodeScanner';

export const Invoices: React.FC = () => {
  const { t, dir, language } = useLanguage();
  const { user } = useAuth();
  const { canView, canCreate, canEdit, canDelete, canChangePrices, hasBusinessPermission } = usePermissions('invoices');
  const { showNotification } = useNotification();
  const { pendingViewDoc, setPendingViewDoc, setCurrentPage } = useNavigation();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [isExportingPDFSelected, setIsExportingPDFSelected] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [activeCell, setActiveCell] = useState<{ index: number; field: 'operation' | 'department' | 'cost_center' } | null>(null);
  const [cellSearchTerm, setCellSearchTerm] = useState('');
  const [activeCellRect, setActiveCellRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [focusedPriceIndex, setFocusedPriceIndex] = useState<number | null>(null);
  const [tempPriceValue, setTempPriceValue] = useState<string>('');
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
  const [isSubmitting, setIsSubmitting] = useState(false);
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
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  const [showAiInput, setShowAiInput] = useState(false);
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
  const [selectedOperationId, setSelectedOperationId] = useState<string>('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [selectedCostCenterId, setSelectedCostCenterId] = useState<string>('');
  
  // Floating popover lookup search states
  const [activeSearch, setActiveSearch] = useState<{
    index: number;
    type: 'operation' | 'department' | 'cost_center';
    query: string;
  } | null>(null);

  const [popoverRect, setPopoverRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  
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
  const [companyCurrencies, setCompanyCurrencies] = useState<Currency[]>([]);
  const [selectedCurrencyId, setSelectedCurrencyId] = useState<string>('');
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  // Barcode scanner state
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [barcodeContinuousMode, setBarcodeContinuousMode] = useState(false);
  const [exchangeRateType, setExchangeRateType] = useState<'manual' | 'auto'>('manual');
  const [view, setView] = useViewPreference('invoices', 'table');
  const [invoiceType, setInvoiceType] = useState<'items' | 'services'>('items');
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
  const columnSelectorRef = useRef<HTMLDivElement>(null);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    invoice_number: true,
    customer_name: true,
    date: true,
    description: true,
    payment_type: true,
    status: true,
    currency: true,
    foreign_amount: true,
    remaining_foreign: true,
    subtotal: true,
    tax_amount: true,
    base_amount: true,
    remaining: true,
    entry_number: true,
    created_date: false,
    created_time: false,
    updated_date: false,
    updated_time: false,
  });

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    invoice_number: 140,
    customer_name: 180,
    date: 110,
    description: 150,
    payment_type: 100,
    status: 100,
    currency: 80,
    foreign_amount: 120,
    remaining_foreign: 120,
    subtotal: 120,
    tax_amount: 100,
    base_amount: 150,
    remaining: 120,
    entry_number: 150,
    created_date: 110,
    created_time: 90,
    updated_date: 110,
    updated_time: 90,
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (columnSelectorRef.current && !columnSelectorRef.current.contains(event.target as Node)) {
        setIsColumnSelectorOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleCurrencyChange = async (currencyId: string) => {
    setSelectedCurrencyId(currencyId);
    if (!currencyId || !user?.company_id || !companyData) {
      setExchangeRate(1);
      return;
    }
    
    const currency = companyCurrencies.find(c => c.id === currencyId);
    if (!currency) {
      setExchangeRate(1);
      return;
    }
    
    const baseCurrency = companyData.settings?.currency || 'EGP';
    if (currency.code.toLowerCase() === baseCurrency.toLowerCase()) {
      setExchangeRate(1);
      setExchangeRateType('manual');
      return;
    }

    const updateMethod = companyData.settings?.exchange_rate_update_method || 'manual';
    setExchangeRateType(updateMethod);

    if (updateMethod === 'auto') {
      try {
        const latestAutoRates = await apiRequest<Array<{
          currency_id: string;
          rate: number | null;
          rate_date: string | null;
        }>>(`/currency-rates/latest?company_id=${user.company_id}`);
        const rateObj = latestAutoRates.find(r => r.currency_id === currencyId);
        if (rateObj && rateObj.rate !== null) {
          setExchangeRate(Number(rateObj.rate));
        } else {
          // fallback to manual rate
          const manualRates = await dbService.list<ExchangeRate>('exchange_rates', {
            currency_id: currencyId,
            company_id: user.company_id,
            _limit: 1,
            _sort: 'rate_date',
            _order: 'desc'
          });
          if (manualRates.length > 0) {
            setExchangeRate(Number(manualRates[0].exchange_rate));
          } else {
            setExchangeRate(1);
          }
        }
      } catch (error) {
        console.error('Error fetching auto rate:', error);
        setExchangeRate(1);
      }
    } else {
      // manual update method
      try {
        const manualRates = await dbService.list<ExchangeRate>('exchange_rates', {
          currency_id: currencyId,
          company_id: user.company_id,
          _limit: 1,
          _sort: 'rate_date',
          _order: 'desc'
        });
        if (manualRates.length > 0) {
          setExchangeRate(Number(manualRates[0].exchange_rate));
        } else {
          setExchangeRate(1);
        }
      } catch (error) {
        console.error('Error fetching manual rate:', error);
        setExchangeRate(1);
      }
    }
  };

  const handleResizeStart = (e: React.MouseEvent, columnKey: string, side: 'left' | 'right') => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = columnWidths[columnKey] || 100;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      let widthChange = side === 'left' ? -deltaX : deltaX;
      if (dir === 'rtl') {
        widthChange = -widthChange;
      }
      
      const newWidth = Math.max(50, startWidth + widthChange);
      setColumnWidths((prev) => ({
        ...prev,
        [columnKey]: newWidth,
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const renderResizeHandles = (columnKey: string) => {
    return (
      <>
        {/* Left resize handle */}
        <div
          onMouseDown={(e) => handleResizeStart(e, columnKey, 'left')}
          className="absolute top-0 left-0 bottom-0 w-3 cursor-col-resize group/resize z-10 flex items-center justify-center -ml-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-[2px] h-4 bg-slate-200 group-hover/resize:bg-emerald-500 group-hover/resize:h-full transition-all duration-150" />
        </div>
        {/* Right resize handle */}
        <div
          onMouseDown={(e) => handleResizeStart(e, columnKey, 'right')}
          className="absolute top-0 right-0 bottom-0 w-3 cursor-col-resize group/resize z-10 flex items-center justify-center -mr-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-[2px] h-4 bg-slate-200 group-hover/resize:bg-emerald-500 group-hover/resize:h-full transition-all duration-150" />
        </div>
      </>
    );
  };

  const isVatEnabled = companyData?.settings?.vat_enabled || companyData?.vat_enabled || false;
  const isMultiCurrencyEnabled = companyData?.settings?.enable_multi_currency || (companyData as any)?.enable_multi_currency || false;

  const prevExchangeRateRef = useRef<number>(1);
  const isInitializingRef = useRef<boolean>(true);

  // Initialize refs when modal opens
  useEffect(() => {
    if (isModalOpen) {
      isInitializingRef.current = true;
      prevExchangeRateRef.current = exchangeRate || 1;
    }
  }, [isModalOpen]);

  // Recalculate item prices when exchange rate changes dynamically
  useEffect(() => {
    if (isModalOpen) {
      if (isInitializingRef.current) {
        isInitializingRef.current = false;
        prevExchangeRateRef.current = exchangeRate || 1;
        return;
      }

      const prevRate = prevExchangeRateRef.current;
      if (prevRate !== exchangeRate && exchangeRate > 0 && prevRate > 0) {
        setItems(prevItems => prevItems.map(item => {
          const currentPrice = Number(item.unit_price) || 0;
          const newPrice = Number((currentPrice * (prevRate / exchangeRate)).toFixed(4));
          const vatRate = Number(item.vat_rate) || 0;
          const total = Number(((item.quantity || 0) * newPrice).toFixed(4));
          const vatAmount = Number((total * (vatRate / 100)).toFixed(4));
          return {
            ...item,
            unit_price: newPrice,
            total: total,
            vat_amount: vatAmount
          };
        }));
      }
      prevExchangeRateRef.current = exchangeRate;
    }
  }, [exchangeRate, isModalOpen]);

  useEffect(() => {
    if (user?.id) {
      const saved = localStorage.getItem(`invoices_visible_columns_${user.id}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setVisibleColumns(prev => ({
            ...prev,
            ...parsed
          }));
        } catch (e) {
          console.error('Failed to parse saved visible columns', e);
        }
      }
    }
  }, [user?.id]);

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
        setLoading(false);
      });
      
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
      return () => {
        unsubInvoices();
      };
    }
  }, [user, page, limit, sortBy, sortOrder, searchTerm]);

  // Fetch static dropdown catalogs once on mount and listen for db-refresh changes
  useEffect(() => {
    if (!user) return;

    const loadCatalogs = async () => {
      try {
        const [prodData, opsData, deptsData, ccData, pmData, accountsData, whData, currData, custData] = await Promise.all([
          dbService.list<Product>('products', user.company_id),
          dbService.list<Operation>('operations', user.company_id),
          dbService.list<Department>('departments', user.company_id),
          dbService.list<CostCenter>('cost_centers', user.company_id),
          dbService.list<any>('payment_methods', user.company_id),
          dbService.list<Account>('accounts', user.company_id),
          dbService.list<any>('warehouses', user.company_id),
          dbService.list<Currency>('currencies', user.company_id),
          dbService.list<Customer>('customers', user.company_id)
        ]);

        setProducts(prodData);
        setOperations(opsData);
        setDepartments(deptsData);
        setCostCenters(ccData);
        setPaymentMethods(pmData);
        setAccounts(accountsData);
        setWarehouses(whData);
        setCompanyCurrencies(currData);
        setCustomers(custData);
      } catch (err) {
        console.error('Error loading dropdown catalogs:', err);
      }
    };

    loadCatalogs();

    const handleDbRefresh = async (e: any) => {
      const collection = e.detail?.collection;
      if (!collection) return;

      try {
        if (collection === 'products') {
          const data = await dbService.list<Product>('products', user.company_id);
          setProducts(data);
        } else if (collection === 'operations') {
          const data = await dbService.list<Operation>('operations', user.company_id);
          setOperations(data);
        } else if (collection === 'departments') {
          const data = await dbService.list<Department>('departments', user.company_id);
          setDepartments(data);
        } else if (collection === 'cost_centers') {
          const data = await dbService.list<CostCenter>('cost_centers', user.company_id);
          setCostCenters(data);
        } else if (collection === 'payment_methods') {
          const data = await dbService.list<any>('payment_methods', user.company_id);
          setPaymentMethods(data);
        } else if (collection === 'accounts') {
          const data = await dbService.list<Account>('accounts', user.company_id);
          setAccounts(data);
        } else if (collection === 'warehouses') {
          const data = await dbService.list<any>('warehouses', user.company_id);
          setWarehouses(data);
        } else if (collection === 'currencies') {
          const data = await dbService.list<Currency>('currencies', user.company_id);
          setCompanyCurrencies(data);
        } else if (collection === 'customers') {
          const data = await dbService.list<Customer>('customers', user.company_id);
          setCustomers(data);
        }
      } catch (err) {
        console.error(`Error refreshing collection ${collection}:`, err);
      }
    };

    window.addEventListener('db-refresh', handleDbRefresh as EventListener);
    return () => {
      window.removeEventListener('db-refresh', handleDbRefresh as EventListener);
    };
  }, [user]);

  // Load transaction and settlements data once (non-polling) when modal is opened or document is viewed
  useEffect(() => {
    const loadSettlementData = async () => {
      const needData = isModalOpen || !!viewInvoice || !!editingInvoice;
      if (user && needData) {
        try {
          const [receipts, payments, rets, prs, invs, pinvs, jEntries] = await Promise.all([
            dbService.list<any>('receipt_vouchers', user.company_id),
            dbService.list<any>('payment_vouchers', user.company_id),
            dbService.list<any>('returns', user.company_id),
            dbService.list<any>('purchase_returns', user.company_id),
            dbService.list<any>('invoices', user.company_id),
            dbService.list<any>('purchase_invoices', user.company_id),
            dbService.list<JournalEntry>('journal_entries', user.company_id)
          ]);
          setAllReceipts(receipts);
          setAllPayments(payments);
          setAllReturns(rets);
          setAllPurchaseReturns(prs);
          setAllInvoices(invs);
          setAllPurchaseInvoices(pinvs);
          setEntries(jEntries);
        } catch (error) {
          console.error('Failed to load transaction data:', error);
        }
      }
    };
    loadSettlementData();
  }, [user, isModalOpen, viewInvoice, editingInvoice]);

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
              if (String(s.target_id) === String(inv.id)) {
                voucherSettlements.push({
                  id: `${v.id}-${s.target_id}`,
                  date: v.date,
                  type_label: 'سند قبض',
                  number: v.voucher_number || v.number || v.id,
                  page_name: 'receipts',
                  amount: Number(s.settled_amount) || 0,
                  notes: v.description || v.notes || '',
                  settlement_number: s.settlement_number || ''
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
              if (String(s.target_id) === String(inv.id)) {
                voucherSettlements.push({
                  id: `${v.id}-${s.target_id}`,
                  date: v.date,
                  type_label: 'سند صرف',
                  number: v.voucher_number || v.number || v.id,
                  page_name: 'payment_vouchers',
                  amount: Number(s.settled_amount) || 0,
                  notes: v.description || v.notes || '',
                  settlement_number: s.settlement_number || ''
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
      if (String(je.reference_id) === String(inv.id) || je.reference_number === inv.invoice_number) {
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

    // Invoice-side settlements (only add those not already found from voucher side)
    const invoiceSideSettlements: any[] = [];
    // Track which voucher original IDs have already been counted from voucherSettlements
    // voucherSettlements id format: "${voucherId}-${inv.id}"
    const countedVoucherIds = new Set<string>();
    voucherSettlements.forEach(vs => {
      // Extract the voucher id from the composite id
      // The id was built as `${v.id}-${s.target_id}` where s.target_id = inv.id
      // So voucher id = everything before the last "-" + inv.id part
      const voucherId = vs.id.replace(`-${String(inv.id)}`, '');
      countedVoucherIds.add(voucherId);
    });
    
    if (inv.settlements && Array.isArray(inv.settlements)) {
      inv.settlements.forEach((s: any) => {
        // s.target_id is the voucher reference like "REC_ID-0"
        // Check if the voucher original_id (without -idx) was already counted
        // target_id format: "${voucherId}-${idx}" 
        const parts = (s.target_id || '').split('-');
        const voucherOriginalId = parts.length > 1 ? parts.slice(0, -1).join('-') : s.target_id;
        const alreadyCounted = countedVoucherIds.has(voucherOriginalId) || countedVoucherIds.has(s.target_id);
        
        // Verify target document exists in our loaded data
        let targetExists = false;
        const targetType = s.type || s.page_name;
        
        if (targetType === 'receipts' || targetType === 'receipt') {
          targetExists = allReceipts.some((v: any) => String(v.id) === String(voucherOriginalId));
        } else if (targetType === 'payment_vouchers' || targetType === 'payment') {
          targetExists = allPayments.some((v: any) => String(v.id) === String(voucherOriginalId));
        } else if (targetType === 'returns' || targetType === 'return') {
          targetExists = allReturns.some((r: any) => String(r.id) === String(voucherOriginalId));
        } else if (targetType === 'purchase_returns' || targetType === 'purchase_return') {
          targetExists = allPurchaseReturns.some((r: any) => String(r.id) === String(voucherOriginalId));
        } else if (targetType === 'journal_entries' || targetType === 'journal') {
          targetExists = entries.some((je: any) => String(je.id) === String(voucherOriginalId));
        } else {
          // Fallback check in all loaded documents
          targetExists = allReceipts.some((v: any) => String(v.id) === String(voucherOriginalId)) ||
                         allPayments.some((v: any) => String(v.id) === String(voucherOriginalId)) ||
                         allReturns.some((r: any) => String(r.id) === String(voucherOriginalId)) ||
                         allPurchaseReturns.some((r: any) => String(r.id) === String(voucherOriginalId)) ||
                         entries.some((je: any) => String(je.id) === String(voucherOriginalId));
        }

        if (targetExists && !alreadyCounted) {
          invoiceSideSettlements.push({
            id: `${inv.id}-${s.target_id}`,
            date: s.settlement_date || s.date || inv.date,
            type_label: s.type_label || 'تسوية',
            number: s.settlement_number || s.reference_number || s.target_id,
            page_name: s.type || 'receipts',
            amount: Number(s.settled_amount || s.amount) || 0,
            notes: s.notes || ''
          });
        }
      });
    }

    return [...voucherSettlements, ...returnSettlements, ...jeSettlements, ...invoiceSideSettlements];
  };

  const getPaymentStatus = (inv: any) => {
    if (!inv) return 'unpaid';
    if (inv.payment_type === 'cash') return 'paid';
    
    // Only query heavy references if they are loaded (i.e. modal is open)
    const hasFullData = allReceipts.length > 0 || allPayments.length > 0 || entries.length > 0;
    const settlements = hasFullData ? getInvoiceSettlements(inv) : (inv.settlements || []);
    const totalSettled = settlements.reduce((sum: number, s: any) => sum + (Number(s.settled_amount || s.amount) || 0), 0);
    
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

  const getSettlementsForTarget = (targetId: string, excludeInvoiceId?: string, jeRefType?: string) => {
    let settledSum = 0;
    
    const sumInvoiceSettlements = (invoicesList: any[]) => {
      invoicesList.forEach(inv => {
        if (excludeInvoiceId && inv.id === excludeInvoiceId) return;
        if (inv.settlements && Array.isArray(inv.settlements)) {
          inv.settlements.forEach((s: any) => {
            if (s.target_id === targetId || (jeRefType === 'opening_balance' && s.target_id === `OPEN-${selectedCustomerId}`)) {
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
                if (s.target_id === targetId || (jeRefType === 'opening_balance' && s.target_id === `OPEN-${selectedCustomerId}`)) {
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

  const getInvoiceSideSettlementsForVoucherItem = (targetId: string, excludeInvoiceId?: string) => {
    const results: { invoiceId: string; amount: number }[] = [];
    
    const checkList = (invoicesList: any[]) => {
      invoicesList.forEach(inv => {
        if (excludeInvoiceId && inv.id === excludeInvoiceId) return;
        if (inv.settlements && Array.isArray(inv.settlements)) {
          inv.settlements.forEach((s: any) => {
            if (s.target_id === targetId) {
              results.push({
                invoiceId: inv.id,
                amount: Number(s.settled_amount || s.amount) || 0
              });
            }
          });
        }
      });
    };

    checkList(allInvoices);
    checkList(allPurchaseInvoices);
    return results;
  };

  const getOppositeMovements = (customerId: string) => {
    if (!customerId) return [];

    const movements: any[] = [];

    // 1. Receipt Vouchers
    allReceipts.forEach(v => {
      if (v.items && Array.isArray(v.items)) {
        v.items.forEach((item: any, idx: number) => {
          if (item.customer_id === customerId || (item.type === 'customer' && item.entity_id === customerId)) {
            const countedInvoiceIds = new Set<string>();
            let totalSettled = 0;

            if (item.settlements && Array.isArray(item.settlements)) {
              item.settlements.forEach((s: any) => {
                if (!editingInvoice || s.target_id !== editingInvoice.id) {
                  totalSettled += Number(s.settled_amount || s.amount || 0);
                  countedInvoiceIds.add(s.target_id);
                }
              });
            }

            const invoiceSettlements = getInvoiceSideSettlementsForVoucherItem(`${v.id}-${idx}`, editingInvoice?.id);
            invoiceSettlements.forEach((s: any) => {
              if (!countedInvoiceIds.has(s.invoiceId)) {
                totalSettled += s.amount;
              }
            });

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
      if (r.customer_id === customerId && r.payment_type !== 'cash') {
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
      const standardTypes = ['invoice', 'purchase_invoice', 'receipt', 'payment', 'return', 'purchase_return', 'receipt_voucher', 'payment_voucher'];
      if (je.reference_type && standardTypes.includes(je.reference_type)) {
        return;
      }
      
      je.items?.forEach((item: any, idx: number) => {
        if (item.customer_id === customerId && Number(item.credit) > 0) {
          const originalAmount = Number(item.credit) || 0;
          const invoiceSettled = getSettlementsForTarget(`${je.id}-${idx}`, editingInvoice?.id, je.reference_type);
          const openAmount = originalAmount - invoiceSettled;

          if (openAmount > 0.01 || formSettlements.some(fs => fs.target_id === `${je.id}-${idx}`)) {
            movements.push({
              id: `${je.id}-${idx}`,
              original_id: je.id,
              date: je.date,
              type_label: je.reference_type === 'opening_balance' ? 'رصيد افتتاحي' : 'قيد يومية',
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
    // Default settlement date = the LATER of invoice date and transaction date
    const invoiceDate = date.slice(0, 10);
    const txDate = (targetTx.date || '').slice(0, 10);
    const defaultDate = txDate && txDate > invoiceDate ? txDate : invoiceDate;
    const rowDate = rowSettlementDates[targetTx.id] || defaultDate;

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
        settlement_date: rowDate,
        created_from: 'invoices'
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
    if (invoiceRef.current) {
      printElement(invoiceRef.current);
    }
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
      const subtotal = (items || []).reduce((sum, item) => sum + (Number(item.total) || 0), 0);
      const vatTotal = isVatEnabled
        ? (items || []).reduce((sum, item) => sum + (Number(item.vat_amount) || 0), 0)
        : 0;
      const total_amount = subtotal + vatTotal - Number(discount || 0);
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
      const rate = Number(exchangeRate) || 1;

      const subtotalVal = Number(items.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_price || 0)), 0)) || 0;
      const discountVal = Number(discount) || 0;

      (items || []).forEach(item => {
        if (!item.product_id) return;
        const product = products.find(p => p.id === item.product_id);
        if (!product) return;

        const itemTotal = Number((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)) || 0;
        const itemVat = isVatEnabled ? Number(item.vat_amount) || 0 : 0;
        
        // Proportional discount allocation
        const itemDiscount = subtotalVal > 0 ? Number(((itemTotal / subtotalVal) * discountVal).toFixed(2)) : 0;
        const itemNetTotal = Number((itemTotal + itemVat - itemDiscount).toFixed(2));

        // 1. Debit: Customer or Payment Method (Cash)
        let debitAccountId = '';
        let debitAccountName = '';

        if (paymentType === 'cash') {
          const pm = paymentMethods.find(p => p.id === paymentMethodId);
          debitAccountId = pm?.account_id || '';
          debitAccountName = pm?.account_name || 'حساب النقدية';
        } else {
          debitAccountId = customer?.account_id || '';
          debitAccountName = customer?.account_name || 'حساب العملاء';
        }

        const debitAcc = accounts.find(a => a.id === debitAccountId);
        const debitAccountCode = debitAcc?.code || '';

        if (paymentType === 'cash') {
          journalItems.push({
            account_id: debitAccountId,
            account_name: debitAccountName,
            account_code: debitAccountCode,
            product_name: item.product_name,
            debit: Number((itemNetTotal * rate).toFixed(2)),
            credit: 0,
            description: `تحصيل نقدي - صنف: ${item.product_name} - فاتورة رقم ${invoice_number}`,
            sub_account_id: paymentMethodId,
            sub_account_type: 'payment_method'
          });
        } else {
          journalItems.push({
            account_id: debitAccountId,
            account_name: debitAccountName,
            account_code: debitAccountCode,
            product_name: item.product_name,
            debit: Number((itemNetTotal * rate).toFixed(2)),
            credit: 0,
            description: `مبيعات عملاء - صنف: ${item.product_name} - فاتورة رقم ${invoice_number}`,
            sub_account_id: customer?.id,
            sub_account_type: 'customer'
          });
        }

        // 2. Debit: Discount Account (if proportional discount > 0)
        if (itemDiscount > 0) {
          const discountAccountId = settings?.customer_discount_account_id || '';
          const discountAccount = accounts.find(a => a.id === discountAccountId);
          journalItems.push({
            account_id: discountAccountId,
            account_name: discountAccount?.name || 'حساب الخصم المسموح به',
            account_code: discountAccount?.code || '',
            product_name: item.product_name,
            debit: Number((itemDiscount * rate).toFixed(2)),
            credit: 0,
            description: `خصم مسموح به - صنف: ${item.product_name} - فاتورة رقم ${invoice_number}`
          });
        }

        // 3. Credit: Sales Accounts
        let creditAccountId = product.revenue_account_id || '';
        let creditAccountName = product.revenue_account_name || 'حساب المبيعات';
        const creditAcc = accounts.find(a => a.id === creditAccountId);
        const creditAccountCode = creditAcc?.code || '';

        journalItems.push({
          account_id: creditAccountId,
          account_name: creditAccountName,
          account_code: creditAccountCode,
          product_name: item.product_name,
          debit: 0,
          credit: Number((itemTotal * rate).toFixed(2)),
          description: `مبيعات صنف: ${item.product_name} - فاتورة ${invoice_number}`
        });

        // 4. Credit: VAT Liability Account
        if (itemVat > 0) {
          let vatAccountId = product.vat_account_id || '';
          let vatAccountName = product.vat_account_name || (language === 'ar' ? 'حساب ضريبة القيمة المضافة' : 'VAT Liability Account');

          if (!vatAccountId) {
            const globalVatAccount = accounts.find(a => 
              a.name.includes('ضريبة القيمة المضافة') || 
              a.name.includes('قيمة مضافة') || 
              a.name.includes('ضريبة مبيعات')
            );
            vatAccountId = globalVatAccount?.id || '';
            vatAccountName = globalVatAccount?.name || vatAccountName;
          }
          const vatAccount = accounts.find(a => a.id === vatAccountId);
          journalItems.push({
            account_id: vatAccountId,
            account_name: vatAccountName,
            account_code: vatAccount?.code || '',
            product_name: item.product_name,
            debit: 0,
            credit: Number((itemVat * rate).toFixed(2)),
            description: `ضريبة القيمة المضافة - صنف: ${item.product_name} - فاتورة رقم ${invoice_number}`
          });
        }

        // 5. Debit COGS & Credit Inventory (for physical products)
        if (product.type !== 'service') {
          const itemCost = Number((item.quantity * (product.cost_price || 0)).toFixed(2));
          if (itemCost > 0) {
            // Debit: COGS Account
            let costAccId = product.cost_account_id || '';
            let costAccName = product.cost_account_name || 'تكلفة المبيعات';
            if (!costAccId) {
              const fallbackCostAcc = accounts.find(a => a.name.includes('تكلفة المبيعات') || a.name.includes('تكلفة مبيعات') || a.name.includes('تكلفة البضاعة المباعة'));
              if (fallbackCostAcc) {
                costAccId = fallbackCostAcc.id;
                costAccName = fallbackCostAcc.name;
              }
            }
            const costAcc = accounts.find(a => a.id === costAccId);
            journalItems.push({
              account_id: costAccId,
              account_name: costAccName,
              account_code: costAcc?.code || '',
              product_name: item.product_name,
              debit: itemCost,
              credit: 0,
              description: `تكلفة البضاعة المباعة - صنف: ${item.product_name} - فاتورة ${invoice_number}`
            });

            // Credit: Inventory Account
            let invAccId = product.inventory_account_id || '';
            let invAccName = product.inventory_account_name || 'المخزون';
            if (!invAccId) {
              const fallbackInvAcc = accounts.find(a => a.name.includes('مخزون') || a.name.includes('مخازن'));
              if (fallbackInvAcc) {
                invAccId = fallbackInvAcc.id;
                invAccName = fallbackInvAcc.name;
              }
            }
            const invAcc = accounts.find(a => a.id === invAccId);
            journalItems.push({
              account_id: invAccId,
              account_name: invAccName,
              account_code: invAcc?.code || '',
              product_name: item.product_name,
              debit: 0,
              credit: itemCost,
              description: `تخفيض المخزون - صنف: ${item.product_name} - فاتورة ${invoice_number}`
            });
          }
        }
      });

      const sumDebits = Number(journalItems.reduce((s, x) => s + (Number(x.debit) || 0), 0).toFixed(2)) || 0;
      const sumCredits = Number(journalItems.reduce((s, x) => s + (Number(x.credit) || 0), 0).toFixed(2)) || 0;

      setPreviewJournalEntry({
        id: 'preview',
        date,
        reference_number: invoice_number,
        reference_id: 'preview',
        reference_type: 'invoice',
        description: `قيد فاتورة مبيعات رقم ${invoice_number}`,
        items: journalItems,
        total_debit: sumDebits,
        total_credit: sumCredits,
        company_id: user.company_id,
        created_at: new Date().toISOString(),
        created_by: user.id
      });
    };

    generatePreview();
  }, [isModalOpen, items, discount, selectedCustomerId, paymentType, paymentMethodId, date, user, customers, products, paymentMethods, accounts, editingInvoice, settings, exchangeRate]);

  const addItem = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const rate = Number(exchangeRate) || 1;
    const foreignPrice = Number((product.sale_price / rate).toFixed(4));
    setItems(prev => [...prev, {
      product_id: product.id,
      product_name: product.name,
      product_code: product.code,
      product_image_url: product.image_url,
      quantity: 1,
      unit_price: foreignPrice,
      vat_rate: product.vat_rate || 0,
      vat_amount: foreignPrice * ((product.vat_rate || 0) / 100),
      total: foreignPrice,
      barcode: product.barcode || '',
      image_url: product.image_url || '',
      operation_id: selectedOperationId || null,
      department_id: selectedDepartmentId || null,
      cost_center_id: selectedCostCenterId || null
    }]);
  };

  const addEmptyRow = () => {
    setItems(prev => [...prev, {
      product_id: '',
      product_name: '',
      quantity: 1,
      unit_price: 0,
      vat_rate: 0,
      vat_amount: 0,
      total: 0,
      barcode: '',
      image_url: '',
      operation_id: selectedOperationId || null,
      department_id: selectedDepartmentId || null,
      cost_center_id: selectedCostCenterId || null
    }]);
  };

  // ── Barcode scanner handlers ────────────────────────────────────────────
  const barcodeSettings: BarcodeScannerSettings = {
    ...DEFAULT_BARCODE_SETTINGS,
    ...(companyData?.settings?.barcode_scanner || {}),
  };

  const addItemByBarcode = (product: any) => {
    if (barcodeSettings.auto_increase_quantity) {
      const existingIndex = items.findIndex(i => i.product_id === product.id);
      if (existingIndex !== -1) {
        setItems(prev => prev.map((item, idx) =>
          idx === existingIndex
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.unit_price }
            : item
        ));
        if (barcodeSettings.show_success_message) {
          showNotification(
            language === 'ar'
              ? `تمت زيادة كمية: ${product.name}`
              : `Quantity increased: ${product.name}`,
            'success'
          );
        }
        return;
      }
    }
    addItem(product.id);
    if (barcodeSettings.show_success_message) {
      showNotification(
        language === 'ar'
          ? `تمت إضافة: ${product.name}`
          : `Added: ${product.name}`,
        'success'
      );
    }
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
          const rate = Number(exchangeRate) || 1;
          const foreignPrice = Number((product.sale_price / rate).toFixed(4));
          item.product_name = product.name;
          item.product_image_url = product.image_url;
          item.unit_price = foreignPrice;
          item.vat_rate = product.vat_rate || 0;
          item.total = (item.quantity || 0) * foreignPrice;
          item.vat_amount = item.total * ((product.vat_rate || 0) / 100);
          item.barcode = product.barcode || '';
          item.image_url = product.image_url || '';
        } else {
          item.product_name = '';
          item.product_image_url = '';
          item.unit_price = 0;
          item.vat_rate = 0;
          item.total = 0;
          item.vat_amount = 0;
          item.barcode = '';
          item.image_url = '';
        }
      }

      if (field === 'operation_id') {
        const op = operations.find(o => o.id === value);
        if (op) {
          if (op.department_id) {
            item.department_id = op.department_id;
          }
          if (op.cost_center_id) {
            item.cost_center_id = op.cost_center_id;
          }
        }
      }
      
      if (field === 'quantity' || field === 'unit_price' || field === 'vat_rate') {
        item.total = (item.quantity || 0) * (item.unit_price || 0);
        item.vat_amount = item.total * ((item.vat_rate || 0) / 100);
      }
      
      newItems[index] = item;
      return newItems;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSubmitting) return;
    setIsSubmitting(true);
    if (!selectedCustomerId) {
      showNotification('يرجى اختيار العميل', 'error');
      return;
    }

    if (invoiceType === 'items' && !selectedWarehouseId) {
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

      const sanitizedItems = validItems.map(i => {
        const prod = products.find(p => p.id === i.product_id);
        const rate = i.vat_rate !== undefined ? i.vat_rate : (prod?.vat_rate || 0);
        const total = Number((Number(i.quantity) || 0) * (Number(i.unit_price) || 0)) || 0;
        const vat_amount = isVatEnabled ? Number((total * (rate / 100)).toFixed(2)) : 0;
        return {
          product_id: i.product_id,
          product_name: i.product_name,
          product_code: i.product_code || '',
          product_image_url: i.product_image_url || i.image_url || '',
          quantity: Number(i.quantity) || 0,
          unit_price: Number(i.unit_price) || 0,
          total: total,
          vat_rate: rate,
          vat_amount: vat_amount,
          barcode: i.barcode || '',
          image_url: i.image_url || '',
          operation_id: i.operation_id || null,
          department_id: i.department_id || null,
          cost_center_id: i.cost_center_id || null
        };
      });

      const vatTotal = isVatEnabled
        ? Number(sanitizedItems.reduce((sum, item) => sum + (Number(item.vat_amount) || 0), 0).toFixed(2))
        : 0;

      const total_amount = Number(subtotal + vatTotal - discount_amount) || 0;

      // Calculate changes if editing
      const changes: any[] = [];
      const detailsList: string[] = [];

      if (editingInvoice) {
        // 1. Date
        if (editingInvoice.date !== date) {
          const oldDateFormatted = formatDate(editingInvoice.date);
          const newDateFormatted = formatDate(date);
          changes.push({
            field: language === 'ar' ? 'التاريخ' : 'Date',
            old_value: oldDateFormatted,
            new_value: newDateFormatted
          });
          detailsList.push(language === 'ar' ? `تغيير التاريخ من ${oldDateFormatted} إلى ${newDateFormatted}` : `Date changed from ${oldDateFormatted} to ${newDateFormatted}`);
        }

        // 2. Customer
        if (editingInvoice.customer_id !== selectedCustomerId) {
          const oldCustomer = customers.find(c => c.id === editingInvoice.customer_id)?.name || editingInvoice.customer_name || editingInvoice.customer_id;
          const newCustomer = customers.find(c => c.id === selectedCustomerId)?.name || selectedCustomerId;
          changes.push({
            field: language === 'ar' ? 'العميل' : 'Customer',
            old_value: oldCustomer,
            new_value: newCustomer
          });
          detailsList.push(language === 'ar' ? `تغيير العميل من ${oldCustomer} إلى ${newCustomer}` : `Customer changed from ${oldCustomer} to ${newCustomer}`);
        }

        // 3. Currency
        const oldCurrencyId = editingInvoice.currency_id || '';
        const newCurrencyId = selectedCurrencyId || '';
        if (oldCurrencyId !== newCurrencyId) {
          const oldCurr = companyCurrencies.find(c => c.id === oldCurrencyId)?.code || oldCurrencyId || 'EGP';
          const newCurr = companyCurrencies.find(c => c.id === newCurrencyId)?.code || newCurrencyId || 'EGP';
          changes.push({
            field: language === 'ar' ? 'العملة' : 'Currency',
            old_value: oldCurr,
            new_value: newCurr
          });
          detailsList.push(language === 'ar' ? `تغيير العملة من ${oldCurr} إلى ${newCurr}` : `Currency changed from ${oldCurr} to ${newCurr}`);
        }

        // 4. Exchange Rate
        const oldRate = Number(editingInvoice.exchange_rate) || 1;
        const newRate = Number(exchangeRate) || 1;
        if (oldRate !== newRate) {
          changes.push({
            field: language === 'ar' ? 'سعر الصرف' : 'Exchange Rate',
            old_value: oldRate,
            new_value: newRate
          });
          detailsList.push(language === 'ar' ? `تغيير سعر الصرف من ${oldRate} إلى ${newRate}` : `Exchange rate changed from ${oldRate} to ${newRate}`);
        }

        // 5. Discount
        const oldDiscount = Number(editingInvoice.discount_amount || editingInvoice.discount) || 0;
        const newDiscount = Number(discount_amount) || 0;
        if (oldDiscount !== newDiscount) {
          changes.push({
            field: language === 'ar' ? 'الخصم' : 'Discount',
            old_value: oldDiscount,
            new_value: newDiscount
          });
          detailsList.push(language === 'ar' ? `تغيير الخصم من ${oldDiscount} إلى ${newDiscount}` : `Discount changed from ${oldDiscount} to ${newDiscount}`);
        }

        // 6. Tax
        const oldTax = Number(editingInvoice.tax_amount) || 0;
        const newTax = Number(vatTotal) || 0;
        if (oldTax !== newTax) {
          changes.push({
            field: language === 'ar' ? 'الضريبة' : 'Tax',
            old_value: oldTax,
            new_value: newTax
          });
          detailsList.push(language === 'ar' ? `تغيير قيمة الضريبة من ${oldTax} إلى ${newTax}` : `Tax amount changed from ${oldTax} to ${newTax}`);
        }

        // 7. Total Amount
        const oldTotal = Number(editingInvoice.total_amount) || 0;
        const newTotal = Number(total_amount) || 0;
        if (oldTotal !== newTotal) {
          changes.push({
            field: language === 'ar' ? 'إجمالي الفاتورة' : 'Total Amount',
            old_value: oldTotal,
            new_value: newTotal
          });
          detailsList.push(language === 'ar' ? `تغيير الإجمالي من ${oldTotal} إلى ${newTotal}` : `Total amount changed from ${oldTotal} to ${newTotal}`);
        }

        // 8. Description
        const oldDesc = editingInvoice.description || '';
        const newDesc = description || '';
        if (oldDesc !== newDesc) {
          changes.push({
            field: language === 'ar' ? 'الوصف' : 'Description',
            old_value: oldDesc || (language === 'ar' ? 'فارغ' : 'Empty'),
            new_value: newDesc || (language === 'ar' ? 'فارغ' : 'Empty')
          });
          detailsList.push(language === 'ar' ? `تعديل وصف الفاتورة` : `Description updated`);
        }

        // 9. Items Diff
        const oldItems = editingInvoice.items || [];
        const newItems = sanitizedItems;

        // Check for deleted items
        oldItems.forEach(oldItem => {
          const stillExists = newItems.some(newItem => newItem.product_id === oldItem.product_id);
          if (!stillExists) {
            changes.push({
              field: language === 'ar' ? 'حذف صنف' : 'Delete Product',
              old_value: `${oldItem.product_name} (${oldItem.quantity} × ${oldItem.unit_price})`,
              new_value: language === 'ar' ? 'تم الحذف' : 'Deleted'
            });
            detailsList.push(language === 'ar' ? `حذف الصنف: ${oldItem.product_name}` : `Deleted product: ${oldItem.product_name}`);
          }
        });

        // Check for added items
        newItems.forEach(newItem => {
          const wasPresent = oldItems.some(oldItem => oldItem.product_id === newItem.product_id);
          if (!wasPresent) {
            changes.push({
              field: language === 'ar' ? 'إضافة صنف' : 'Add Product',
              old_value: language === 'ar' ? 'جديد' : 'New',
              new_value: `${newItem.product_name} (${newItem.quantity} × ${newItem.unit_price})`
            });
            detailsList.push(language === 'ar' ? `إضافة صنف جديد: ${newItem.product_name}` : `Added new product: ${newItem.product_name}`);
          }
        });

        // Check for modified items
        newItems.forEach(newItem => {
          const oldItem = oldItems.find(oi => oi.product_id === newItem.product_id);
          if (oldItem) {
            const qtyChanged = Number(oldItem.quantity) !== Number(newItem.quantity);
            const priceChanged = Number(oldItem.unit_price) !== Number(newItem.unit_price);
            const opChanged = oldItem.operation_id !== newItem.operation_id;
            const ccChanged = oldItem.cost_center_id !== newItem.cost_center_id;
            const deptChanged = oldItem.department_id !== newItem.department_id;

            if (qtyChanged || priceChanged || opChanged || ccChanged || deptChanged) {
              const diffParts: string[] = [];
              if (qtyChanged) diffParts.push(language === 'ar' ? `الكمية من ${oldItem.quantity} إلى ${newItem.quantity}` : `Qty from ${oldItem.quantity} to ${newItem.quantity}`);
              if (priceChanged) diffParts.push(language === 'ar' ? `السعر من ${oldItem.unit_price} إلى ${newItem.unit_price}` : `Price from ${oldItem.unit_price} to ${newItem.unit_price}`);
              if (opChanged) {
                const oldOp = operations.find(o => o.id === oldItem.operation_id)?.operation_number || '-';
                const newOp = operations.find(o => o.id === newItem.operation_id)?.operation_number || '-';
                diffParts.push(language === 'ar' ? `العملية من ${oldOp} إلى ${newOp}` : `Operation from ${oldOp} to ${newOp}`);
              }
              if (ccChanged) {
                const oldCc = costCenters.find(c => c.id === oldItem.cost_center_id)?.name || '-';
                const newCc = costCenters.find(c => c.id === newItem.cost_center_id)?.name || '-';
                diffParts.push(language === 'ar' ? `مركز التكلفة من ${oldCc} إلى ${newCc}` : `Cost center from ${oldCc} to ${newCc}`);
              }
              if (deptChanged) {
                const oldDept = departments.find(d => d.id === oldItem.department_id)?.name || '-';
                const newDept = departments.find(d => d.id === newItem.department_id)?.name || '-';
                diffParts.push(language === 'ar' ? `الإدارة من ${oldDept} إلى ${newDept}` : `Department from ${oldDept} to ${newDept}`);
              }
              
              changes.push({
                field: (language === 'ar' ? 'تعديل صنف: ' : 'Edit Product: ') + newItem.product_name,
                old_value: `${language === 'ar' ? 'الكمية:' : 'Qty:'} ${oldItem.quantity}، ${language === 'ar' ? 'السعر:' : 'Price:'} ${oldItem.unit_price}`,
                new_value: `${language === 'ar' ? 'الكمية:' : 'Qty:'} ${newItem.quantity}، ${language === 'ar' ? 'السعر:' : 'Price:'} ${newItem.unit_price} (${diffParts.join('، ')})`
              });
              detailsList.push(language === 'ar' ? `تعديل تفاصيل الصنف: ${newItem.product_name}` : `Updated details of product: ${newItem.product_name}`);
            }
          }
        });
      }

      // Over-settlement validation
      const totalSettled = formSettlements.reduce((sum, s) => sum + Number(s.settled_amount), 0);
      if (totalSettled > total_amount) {
        showNotification('التسوية أكبر من المبلغ الإجمالي', 'error');
        return;
      }
      
      const customer = customers.find(c => c.id === selectedCustomerId);
      const paymentMethod = paymentMethods.find(pm => pm.id === paymentMethodId);

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
        tax_amount: vatTotal,
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
        due_date: dueDate,
        operation_id: selectedOperationId || null,
        department_id: selectedDepartmentId || null,
        cost_center_id: selectedCostCenterId || null,
        currency_id: selectedCurrencyId || null,
        exchange_rate: Number(exchangeRate) || 1
      };

      // Journal items generation
      const journalItems: any[] = [];
      const rate = Number(exchangeRate) || 1;
      let customerAccountId = customer?.account_id || '';
      let customerAccountName = customer?.account_name || 'حساب العملاء';
      const custAcc = accounts.find(a => a.id === customerAccountId);
      const customerAccountCode = custAcc?.code || '';

      sanitizedItems.forEach(item => {
        const product = products.find(p => p.id === item.product_id);
        if (!product) return;

        const itemTotal = item.total || 0;
        const itemVat = item.vat_amount || 0;
        
        // Proportional discount allocation
        const itemDiscount = subtotal > 0 ? Number(((itemTotal / subtotal) * discount_amount).toFixed(2)) : 0;
        const itemNetTotal = Number((itemTotal + itemVat - itemDiscount).toFixed(2));

        // 1. Debit: Customer or Payment Method (Cash)
        if (paymentType === 'cash') {
          const pm = paymentMethods.find(p => p.id === paymentMethodId);
          let cashAccountId = pm?.account_id || '';
          let cashAccountName = pm?.account_name || 'حساب النقدية';
          const cashAccount = accounts.find(a => a.id === cashAccountId);

          journalItems.push({
            account_id: cashAccountId,
            account_name: cashAccountName,
            account_code: cashAccount?.code || '',
            product_name: item.product_name,
            debit: Number((itemNetTotal * rate).toFixed(2)),
            credit: 0,
            description: `تحصيل نقدي - صنف: ${item.product_name} - فاتورة رقم ${invoiceNumber}`,
            sub_account_id: paymentMethodId,
            sub_account_type: 'payment_method'
          });
        } else {
          journalItems.push({
            account_id: customerAccountId,
            account_name: customerAccountName,
            account_code: customerAccountCode,
            product_name: item.product_name,
            debit: Number((itemNetTotal * rate).toFixed(2)),
            credit: 0,
            description: `مبيعات عملاء - صنف: ${item.product_name} - فاتورة رقم ${invoiceNumber}`,
            customer_id: selectedCustomerId,
            customer_name: customer?.name,
            sub_account_id: selectedCustomerId,
            sub_account_type: 'customer'
          });
        }

        // 2. Debit: Discount (if any)
        if (itemDiscount > 0) {
          const discountAccountId = settings?.customer_discount_account_id || '';
          const discountAccount = accounts.find(a => a.id === discountAccountId);
          journalItems.push({
            account_id: discountAccountId,
            account_name: discountAccount?.name || 'حساب الخصم المسموح به',
            account_code: discountAccount?.code || '',
            product_name: item.product_name,
            debit: Number((itemDiscount * rate).toFixed(2)),
            credit: 0,
            description: `خصم مسموح به - صنف: ${item.product_name} - فاتورة رقم ${invoiceNumber}`
          });
        }

        // 3. Credit: Sales Accounts
        let creditAccountId = product.revenue_account_id || '';
        let creditAccountName = product.revenue_account_name || 'حساب المبيعات';
        const creditAccount = accounts.find(a => a.id === creditAccountId);
        const creditAccountCode = creditAccount?.code || '';

        journalItems.push({
          account_id: creditAccountId,
          account_name: creditAccountName,
          account_code: creditAccountCode,
          product_name: item.product_name,
          debit: 0,
          credit: Number((itemTotal * rate).toFixed(2)),
          description: `مبيعات صنف: ${item.product_name} - فاتورة ${invoiceNumber}${rate !== 1 ? ` (سعر صرف: ${rate})` : ''}`
        });

        // 4. Credit: VAT Liability Account
        if (itemVat > 0) {
          let vatAccountId = product.vat_account_id || '';
          let vatAccountName = product.vat_account_name || (language === 'ar' ? 'حساب ضريبة القيمة المضافة' : 'VAT Liability Account');

          if (!vatAccountId) {
            const globalVatAccount = accounts.find(a => 
              a.name.includes('ضريبة القيمة المضافة') || 
              a.name.includes('قيمة مضافة') || 
              a.name.includes('ضريبة مبيعات')
            );
            vatAccountId = globalVatAccount?.id || '';
            vatAccountName = globalVatAccount?.name || vatAccountName;
          }
          const vatAccount = accounts.find(a => a.id === vatAccountId);
          const vatAccountCode = vatAccount?.code || '';

          journalItems.push({
            account_id: vatAccountId,
            account_name: vatAccountName,
            account_code: vatAccountCode,
            product_name: item.product_name,
            debit: 0,
            credit: Number((itemVat * rate).toFixed(2)),
            description: `ضريبة القيمة المضافة - صنف: ${item.product_name} - فاتورة رقم ${invoiceNumber}`
          });
        }

        // 5. Debit COGS & Credit Inventory (for physical products)
        if (product.type !== 'service') {
          const itemCost = Number(product.cost_price) || 0;
          const totalCost = Number((item.quantity * itemCost).toFixed(2));

          if (totalCost > 0) {
            let costAccId = product.cost_account_id || '';
            let costAccName = product.cost_account_name || 'تكلفة المبيعات';
            if (!costAccId) {
              const fallbackCostAcc = accounts.find(a => a.name.includes('تكلفة المبيعات') || a.name.includes('تكلفة مبيعات') || a.name.includes('تكلفة البضاعة المباعة'));
              if (fallbackCostAcc) {
                costAccId = fallbackCostAcc.id;
                costAccName = fallbackCostAcc.name;
              }
            }
            const costAcc = accounts.find(a => a.id === costAccId);

            let invAccId = product.inventory_account_id || '';
            let invAccName = product.inventory_account_name || 'المخزون';
            if (!invAccId) {
              const fallbackInvAcc = accounts.find(a => a.name.includes('مخزون') || a.name.includes('مخازن'));
              if (fallbackInvAcc) {
                invAccId = fallbackInvAcc.id;
                invAccName = fallbackInvAcc.name;
              }
            }
            const invAcc = accounts.find(a => a.id === invAccId);

            // Debit COGS
            journalItems.push({
              account_id: costAccId,
              account_name: costAccName,
              account_code: costAcc?.code || '',
              product_name: item.product_name,
              debit: Number(totalCost.toFixed(2)),
              credit: 0,
              description: `تكلفة البضاعة المباعة - صنف: ${item.product_name} - فاتورة رقم ${invoiceNumber}`
            });

            // Credit Inventory
            journalItems.push({
              account_id: invAccId,
              account_name: invAccName,
              account_code: invAcc?.code || '',
              product_name: item.product_name,
              debit: 0,
              credit: Number(totalCost.toFixed(2)),
              description: `تخفيض المخزون - صنف: ${item.product_name} - فاتورة رقم ${invoiceNumber}`
            });
          }
        }
      });

      let total_debit = Number(journalItems.reduce((sum, item) => sum + (Number(item.debit) || 0), 0).toFixed(2)) || 0;
      let total_credit = Number(journalItems.reduce((sum, item) => sum + (Number(item.credit) || 0), 0).toFixed(2)) || 0;

      // Adjust for rounding differences if rate conversion introduces minor discrepancies
      const diff = Number((total_debit - total_credit).toFixed(2));
      if (diff !== 0 && journalItems.length > 0) {
        if (diff > 0) {
          // More debits than credits: add diff to the credit of the first credit item
          const creditItem = journalItems.find(item => (Number(item.credit) || 0) > 0);
          if (creditItem) {
            creditItem.credit = Number((Number(creditItem.credit) + diff).toFixed(2));
          } else {
            journalItems[0].credit = Number((Number(journalItems[0].credit) + diff).toFixed(2));
          }
        } else {
          // More credits than debits: add absolute diff to the debit of the first debit item
          const debitItem = journalItems.find(item => (Number(item.debit) || 0) > 0);
          if (debitItem) {
            debitItem.debit = Number((Number(debitItem.debit) + Math.abs(diff)).toFixed(2));
          } else {
            journalItems[0].debit = Number((Number(journalItems[0].debit) + Math.abs(diff)).toFixed(2));
          }
        }
        // Re-calculate totals
        total_debit = Number(journalItems.reduce((sum, item) => sum + (Number(item.debit) || 0), 0).toFixed(2)) || 0;
        total_credit = Number(journalItems.reduce((sum, item) => sum + (Number(item.credit) || 0), 0).toFixed(2)) || 0;
      }

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

      // === TWO-WAY SYNC: Update receipt/payment vouchers with invoice-side settlements ===
      const savedInvoiceId = editingInvoice ? editingInvoice.id : (await dbService.list<any>('invoices', { company_id: user.company_id, invoice_number: invoiceNumber }))?.[0]?.id;
      
      if (savedInvoiceId && formSettlements.length > 0) {
        try {
          // Group settlements by voucher (original_id)
          const voucherUpdates = new Map<string, { collection: string; settlements: any[] }>();
          
          for (const settlement of formSettlements) {
            // target_id format: "${voucherId}-${idx}" 
            const targetId = settlement.target_id || '';
            const parts = targetId.split('-');
            if (parts.length < 2) continue;
            
            const itemIdx = parseInt(parts[parts.length - 1], 10);
            const originalVoucherId = parts.slice(0, -1).join('-');
            
            if (isNaN(itemIdx)) continue;
            
            // Determine collection based on settlement type
            const collection = settlement.type === 'receipts' ? 'receipt_vouchers' : 
                              settlement.type === 'payment_vouchers' ? 'payment_vouchers' : null;
            if (!collection) continue;
            
            const key = `${collection}:${originalVoucherId}`;
            if (!voucherUpdates.has(key)) {
              voucherUpdates.set(key, { collection, settlements: [] });
            }
            voucherUpdates.get(key)!.settlements.push({
              ...settlement,
              itemIdx,
              invoiceId: savedInvoiceId
            });
          }
          
          // Update each voucher
          for (const [key, { collection, settlements }] of voucherUpdates) {
            const voucherId = key.split(':')[1];
            try {
              const voucher = await dbService.get<any>(collection, voucherId);
              if (!voucher || !voucher.items) continue;
              
              const updatedItems = [...voucher.items];
              let changed = false;
              
              for (const s of settlements) {
                const itemIdx = s.itemIdx;
                if (itemIdx >= updatedItems.length) continue;
                
                const item = { ...updatedItems[itemIdx] };
                const existingSettlements = [...(item.settlements || [])];
                
                // Find existing settlement for this invoice
                const existingIdx = existingSettlements.findIndex(
                  (es: any) => es.target_id === savedInvoiceId
                );
                
                // Build the settlement object for the voucher side
                const voucherSideSettlement = {
                  target_id: savedInvoiceId,
                  settled_amount: Number(s.settled_amount) || 0,
                  reference_number: invoiceNumber,
                  type: 'invoice',
                  type_label: 'فاتورة مبيعات',
                  date: date,
                  original_amount: items.reduce((sum, i) => sum + (Number(i.total) || 0), 0) - (Number(discount) || 0),
                  settlement_number: s.settlement_number || '',
                  settlement_date: s.settlement_date || date.slice(0, 10)
                };
                
                if (existingIdx > -1) {
                  existingSettlements[existingIdx] = voucherSideSettlement;
                } else {
                  existingSettlements.push(voucherSideSettlement);
                }
                
                item.settlements = existingSettlements;
                updatedItems[itemIdx] = item;
                changed = true;
              }
              
              if (changed) {
                await dbService.update(collection, voucherId, { ...voucher, items: updatedItems });
              }
            } catch (syncErr) {
              console.error(`[SYNC] Failed to update voucher ${voucherId}:`, syncErr);
            }
          }
        } catch (syncErr) {
          console.error('[SYNC] Settlement sync failed:', syncErr);
        }
      }
      
      // Handle removed settlements (when editing) - remove from vouchers
      if (editingInvoice && editingInvoice.settlements) {
        const oldSettlements = editingInvoice.settlements || [];
        const newTargetIds = new Set(formSettlements.map((s: any) => s.target_id));
        const removedSettlements = oldSettlements.filter((s: any) => !newTargetIds.has(s.target_id));
        
        for (const removed of removedSettlements) {
          try {
            const targetId = removed.target_id || '';
            const parts = targetId.split('-');
            if (parts.length < 2) continue;
            
            const itemIdx = parseInt(parts[parts.length - 1], 10);
            const originalVoucherId = parts.slice(0, -1).join('-');
            if (isNaN(itemIdx)) continue;
            
            const collection = removed.type === 'receipts' ? 'receipt_vouchers' : 
                              removed.type === 'payment_vouchers' ? 'payment_vouchers' : null;
            if (!collection) continue;
            
            const voucher = await dbService.get<any>(collection, originalVoucherId);
            if (!voucher || !voucher.items || itemIdx >= voucher.items.length) continue;
            
            const updatedItems = [...voucher.items];
            const item = { ...updatedItems[itemIdx] };
            const existingSettlements = [...(item.settlements || [])];
            
            const existingIdx = existingSettlements.findIndex(
              (es: any) => es.target_id === editingInvoice.id
            );
            
            if (existingIdx > -1) {
              existingSettlements.splice(existingIdx, 1);
              item.settlements = existingSettlements;
              updatedItems[itemIdx] = item;
              await dbService.update(collection, originalVoucherId, { ...voucher, items: updatedItems });
            }
          } catch (syncErr) {
            console.error('[SYNC] Failed to remove settlement from voucher:', syncErr);
          }
        }
      }

      if (!editingInvoice) {
        // Activity log in background
        await dbService.logActivity(user.id, user.username, user.company_id, t('invoices.log_add'), t('invoices.log_add_msg', { number: invoiceNumber }), 'invoices');
      } else {
        // Log details of changes for editing invoice
        if (changes.length > 0) {
          const logAction = language === 'ar' ? 'تعديل فاتورة' : 'Update Invoice';
          const logDetails = detailsList.join(' | ');
          await dbService.logActivity(
            user.id,
            user.username,
            user.company_id,
            logAction,
            logDetails || `تعديل الفاتورة رقم ${invoiceNumber}`,
            'invoices',
            editingInvoice.id,
            changes
          );
        }
      }

      closeModal();
      showNotification(editingInvoice ? t('invoices.invoice_updated') : t('invoices.invoice_saved'), 'success');

    } catch (e: any) {
      console.error('Save failed:', e);
      showNotification(e.message || 'حدث خطأ أثناء حفظ الفاتورة', 'error');
    } finally {
      setIsSubmitting(false);
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

  const handleExportExcel = (onlySelected: boolean = false) => {
    const listToExport = onlySelected
      ? filteredInvoices.filter(inv => selectedInvoiceIds.includes(inv.id))
      : filteredInvoices;

    const dataToExport = listToExport.map(inv => {
      const baseCode = (companyData?.settings?.currency || (companyData as any)?.currency || 'egp').toLowerCase();
      const currencyCode = inv.currency_id ? (companyCurrencies.find(c => c.id === inv.currency_id)?.code || '') : (companyData?.settings?.currency || 'EGP');
      const isForeign = currencyCode.toLowerCase() !== baseCode;

      // Calculate settlements and remaining
      const settlements = (allReceipts.length > 0 || allPayments.length > 0 || entries.length > 0) ? getInvoiceSettlements(inv) : (inv.settlements || []);
      const totalSettled = settlements.reduce((sum: number, s: any) => sum + (Number(s.settled_amount || s.amount) || 0), 0);
      const remaining = inv.payment_type === 'cash' ? 0 : Math.max(0, inv.total_amount - totalSettled);
      const remainingLocal = remaining * (Number(inv.exchange_rate) || 1);

      const statusLabels = {
        paid: 'مدفوعة',
        partial: 'مدفوعة جزئياً',
        unpaid: 'غير مدفوعة',
      };
      const paymentStatus = statusLabels[getPaymentStatus(inv)] || 'غير مدفوعة';

      return {
        ...inv,
        formatted_invoice_number: inv.invoice_number,
        formatted_customer_name: inv.customer_name,
        formatted_date: formatDate(inv.date),
        formatted_description: inv.description || '-',
        formatted_payment_type: inv.payment_type === 'cash' ? 'نقدي' : 'آجل',
        formatted_status: paymentStatus,
        formatted_currency: currencyCode,
        formatted_foreign_amount: isForeign ? inv.total_amount : '-',
        formatted_remaining_foreign: isForeign ? remaining : '-',
        formatted_subtotal: inv.subtotal * (Number(inv.exchange_rate) || 1),
        formatted_tax_amount: inv.tax_amount * (Number(inv.exchange_rate) || 1),
        formatted_base_amount: inv.total_amount * (Number(inv.exchange_rate) || 1),
        formatted_remaining: remainingLocal,
        formatted_entry_number: inv.entry_number || '-',
        formatted_created_date: formatTimestampDate(inv.created_at),
        formatted_created_time: formatTimestampTime(inv.created_at),
        formatted_updated_date: formatTimestampDate(inv.updated_at || inv.created_at),
        formatted_updated_time: formatTimestampTime(inv.updated_at || inv.created_at),
      };
    });

    const keyMap: Record<string, string> = {};
    if (visibleColumns.invoice_number) keyMap['formatted_invoice_number'] = 'رقم الفاتورة';
    if (visibleColumns.customer_name) keyMap['formatted_customer_name'] = 'العميل';
    if (visibleColumns.date) keyMap['formatted_date'] = 'التاريخ';
    if (visibleColumns.description) keyMap['formatted_description'] = 'وصف الفاتورة';
    if (visibleColumns.payment_type) keyMap['formatted_payment_type'] = 'طريقة الدفع';
    if (visibleColumns.status) keyMap['formatted_status'] = 'حالة الدفع';
    if (visibleColumns.currency && isMultiCurrencyEnabled) keyMap['formatted_currency'] = 'العملة';
    if (visibleColumns.foreign_amount && isMultiCurrencyEnabled) keyMap['formatted_foreign_amount'] = 'صافي القيمة بالعملة الأجنبية';
    if (visibleColumns.remaining_foreign && isMultiCurrencyEnabled) keyMap['formatted_remaining_foreign'] = 'الباقي بالعملة الأجنبية';
    if (visibleColumns.subtotal && isVatEnabled) keyMap['formatted_subtotal'] = 'قبل الضريبة';
    if (visibleColumns.tax_amount && isVatEnabled) keyMap['formatted_tax_amount'] = 'الضريبة';
    if (visibleColumns.base_amount) keyMap['formatted_base_amount'] = 'القيمة المعادلة بالعملة المحلية';
    if (visibleColumns.remaining) keyMap['formatted_remaining'] = 'الباقي من الفاتورة';
    if (visibleColumns.entry_number) keyMap['formatted_entry_number'] = 'رقم القيد';
    if (visibleColumns.created_date) keyMap['formatted_created_date'] = 'تاريخ الإنشاء';
    if (visibleColumns.created_time) keyMap['formatted_created_time'] = 'وقت الإنشاء';
    if (visibleColumns.updated_date) keyMap['formatted_updated_date'] = 'تاريخ آخر تعديل';
    if (visibleColumns.updated_time) keyMap['formatted_updated_time'] = 'وقت آخر تعديل';

    const formattedData = formatDataForExcel(dataToExport, keyMap);
    exportToExcel(formattedData, { filename: 'Invoices_Report', sheetName: 'الفواتير' });
  };

  const applyOperationToAllItems = () => {
    if (!selectedOperationId) return;
    setItems(prev => prev.map(item => ({ ...item, operation_id: selectedOperationId })));
    showNotification(language === 'ar' ? 'تم تطبيق العملية على كافة الأصناف' : 'Operation applied to all items', 'success');
  };

  const applyDepartmentToAllItems = () => {
    if (!selectedDepartmentId) return;
    setItems(prev => prev.map(item => ({ ...item, department_id: selectedDepartmentId })));
    showNotification(language === 'ar' ? 'تم تطبيق الإدارة على كافة الأصناف' : 'Department applied to all items', 'success');
  };

  const applyCostCenterToAllItems = () => {
    if (!selectedCostCenterId) return;
    setItems(prev => prev.map(item => ({ ...item, cost_center_id: selectedCostCenterId })));
    showNotification(language === 'ar' ? 'تم تطبيق مركز التكلفة على كافة الأصناف' : 'Cost center applied to all items', 'success');
  };

  const handleCopyInvoice = async () => {
    if (!editingInvoice) return;
    try {
      setEditingInvoice(null);
      
      const todayDate = new Date().toISOString().slice(0, 10);
      setDate(todayDate);
      
      const newNum = await generateInvoiceNumber(todayDate);
      setInvoiceNumber(newNum);
      
      const days = Number(paymentTermsDays) || 0;
      if (days > 0) {
        const d = new Date(todayDate);
        d.setDate(d.getDate() + days);
        setDueDate(d.toISOString().slice(0, 10));
      } else {
        setDueDate(todayDate);
      }
      
      setFormSettlementNumber('');
      setFormSettlementDate(todayDate);
      setFormSettlements([]);
      setRowSettlementDates({});
      setSelectedOrderIds([]);
      
      showNotification(
        language === 'ar' ? 'تم نسخ الفاتورة بالكامل كمسودة جديدة وتحديث رقمها وتاريخها' : 'Invoice copied completely as a new draft with updated number and date',
        'success'
      );
    } catch (error: any) {
      console.error('[COPY] Error copying invoice:', error);
      showNotification('فشل نسخ الفاتورة: ' + error.message, 'error');
    }
  };

  const handleExportPDF = async (onlySelected: boolean = false) => {
    if (onlySelected) {
      setIsExportingPDFSelected(true);
      setTimeout(async () => {
        if (tableRef.current) {
          await exportToPDFUtil(tableRef.current, { 
            filename: 'Invoices_Report_Selected', 
            orientation: 'landscape',
            reportTitle: 'قائمة الفواتير المحددة'
          });
        }
        setIsExportingPDFSelected(false);
      }, 100);
    } else {
      if (tableRef.current) {
        await exportToPDFUtil(tableRef.current, { 
          filename: 'Invoices_Report', 
          orientation: 'landscape',
          reportTitle: 'قائمة الفواتير'
        });
      }
    }
  };

  const openModal = async () => {
    isInitialLoad.current = true;
    setEditingInvoice(null);
    setSelectedCustomerId('');
    setSelectedWarehouseId('');
    setSelectedOperationId('');
    setSelectedDepartmentId('');
    setSelectedCostCenterId('');
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
    
    setSelectedCurrencyId('');
    setExchangeRate(1);
    setExchangeRateType('manual');
    
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
      setSelectedOperationId((fullData as any).operation_id || '');
      setSelectedDepartmentId((fullData as any).department_id || '');
      setSelectedCostCenterId((fullData as any).cost_center_id || '');
      
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
      
      setSelectedCurrencyId(fullData.currency_id || '');
      setExchangeRate(fullData.exchange_rate || 1);
      
      const cur = companyCurrencies.find(c => c.id === (fullData.currency_id || ''));
      if (cur) {
        const baseCurrency = companyData?.settings?.currency || 'EGP';
        if (cur.code.toLowerCase() === baseCurrency.toLowerCase()) {
          setExchangeRateType('manual');
        } else {
          setExchangeRateType(companyData?.settings?.exchange_rate_update_method || 'manual');
        }
      } else {
        setExchangeRateType('manual');
      }

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

  const formatTimestampDate = (tsStr: any) => {
    if (!tsStr) return '-';
    const d = new Date(tsStr);
    if (isNaN(d.getTime())) return '-';
    return formatDate(d);
  };

  const formatTimestampTime = (tsStr: any) => {
    if (!tsStr) return '-';
    const d = new Date(tsStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const selectedTotals = React.useMemo(() => {
    const selectedInvoices = filteredInvoices.filter(inv => selectedInvoiceIds.includes(inv.id));
    const total_amount = selectedInvoices.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);
    const total_discount = selectedInvoices.reduce((sum, inv) => sum + (Number(inv.discount_amount) || 0), 0);
    const net_amount = total_amount - total_discount;

    const remaining_amount = selectedInvoices.reduce((sum, inv) => {
      const settlements = (allReceipts.length > 0 || allPayments.length > 0 || entries.length > 0) ? getInvoiceSettlements(inv) : (inv.settlements || []);
      const totalSettled = settlements.reduce((sSum: number, s: any) => sSum + (Number(s.settled_amount || s.amount) || 0), 0);
      const remaining = inv.payment_type === 'cash' ? 0 : Math.max(0, inv.total_amount - totalSettled);
      const remainingLocal = remaining * (Number(inv.exchange_rate) || 1);
      return sum + remainingLocal;
    }, 0);

    return { total_amount, total_discount, net_amount, remaining_amount };
  }, [selectedInvoiceIds, filteredInvoices, allReceipts, allPayments, entries]);

  const totalRemainingFiltered = React.useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => {
      const settlements = (allReceipts.length > 0 || allPayments.length > 0 || entries.length > 0) ? getInvoiceSettlements(inv) : (inv.settlements || []);
      const totalSettled = settlements.reduce((sSum: number, s: any) => sSum + (Number(s.settled_amount || s.amount) || 0), 0);
      const remaining = inv.payment_type === 'cash' ? 0 : Math.max(0, inv.total_amount - totalSettled);
      const remainingLocal = remaining * (Number(inv.exchange_rate) || 1);
      return sum + remainingLocal;
    }, 0);
  }, [filteredInvoices, allReceipts, allPayments, entries]);

  const isAllSelected = filteredInvoices.length > 0 && filteredInvoices.every(inv => selectedInvoiceIds.includes(inv.id));

  const handleSelectAll = () => {
    if (isAllSelected) {
      const visibleIds = filteredInvoices.map(inv => inv.id);
      setSelectedInvoiceIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      const visibleIds = filteredInvoices.map(inv => inv.id);
      setSelectedInvoiceIds(prev => {
        const newSelection = [...prev];
        visibleIds.forEach(id => {
          if (!newSelection.includes(id)) {
            newSelection.push(id);
          }
        });
        return newSelection;
      });
    }
  };

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

  const selectedCurr = companyCurrencies.find(c => c.id === selectedCurrencyId);
  const currentInvoiceCurrencyCode = (selectedCurr?.code || companyData?.settings?.currency || (companyData as any)?.currency || 'EGP').toUpperCase();

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir={dir}>
      {!isModalOpen ? (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 italic serif">{t('invoices.title')}</h2>
              <p className="text-slate-500">{t('invoices.subtitle')}</p>
              {(serverSummary.total_amount !== undefined) && (
                <div className="mt-2 flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100 font-bold">إجمالي الفواتير: {formatMoney(serverSummary.total_amount)} {(companyData?.settings?.currency || (companyData as any)?.currency || 'EGP').toUpperCase()}</span>
                    <span className="bg-red-50 text-red-700 px-3 py-1 rounded-full border border-red-100 font-bold">إجمالي الخصومات: {formatMoney(serverSummary.total_discount || 0)} {(companyData?.settings?.currency || (companyData as any)?.currency || 'EGP').toUpperCase()}</span>
                    <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-100 font-bold">الصافي: {formatMoney((serverSummary.total_amount || 0) - (serverSummary.total_discount || 0))} {(companyData?.settings?.currency || (companyData as any)?.currency || 'EGP').toUpperCase()}</span>
                    <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full border border-amber-100 font-bold">إجمالي المتبقي: {formatMoney(totalRemainingFiltered)} {(companyData?.settings?.currency || (companyData as any)?.currency || 'EGP').toUpperCase()}</span>
                  </div>
                  {selectedInvoiceIds.length > 0 && (
                    <div className="flex items-center gap-4 text-sm animate-in slide-in-from-top-1 duration-200">
                      <span className="bg-zinc-100 text-zinc-700 px-3.5 py-1.5 rounded-full border border-zinc-200 font-bold flex flex-wrap items-center gap-1.5 shadow-sm">
                        <span>مجموع المحدد ({selectedInvoiceIds.length}):</span>
                        <span className="text-emerald-700">{formatMoney(selectedTotals.total_amount)}</span>
                        <span className="text-zinc-300 font-normal">/</span>
                        <span>الخصم:</span>
                        <span className="text-red-650">{formatMoney(selectedTotals.total_discount)}</span>
                        <span className="text-zinc-300 font-normal">/</span>
                        <span className="text-blue-700">الصافي: {formatMoney(selectedTotals.net_amount)}</span>
                        <span className="text-zinc-300 font-normal">/</span>
                        <span className="text-amber-700">المتبقي: {formatMoney(selectedTotals.remaining_amount)}</span>
                        <span className="text-zinc-500 font-mono text-[10px]">{(companyData?.settings?.currency || (companyData as any)?.currency || 'EGP').toUpperCase()}</span>
                      </span>
                    </div>
                  )}
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
                onExportExcel={() => handleExportExcel(false)} 
                onExportPDF={() => handleExportPDF(false)} 
                onExportExcelSelected={() => handleExportExcel(true)}
                onExportPDFSelected={() => handleExportPDF(true)}
                selectedCount={selectedInvoiceIds.length}
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

              {/* Column Selection Dropdown */}
              {view === 'table' && (
                <div className="relative" ref={columnSelectorRef}>
                  <button
                    onClick={() => setIsColumnSelectorOpen(!isColumnSelectorOpen)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                  >
                    <Eye size={14} className="text-slate-400" />
                    <span>{language === 'ar' ? 'أعمدة الجدول' : 'Table Columns'}</span>
                    <ChevronDown size={14} className="text-slate-400" />
                  </button>
                  
                  {isColumnSelectorOpen && (
                    <div className="absolute top-full mt-1.5 right-0 bg-white border border-slate-200 rounded-xl shadow-xl p-3 z-50 min-w-[220px] max-h-[300px] overflow-y-auto space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest pb-1 border-b border-slate-100">
                        {language === 'ar' ? 'تخصيص الأعمدة' : 'Customize Columns'}
                      </div>
                      {Object.keys(visibleColumns).filter(colKey => {
                        if (colKey === 'currency' || colKey === 'foreign_amount' || colKey === 'remaining_foreign') {
                          return isMultiCurrencyEnabled;
                        }
                        if (colKey === 'subtotal' || colKey === 'tax_amount') {
                          return isVatEnabled;
                        }
                        return true;
                      }).map((colKey) => {
                        const labels: Record<string, string> = {
                          invoice_number: language === 'ar' ? 'رقم الفاتورة' : 'Invoice Number',
                          customer_name: language === 'ar' ? 'العميل' : 'Customer',
                          date: language === 'ar' ? 'التاريخ' : 'Date',
                          description: language === 'ar' ? 'وصف الفاتورة' : 'Description',
                          payment_type: language === 'ar' ? 'طريقة الدفع' : 'Payment Type',
                          status: language === 'ar' ? 'حالة الدفع' : 'Payment Status',
                          currency: language === 'ar' ? 'العملة' : 'Currency',
                          foreign_amount: language === 'ar' ? 'المبلغ بالعملة الأجنبية' : 'Foreign Currency Amount',
                          remaining_foreign: language === 'ar' ? 'الباقي بالعملة الأجنبية' : 'Remaining in Foreign Currency',
                          subtotal: language === 'ar' ? 'قبل الضريبة' : 'Subtotal',
                          tax_amount: language === 'ar' ? 'الضريبة' : 'Tax',
                          base_amount: language === 'ar' ? 'القيمة المعادلة بالعملة المحلية' : 'Equivalent Local Amount',
                          remaining: language === 'ar' ? 'الباقي من الفاتورة' : 'Remaining Balance',
                          entry_number: language === 'ar' ? 'رقم القيد' : 'Entry Number',
                          created_date: language === 'ar' ? 'تاريخ الإنشاء' : 'Created Date',
                          created_time: language === 'ar' ? 'وقت الإنشاء' : 'Created Time',
                          updated_date: language === 'ar' ? 'تاريخ آخر تعديل' : 'Last Modified Date',
                          updated_time: language === 'ar' ? 'وقت آخر تعديل' : 'Last Modified Time',
                        };

                        return (
                          <label key={colKey} className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg transition-colors">
                            <input
                              type="checkbox"
                              checked={visibleColumns[colKey]}
                              onChange={() => {
                                const newVal = !visibleColumns[colKey];
                                const updated = {
                                  ...visibleColumns,
                                  [colKey]: newVal
                                };
                                setVisibleColumns(updated);
                                if (user?.id) {
                                  localStorage.setItem(`invoices_visible_columns_${user.id}`, JSON.stringify(updated));
                                }
                              }}
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                            />
                            <span>{labels[colKey] || colKey}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <PaginationControls 
              page={page} 
              limit={limit} 
              total={totalRecords} 
              onPageChange={setPage} 
              onLimitChange={setLimit} 
              className="border-b border-slate-100"
            />

            {view === 'table' ? (
              <div ref={tableRef} id="invoices-list-table" className="overflow-x-auto hidden md:block [transform:rotateX(180deg)]">
                <table className="w-full [transform:rotateX(180deg)]">
                  <thead>
                    <tr className="bg-slate-50/50 text-slate-500 text-[10px] uppercase tracking-widest font-bold border-b border-slate-100">
                      <th className="px-6 py-0.5 text-center w-12 no-pdf whitespace-nowrap">
                        <input 
                          type="checkbox"
                          checked={isAllSelected}
                          onChange={handleSelectAll}
                          className="rounded border-slate-350 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                        />
                      </th>
                      {visibleColumns.invoice_number && (
                        <th 
                          style={{ width: columnWidths.invoice_number, minWidth: columnWidths.invoice_number }} 
                          className={`px-6 py-0.5 whitespace-nowrap ${dir === 'rtl' ? 'text-right' : 'text-left'} cursor-pointer hover:text-emerald-600 transition-colors group relative`} 
                          onClick={() => handleSort('invoice_number')}
                        >
                          <div className="flex items-center gap-1">
                            {t('invoices.column_number')}
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                              {sortBy === 'invoice_number' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                            </span>
                          </div>
                          {renderResizeHandles('invoice_number')}
                        </th>
                      )}
                      {visibleColumns.customer_name && (
                        <th 
                          style={{ width: columnWidths.customer_name, minWidth: columnWidths.customer_name }} 
                          className={`px-6 py-0.5 whitespace-nowrap ${dir === 'rtl' ? 'text-right' : 'text-left'} cursor-pointer hover:text-emerald-600 transition-colors group relative`} 
                          onClick={() => handleSort('customer_name')}
                        >
                          <div className="flex items-center gap-1">
                            {t('invoices.column_customer')}
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                              {sortBy === 'customer_name' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                            </span>
                          </div>
                          {renderResizeHandles('customer_name')}
                        </th>
                      )}
                      {visibleColumns.date && (
                        <th 
                          style={{ width: columnWidths.date, minWidth: columnWidths.date }} 
                          className={`px-6 py-0.5 whitespace-nowrap ${dir === 'rtl' ? 'text-right' : 'text-left'} cursor-pointer hover:text-emerald-600 transition-colors group relative`} 
                          onClick={() => handleSort('date')}
                        >
                          <div className="flex items-center gap-1">
                            {t('invoices.column_date')}
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                              {sortBy === 'date' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                            </span>
                          </div>
                          {renderResizeHandles('date')}
                        </th>
                      )}
                      {visibleColumns.description && (
                        <th 
                          style={{ width: columnWidths.description, minWidth: columnWidths.description }} 
                          className={`px-6 py-0.5 whitespace-nowrap ${dir === 'rtl' ? 'text-right' : 'text-left'} cursor-pointer hover:text-emerald-600 transition-colors group relative`}
                          onClick={() => handleSort('description')}
                        >
                          <div className="flex items-center gap-1">
                            <span>وصف الفاتورة</span>
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                              {sortBy === 'description' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                            </span>
                          </div>
                          {renderResizeHandles('description')}
                        </th>
                      )}
                      {visibleColumns.payment_type && (
                        <th 
                          style={{ width: columnWidths.payment_type, minWidth: columnWidths.payment_type }} 
                          className={`px-6 py-0.5 whitespace-nowrap ${dir === 'rtl' ? 'text-right' : 'text-left'} cursor-pointer hover:text-emerald-600 transition-colors group relative`} 
                          onClick={() => handleSort('payment_type')}
                        >
                          <div className="flex items-center gap-1">
                            {t('invoices.form_payment_type')}
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                              {sortBy === 'payment_type' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                            </span>
                          </div>
                          {renderResizeHandles('payment_type')}
                        </th>
                      )}
                      {visibleColumns.status && (
                        <th 
                          style={{ width: columnWidths.status, minWidth: columnWidths.status }} 
                          className={`px-6 py-0.5 whitespace-nowrap ${dir === 'rtl' ? 'text-right' : 'text-left'} cursor-pointer hover:text-emerald-600 transition-colors group relative`}
                          onClick={() => handleSort('status')}
                        >
                          <div className="flex items-center gap-1">
                            <span>{language === 'ar' ? 'حالة الدفع' : 'Payment Status'}</span>
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                              {sortBy === 'status' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                            </span>
                          </div>
                          {renderResizeHandles('status')}
                        </th>
                      )}
                      {visibleColumns.currency && isMultiCurrencyEnabled && (
                        <th 
                          style={{ width: columnWidths.currency, minWidth: columnWidths.currency }} 
                          className={`px-6 py-0.5 whitespace-nowrap ${dir === 'rtl' ? 'text-right' : 'text-left'} cursor-pointer hover:text-emerald-600 transition-colors group relative`}
                          onClick={() => handleSort('currency')}
                        >
                          <div className="flex items-center gap-1">
                            <span>{language === 'ar' ? 'العملة' : 'Currency'}</span>
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                              {sortBy === 'currency' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                            </span>
                          </div>
                          {renderResizeHandles('currency')}
                        </th>
                      )}
                      {visibleColumns.foreign_amount && isMultiCurrencyEnabled && (
                        <th 
                          style={{ width: columnWidths.foreign_amount, minWidth: columnWidths.foreign_amount }} 
                          className={`px-6 py-0.5 whitespace-nowrap ${dir === 'rtl' ? 'text-right' : 'text-left'} cursor-pointer hover:text-emerald-600 transition-colors group relative`} 
                          onClick={() => handleSort('foreign_amount')}
                        >
                          <div className="flex items-center gap-1">
                            <span>{language === 'ar' ? 'المبلغ بالعملة الأجنبية' : 'Foreign Amount'}</span>
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                              {sortBy === 'foreign_amount' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                            </span>
                          </div>
                          {renderResizeHandles('foreign_amount')}
                        </th>
                      )}
                      {visibleColumns.remaining_foreign && isMultiCurrencyEnabled && (
                        <th 
                          style={{ width: columnWidths.remaining_foreign, minWidth: columnWidths.remaining_foreign }} 
                          className={`px-6 py-0.5 whitespace-nowrap ${dir === 'rtl' ? 'text-right' : 'text-left'} cursor-pointer hover:text-emerald-600 transition-colors group relative`} 
                          onClick={() => handleSort('remaining_foreign')}
                        >
                          <div className="flex items-center gap-1">
                            <span>{language === 'ar' ? 'الباقي بالعملة الأجنبية' : 'Remaining (FC)'}</span>
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                              {sortBy === 'remaining_foreign' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                            </span>
                          </div>
                          {renderResizeHandles('remaining_foreign')}
                        </th>
                      )}
                      {visibleColumns.subtotal && isVatEnabled && (
                        <th 
                          style={{ width: columnWidths.subtotal, minWidth: columnWidths.subtotal }} 
                          className={`px-6 py-0.5 whitespace-nowrap ${dir === 'rtl' ? 'text-right' : 'text-left'} cursor-pointer hover:text-emerald-600 transition-colors group relative`} 
                          onClick={() => handleSort('subtotal')}
                        >
                          <div className="flex items-center gap-1">
                            <span>{language === 'ar' ? 'قبل الضريبة' : 'Before Tax'}</span>
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                              {sortBy === 'subtotal' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                            </span>
                          </div>
                          {renderResizeHandles('subtotal')}
                        </th>
                      )}
                      {visibleColumns.tax_amount && isVatEnabled && (
                        <th 
                          style={{ width: columnWidths.tax_amount, minWidth: columnWidths.tax_amount }} 
                          className={`px-6 py-0.5 whitespace-nowrap ${dir === 'rtl' ? 'text-right' : 'text-left'} cursor-pointer hover:text-emerald-600 transition-colors group relative`} 
                          onClick={() => handleSort('tax_amount')}
                        >
                          <div className="flex items-center gap-1">
                            <span>{language === 'ar' ? 'الضريبة' : 'Tax'}</span>
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                              {sortBy === 'tax_amount' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                            </span>
                          </div>
                          {renderResizeHandles('tax_amount')}
                        </th>
                      )}
                      {visibleColumns.base_amount && (
                        <th 
                          style={{ width: columnWidths.base_amount, minWidth: columnWidths.base_amount }} 
                          className={`px-6 py-0.5 whitespace-nowrap ${dir === 'rtl' ? 'text-right' : 'text-left'} cursor-pointer hover:text-emerald-600 transition-colors group relative`}
                          onClick={() => handleSort('base_amount')}
                        >
                          <div className="flex items-center gap-1">
                            <span>{language === 'ar' ? 'القيمة المعادلة بالعملة المحلية' : 'Equivalent Local Amount'}</span>
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                              {sortBy === 'base_amount' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                            </span>
                          </div>
                          {renderResizeHandles('base_amount')}
                        </th>
                      )}
                      {visibleColumns.remaining && (
                        <th 
                          style={{ width: columnWidths.remaining, minWidth: columnWidths.remaining }} 
                          className={`px-6 py-0.5 whitespace-nowrap ${dir === 'rtl' ? 'text-right' : 'text-left'} cursor-pointer hover:text-emerald-600 transition-colors group relative`}
                          onClick={() => handleSort('remaining')}
                        >
                          <div className="flex items-center gap-1">
                            <span>{language === 'ar' ? 'الباقي من الفاتورة' : 'Remaining Balance'}</span>
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                              {sortBy === 'remaining' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                            </span>
                          </div>
                          {renderResizeHandles('remaining')}
                        </th>
                      )}
                      {visibleColumns.entry_number && (
                        <th 
                          style={{ width: columnWidths.entry_number, minWidth: columnWidths.entry_number }} 
                          className={`px-6 py-0.5 whitespace-nowrap ${dir === 'rtl' ? 'text-right' : 'text-left'} cursor-pointer hover:text-emerald-600 transition-colors group relative`}
                          onClick={() => handleSort('entry_number')}
                        >
                          <div className="flex items-center gap-1">
                            <span>{language === 'ar' ? 'رقم القيد' : 'Entry No.'}</span>
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                              {sortBy === 'entry_number' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                            </span>
                          </div>
                          {renderResizeHandles('entry_number')}
                        </th>
                      )}
                      {visibleColumns.created_date && (
                        <th 
                          style={{ width: columnWidths.created_date, minWidth: columnWidths.created_date }} 
                          className={`px-6 py-0.5 whitespace-nowrap ${dir === 'rtl' ? 'text-right' : 'text-left'} cursor-pointer hover:text-emerald-600 transition-colors group relative`}
                          onClick={() => handleSort('created_at')}
                        >
                          <div className="flex items-center gap-1">
                            <span>{language === 'ar' ? 'تاريخ الإنشاء' : 'Created Date'}</span>
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                              {sortBy === 'created_at' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                            </span>
                          </div>
                          {renderResizeHandles('created_date')}
                        </th>
                      )}
                      {visibleColumns.created_time && (
                        <th 
                          style={{ width: columnWidths.created_time, minWidth: columnWidths.created_time }} 
                          className={`px-6 py-0.5 whitespace-nowrap ${dir === 'rtl' ? 'text-right' : 'text-left'} cursor-pointer hover:text-emerald-600 transition-colors group relative`}
                          onClick={() => handleSort('created_at')}
                        >
                          <div className="flex items-center gap-1">
                            <span>{language === 'ar' ? 'وقت الإنشاء' : 'Created Time'}</span>
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                              {sortBy === 'created_at' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                            </span>
                          </div>
                          {renderResizeHandles('created_time')}
                        </th>
                      )}
                      {visibleColumns.updated_date && (
                        <th 
                          style={{ width: columnWidths.updated_date, minWidth: columnWidths.updated_date }} 
                          className={`px-6 py-0.5 whitespace-nowrap ${dir === 'rtl' ? 'text-right' : 'text-left'} cursor-pointer hover:text-emerald-600 transition-colors group relative`}
                          onClick={() => handleSort('updated_at')}
                        >
                          <div className="flex items-center gap-1">
                            <span>{language === 'ar' ? 'تاريخ آخر تعديل' : 'Last Modified Date'}</span>
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                              {sortBy === 'updated_at' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                            </span>
                          </div>
                          {renderResizeHandles('updated_date')}
                        </th>
                      )}
                      {visibleColumns.updated_time && (
                        <th 
                          style={{ width: columnWidths.updated_time, minWidth: columnWidths.updated_time }} 
                          className={`px-6 py-0.5 whitespace-nowrap ${dir === 'rtl' ? 'text-right' : 'text-left'} cursor-pointer hover:text-emerald-600 transition-colors group relative`}
                          onClick={() => handleSort('updated_at')}
                        >
                          <div className="flex items-center gap-1">
                            <span>{language === 'ar' ? 'وقت آخر تعديل' : 'Last Modified Time'}</span>
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                              {sortBy === 'updated_at' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                            </span>
                          </div>
                          {renderResizeHandles('updated_time')}
                        </th>
                      )}
                      <th className={`px-6 py-0.5 whitespace-nowrap ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>{t('invoices.column_actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      Array.from({ length: 5 }).map((_, rowIndex) => (
                        <tr key={rowIndex} className="animate-pulse">
                          <td className="px-6 py-0.5 text-center no-pdf whitespace-nowrap">
                            <div className="h-4 bg-slate-100 rounded w-4 mx-auto animate-pulse"></div>
                          </td>
                          {Object.keys(visibleColumns).filter(colKey => {
                            if (colKey === 'currency' || colKey === 'foreign_amount' || colKey === 'remaining_foreign') {
                              return isMultiCurrencyEnabled;
                            }
                            if (colKey === 'subtotal' || colKey === 'tax_amount') {
                              return isVatEnabled;
                            }
                            return true;
                          }).map((colKey) => {
                            if (!visibleColumns[colKey]) return null;
                            return (
                              <td key={colKey} className="px-6 py-0.5 whitespace-nowrap">
                                <div className="h-4 bg-slate-100 rounded w-2/3"></div>
                              </td>
                            );
                          })}
                          <td className="px-6 py-0.5 whitespace-nowrap">
                            <div className="h-4 bg-slate-100 rounded w-12 ml-auto"></div>
                          </td>
                        </tr>
                      ))
                    ) : filteredInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={Object.keys(visibleColumns).filter(k => {
                          if (!visibleColumns[k]) return false;
                          if (k === 'currency' || k === 'foreign_amount' || k === 'remaining_foreign') return isMultiCurrencyEnabled;
                          if (k === 'subtotal' || k === 'tax_amount') return isVatEnabled;
                          return true;
                        }).length + 2} className="px-6 py-12 text-center text-slate-500 italic font-medium whitespace-nowrap">{t('common.no_data')}</td>
                      </tr>
                    ) : (
                      (isExportingPDFSelected 
                        ? filteredInvoices.filter(inv => selectedInvoiceIds.includes(inv.id))
                        : filteredInvoices
                      ).map((inv) => (
                        <tr 
                          key={inv.id} 
                          className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                          onClick={() => canEdit ? openEditModal(inv) : handleViewInvoice(inv)}
                        >
                          <td 
                            className="px-6 py-0.5 text-center w-12 no-pdf whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input 
                              type="checkbox"
                              checked={selectedInvoiceIds.includes(inv.id)}
                              onChange={(e) => {
                                setSelectedInvoiceIds(prev => 
                                  prev.includes(inv.id) ? prev.filter(id => id !== inv.id) : [...prev, inv.id]
                                );
                              }}
                              className="rounded border-slate-350 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                            />
                          </td>
                          {visibleColumns.invoice_number && (
                            <td style={{ width: columnWidths.invoice_number, minWidth: columnWidths.invoice_number }} className={`px-6 py-0.5 whitespace-nowrap ${dir === 'rtl' ? 'text-right' : 'text-left'} truncate`}>
                              <span className="font-mono font-bold text-slate-950 text-xs select-all">
                                {inv.invoice_number}
                              </span>
                            </td>
                          )}
                          {visibleColumns.customer_name && (
                            <td style={{ width: columnWidths.customer_name, minWidth: columnWidths.customer_name }} className={`px-6 py-0.5 font-bold text-slate-900 whitespace-nowrap ${dir === 'rtl' ? 'text-right' : 'text-left'} truncate`}>
                              {inv.customer_name}
                            </td>
                          )}
                          {visibleColumns.date && (
                            <td style={{ width: columnWidths.date, minWidth: columnWidths.date }} className={`px-6 py-0.5 text-slate-500 whitespace-nowrap ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{formatDate(inv.date)}</td>
                          )}
                          {visibleColumns.description && (
                            <td style={{ width: columnWidths.description, minWidth: columnWidths.description }} className={`px-6 py-0.5 text-slate-500 max-w-[200px] truncate whitespace-nowrap ${dir === 'rtl' ? 'text-right' : 'text-left'}`} title={inv.description}>
                              {inv.description || '-'}
                            </td>
                          )}
                          {visibleColumns.payment_type && (
                            <td style={{ width: columnWidths.payment_type, minWidth: columnWidths.payment_type }} className={`px-6 py-0.5 whitespace-nowrap ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                              {inv.payment_type === 'cash' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100/50 whitespace-nowrap">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  نقدية
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100/50 whitespace-nowrap">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                  آجل
                                </span>
                              )}
                            </td>
                          )}
                          {visibleColumns.status && (
                            <td style={{ width: columnWidths.status, minWidth: columnWidths.status }} className={`px-6 py-0.5 whitespace-nowrap ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                              {(() => {
                                const status = getPaymentStatus(inv);
                                const statusLabels = {
                                  paid: 'مدفوعة',
                                  partial: 'مدفوعة جزئياً',
                                  unpaid: 'غير مدفوعة',
                                };
                                const statusClasses = {
                                  paid: 'bg-emerald-50 text-emerald-700 border-emerald-100/50',
                                  partial: 'bg-amber-50 text-amber-700 border-amber-100/50',
                                  unpaid: 'bg-red-50 text-red-700 border-red-100/50',
                                };
                                return (
                                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold border whitespace-nowrap ${statusClasses[status]}`}>
                                    {statusLabels[status]}
                                  </span>
                                );
                              })()}
                            </td>
                          )}
                          {visibleColumns.currency && isMultiCurrencyEnabled && (
                            <td style={{ width: columnWidths.currency, minWidth: columnWidths.currency }} className={`px-6 py-0.5 font-bold text-slate-500 whitespace-nowrap ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                              {inv.currency_id ? (companyCurrencies.find(c => c.id === inv.currency_id)?.code || '') : (companyData?.settings?.currency || 'EGP')}
                            </td>
                          )}
                          {visibleColumns.foreign_amount && isMultiCurrencyEnabled && (
                            <td style={{ width: columnWidths.foreign_amount, minWidth: columnWidths.foreign_amount }} className={`px-6 py-0.5 font-bold text-slate-700 whitespace-nowrap ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                              {(() => {
                                const baseCode = (companyData?.settings?.currency || (companyData as any)?.currency || 'egp').toLowerCase();
                                const currencyCode = inv.currency_id ? (companyCurrencies.find(c => c.id === inv.currency_id)?.code || '') : (companyData?.settings?.currency || 'EGP');
                                const isForeign = currencyCode.toLowerCase() !== baseCode;
                                return isForeign ? formatMoney(inv.total_amount) : '-';
                              })()}
                            </td>
                          )}
                          {visibleColumns.remaining_foreign && isMultiCurrencyEnabled && (
                            <td style={{ width: columnWidths.remaining_foreign, minWidth: columnWidths.remaining_foreign }} className={`px-6 py-0.5 font-bold text-slate-700 whitespace-nowrap ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                              {(() => {
                                const baseCode = (companyData?.settings?.currency || (companyData as any)?.currency || 'egp').toLowerCase();
                                const currencyCode = inv.currency_id ? (companyCurrencies.find(c => c.id === inv.currency_id)?.code || '') : (companyData?.settings?.currency || 'EGP');
                                const isForeign = currencyCode.toLowerCase() !== baseCode;
                                if (!isForeign) return '-';

                                const settlements = (allReceipts.length > 0 || allPayments.length > 0 || entries.length > 0) ? getInvoiceSettlements(inv) : (inv.settlements || []);
                                const totalSettled = settlements.reduce((sum: number, s: any) => sum + (Number(s.settled_amount || s.amount) || 0), 0);
                                const remaining = inv.payment_type === 'cash' ? 0 : Math.max(0, inv.total_amount - totalSettled);
                                
                                if (remaining <= 0) return <span className="text-emerald-600">0.00</span>;
                                return <span className="text-red-600">{formatMoney(remaining)}</span>;
                              })()}
                            </td>
                          )}
                          {visibleColumns.subtotal && isVatEnabled && (
                            <td style={{ width: columnWidths.subtotal, minWidth: columnWidths.subtotal }} className={`px-6 py-0.5 font-bold text-slate-900 whitespace-nowrap ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                              {formatMoney(inv.subtotal * (Number(inv.exchange_rate) || 1))}
                            </td>
                          )}
                          {visibleColumns.tax_amount && isVatEnabled && (
                            <td style={{ width: columnWidths.tax_amount, minWidth: columnWidths.tax_amount }} className={`px-6 py-0.5 font-bold text-slate-900 whitespace-nowrap ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                              {formatMoney(inv.tax_amount * (Number(inv.exchange_rate) || 1))}
                            </td>
                          )}
                          {visibleColumns.base_amount && (
                            <td style={{ width: columnWidths.base_amount, minWidth: columnWidths.base_amount }} className={`px-6 py-0.5 font-bold text-slate-900 whitespace-nowrap ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                              {formatMoney(inv.total_amount * (Number(inv.exchange_rate) || 1))}
                            </td>
                          )}
                          {visibleColumns.remaining && (
                            <td style={{ width: columnWidths.remaining, minWidth: columnWidths.remaining }} className={`px-6 py-0.5 font-bold whitespace-nowrap ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                              {(() => {
                                const settlements = (allReceipts.length > 0 || allPayments.length > 0 || entries.length > 0) ? getInvoiceSettlements(inv) : (inv.settlements || []);
                                const totalSettled = settlements.reduce((sum: number, s: any) => sum + (Number(s.settled_amount || s.amount) || 0), 0);
                                const remaining = inv.payment_type === 'cash' ? 0 : Math.max(0, inv.total_amount - totalSettled);
                                const remainingLocal = remaining * (Number(inv.exchange_rate) || 1);
                                
                                if (remainingLocal <= 0) return <span className="text-emerald-600">0.00</span>;
                                return <span className="text-red-600">{formatMoney(remainingLocal)}</span>;
                              })()}
                            </td>
                          )}
                          {visibleColumns.entry_number && (
                            <td style={{ width: columnWidths.entry_number, minWidth: columnWidths.entry_number }} className={`px-6 py-0.5 whitespace-nowrap ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                              {inv.entry_number ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPendingViewDoc({ type: 'journal', idOrNumber: inv.entry_number! });
                                    setCurrentPage('journal_entries');
                                  }}
                                  className="text-emerald-600 hover:text-emerald-700 hover:underline font-mono text-xs font-bold bg-emerald-50 px-2 py-1 rounded border border-emerald-100/50 transition-all active:scale-95 whitespace-nowrap"
                                >
                                  {inv.entry_number}
                                </button>
                              ) : (
                                <span className="text-slate-400 font-mono text-xs">-</span>
                              )}
                            </td>
                          )}
                          {visibleColumns.created_date && (
                            <td style={{ width: columnWidths.created_date, minWidth: columnWidths.created_date }} className={`px-6 py-0.5 text-slate-500 whitespace-nowrap ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                              {formatTimestampDate(inv.created_at)}
                            </td>
                          )}
                          {visibleColumns.created_time && (
                            <td style={{ width: columnWidths.created_time, minWidth: columnWidths.created_time }} className={`px-6 py-0.5 text-slate-500 whitespace-nowrap ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                              {formatTimestampTime(inv.created_at)}
                            </td>
                          )}
                          {visibleColumns.updated_date && (
                            <td style={{ width: columnWidths.updated_date, minWidth: columnWidths.updated_date }} className={`px-6 py-0.5 text-slate-500 whitespace-nowrap ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                              {formatTimestampDate(inv.updated_at || inv.created_at)}
                            </td>
                          )}
                          {visibleColumns.updated_time && (
                            <td style={{ width: columnWidths.updated_time, minWidth: columnWidths.updated_time }} className={`px-6 py-0.5 text-slate-500 whitespace-nowrap ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                              {formatTimestampTime(inv.updated_at || inv.created_at)}
                            </td>
                          )}
                          <td className={`px-6 py-0.5 whitespace-nowrap ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="p-6 bg-slate-50/50 rounded-3xl border border-slate-100 animate-pulse space-y-4">
                      <div className="flex justify-between items-center">
                        <div className="h-5 bg-slate-100 rounded w-1/3"></div>
                        <div className="h-5 bg-slate-100 rounded w-1/4"></div>
                      </div>
                      <div className="h-4 bg-slate-100 rounded w-2/3"></div>
                      <div className="flex justify-between items-center pt-2">
                        <div className="h-4 bg-slate-100 rounded w-1/4"></div>
                        <div className="h-4 bg-slate-100 rounded w-1/4"></div>
                      </div>
                    </div>
                  ))
                ) : filteredInvoices.length === 0 ? (
                  <div className="col-span-full p-12 text-center text-slate-500 font-bold italic">{t('common.no_data')}</div>
                ) : (
                  filteredInvoices.map((inv) => (
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
                            <p className="text-slate-400 text-[10px] uppercase font-black tracking-widest">صافي القيمة</p>
                            <p className="font-black text-2xl tracking-tighter text-emerald-600">
                              {formatMoney(inv.total_amount)} <span className="text-sm font-bold">{inv.currency_id ? (companyCurrencies.find(c => c.id === inv.currency_id)?.code || '') : (companyData?.settings?.currency || '')}</span>
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
                  ))
                )}
              </div>
            )}

            {/* Mobile List View */}
            <div className="md:hidden divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="p-4 space-y-3 animate-pulse">
                    <div className="flex justify-between items-center">
                      <div className="h-4 bg-slate-100 rounded w-1/4"></div>
                      <div className="h-4 bg-slate-100 rounded w-1/4"></div>
                    </div>
                    <div className="h-5 bg-slate-100 rounded w-1/2"></div>
                    <div className="h-4 bg-slate-100 rounded w-1/3"></div>
                  </div>
                ))
              ) : filteredInvoices.length === 0 ? (
                <div className="p-12 text-center text-slate-500 font-bold italic">{t('common.no_data')}</div>
              ) : (
                filteredInvoices.map((inv) => (
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
                        <p className="font-bold text-emerald-600 text-lg">{formatMoney(inv.total_amount)} {inv.currency_id ? (companyCurrencies.find(c => c.id === inv.currency_id)?.code || '') : (companyData?.settings?.currency || '')}</p>
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
                ))
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden animate-in slide-in-from-bottom-4 duration-300 flex flex-col min-h-[80vh] relative">
          {/* Form Header */}
          <div className="p-2 md:p-2.5 md:px-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-[70] flex-wrap gap-2" dir={dir}>
            {/* Right side (start in RTL): Actions: Save, Cancel, Return to List */}
            <div className="flex flex-col items-start gap-1 shrink-0">
              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={closeModal} 
                  className="flex items-center gap-1 px-2.5 py-0.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all font-bold text-[11px] whitespace-nowrap"
                >
                  {dir === 'rtl' ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                  <span>{language === 'ar' ? 'العودة للقائمة' : 'Return to List'}</span>
                </button>
                {editingInvoice && (
                  <button 
                    type="button"
                    onClick={handleCopyInvoice} 
                    className="flex items-center gap-1 px-2 py-0.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-xl transition-all font-bold text-[11px] whitespace-nowrap border border-emerald-200 shadow-sm"
                  >
                    <Copy size={11} />
                    <span>{language === 'ar' ? 'نسخ' : 'Copy'}</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button 
                  type="button"
                  onClick={closeModal}
                  className="w-20 py-1 rounded-lg bg-zinc-100 text-zinc-700 font-bold hover:bg-zinc-200 transition-all flex items-center gap-1 justify-center active:scale-95 border border-zinc-200 shadow-sm text-[11px] whitespace-nowrap font-sans"
                >
                  <RotateCcw size={12} />
                  <span>{language === 'ar' ? 'إلغاء' : 'Cancel'}</span>
                </button>
                <button 
                  type="submit"
                  form="invoice-form"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-20 py-1 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1 justify-center active:scale-95 shadow-sm text-[11px] whitespace-nowrap font-sans"
                >
                  {isSubmitting ? (
                    <div className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save size={12} />
                  )}
                  <span>{language === 'ar' ? 'حفظ' : 'Save'}</span>
                </button>
              </div>
            </div>

            {/* Left side (end in RTL): Document Info: Title, Invoice No, Linked Journal, and Status Badge */}
            <div className="flex items-center gap-4 flex-wrap">
              {/* Text Info Column */}
              <div className="flex flex-col gap-1 items-start">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="text-sm md:text-base font-black text-slate-900 tracking-tight leading-none font-sans">
                    {editingInvoice ? (language === 'ar' ? 'تعديل فاتورة المبيعات' : 'Edit Sales Invoice') : (language === 'ar' ? 'إنشاء فاتورة مبيعات جديدة' : 'Create New Sales Invoice')}
                  </h3>
                  <span className="text-[11px] font-mono font-black text-slate-800 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-lg select-all shadow-sm">
                    {invoiceNumber}
                  </span>
                </div>

                {editingInvoice?.entry_number ? (
                  <div className="flex items-center gap-1 text-emerald-700 text-[10px] font-bold font-mono leading-none mt-0.5">
                    <span className="text-emerald-500 font-sans font-bold">{language === 'ar' ? 'القيد المرتبط:' : 'Linked JE:'}</span>
                    <span className="bg-emerald-50 px-1 py-0.5 rounded border border-emerald-100 font-black">{editingInvoice.entry_number}</span>
                  </div>
                ) : (
                  <div className="text-[9px] font-bold text-zinc-400 mt-0.5">
                    {language === 'ar' ? 'القيد المرتبط: لا يوجد قيد مرتبط بعد' : 'Linked JE: No journal entry linked yet'}
                  </div>
                )}
              </div>

              {/* Payment Status Badge */}
              <div className="flex items-center">
                {(() => {
                  const isCash = paymentType === 'cash';
                  if (isCash) {
                    return (
                      <div className="px-2.5 py-1 border-2 border-emerald-600 text-emerald-600 bg-emerald-50/50 font-black text-[11px] uppercase rounded-xl select-none tracking-wider shadow-sm flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                        {language === 'ar' ? 'فاتورة نقدية' : 'Cash Invoice'}
                      </div>
                    );
                  }
                  
                  if (editingInvoice) {
                    const status = getPaymentStatus(editingInvoice);
                    const statusLabels = {
                      paid: language === 'ar' ? 'مدفوعة' : 'Paid',
                      partial: language === 'ar' ? 'مدفوعة جزئياً' : 'Partially Paid',
                      unpaid: language === 'ar' ? 'غير مدفوعة' : 'Unpaid'
                    };
                    const statusColors = {
                      paid: 'border-emerald-600 text-emerald-600 bg-emerald-50/50',
                      partial: 'border-blue-600 text-blue-600 bg-blue-50/50',
                      unpaid: 'border-rose-600 text-rose-600 bg-rose-50/50 font-black'
                    };
                    const colorClass = statusColors[status] || statusColors.unpaid;
                    return (
                      <div className={`px-2.5 py-1 border-2 ${colorClass} font-black text-[11px] uppercase rounded-xl select-none tracking-wider shadow-sm flex items-center gap-1`}>
                        <span className={`w-2 h-2 rounded-full ${status === 'paid' ? 'bg-emerald-600 animate-pulse' : status === 'partial' ? 'bg-blue-600' : 'bg-rose-600 animate-ping'}`}></span>
                        {statusLabels[status]}
                      </div>
                    );
                  } else {
                    return (
                      <div className="px-2.5 py-1 border-2 border-blue-600 text-blue-600 bg-blue-50/50 font-black text-[11px] uppercase rounded-xl select-none tracking-wider shadow-sm flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                        {language === 'ar' ? 'فاتورة آجلة' : 'Credit Invoice'}
                      </div>
                    );
                  }
                })()}
              </div>
            </div>
          </div>
            
            <div className="flex-1 flex flex-col h-full relative overflow-hidden">


              {/* AI Drawer (Smart Creation) sliding from the right */}
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
                        onDataExtracted={applyAiData}
                        transactionType="sales_invoice"
                      />
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

              <div className="flex-1 p-1.5 md:p-2.5 space-y-1.5 overflow-y-auto pb-3">
                <div className="space-y-1.5">

                  <form id="invoice-form" onSubmit={handleSubmit} className="space-y-1.5">
                    {/* Upper Layout: Combined Totals Summary and Metadata Form into a single card */}
                    <section className="bg-white p-2 md:p-2.5 rounded-xl border border-zinc-200 shadow-sm grid grid-cols-1 lg:grid-cols-4 gap-2 lg:gap-2.5 items-stretch">
                      
                      {/* Left: Invoice Summary Card Column */}
                      <div className="flex flex-col justify-center space-y-1 p-0.5">
                        <div className="flex items-center gap-1 mb-0.5 text-emerald-600">
                          <Layers className="w-3.5 h-3.5" />
                          <h2 className="font-semibold text-zinc-900 text-[10px]">{language === 'ar' ? 'ملخص الفاتورة' : 'Invoice Summary'}</h2>
                        </div>

                        <div className="bg-zinc-50 rounded-lg p-1.5 border border-zinc-100 space-y-0.5">
                          <div className="flex justify-between items-center text-zinc-650 text-[10px]">
                            <span className="font-medium">{t('invoices.summary_subtotal')}</span>
                            <span className="font-bold text-[11px]">
                              {formatMoney(items.reduce((sum, i) => sum + (Number(i.total) || 0), 0))}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-emerald-600 text-[10px]">
                            <div className="flex items-center gap-1">
                              <span className="font-medium">{t('invoices.summary_discount')}</span>
                              <input 
                                type="number" 
                                disabled={!hasBusinessPermission("edit_discount")}
                                className="w-11 bg-white border border-zinc-200 rounded px-1 py-0.5 text-center font-bold text-emerald-600 focus:ring-1 focus:ring-emerald-500 outline-none text-[10px] disabled:opacity-50 disabled:cursor-not-allowed"
                                value={Number(discount)}
                                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                              />
                            </div>
                            <span className="font-bold text-[11px]">-{formatMoney(discount)}</span>
                          </div>
                          {isVatEnabled && (
                            <div className="flex justify-between items-center text-zinc-650 text-[10px] pt-0.5 border-t border-dashed border-zinc-200">
                              <span className="font-medium">{language === 'ar' ? 'ضريبة القيمة المضافة' : 'VAT'}</span>
                              <span className="font-bold text-[11px]">
                                +{formatMoney(items.reduce((sum, i) => sum + (Number(i.vat_amount) || 0), 0))}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between items-center text-emerald-600 text-[10px] pt-0.5 border-t border-zinc-200">
                            <span className="font-black text-[11px]">{t('invoices.summary_total')}</span>
                            <div className="flex flex-col items-end">
                              <span className="font-black text-xs tracking-tighter text-left">
                                {formatMoney(
                                  items.reduce((sum, i) => sum + (Number(i.total) || 0), 0) + 
                                  (isVatEnabled ? items.reduce((sum, i) => sum + (Number(i.vat_amount) || 0), 0) : 0) - 
                                  discount
                                )} {currentInvoiceCurrencyCode}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right: Unified Metadata & Payment Settings Panel Column */}
                      <div className="lg:col-span-3 space-y-1 relative lg:border-s lg:border-zinc-150 lg:ps-2.5 flex flex-col justify-between">
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-1.5">
                          {/* 1. Date */}
                          <div>
                            <label className="block text-[9px] font-bold text-zinc-400 mb-0 px-0.5">{t('invoices.column_date')}</label>
                            <input
                              required
                              type="date"
                              disabled={!hasBusinessPermission("edit_invoice_date")}
                              className="w-full px-1.5 py-0.5 rounded-md bg-zinc-50 border border-zinc-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 text-[11px] disabled:opacity-75 disabled:cursor-not-allowed"
                              value={date}
                              onChange={(e) => setDate(e.target.value)}
                            />
                          </div>

                          {/* 2. Customer */}
                          <div className="col-span-1 md:col-span-2 lg:col-span-2">
                            <label className="block text-[9px] font-bold text-zinc-400 mb-0 px-0.5">{t('invoices.form_customer')}</label>
                            <select 
                              required
                              disabled={items.length > 0 && !hasBusinessPermission("change_customer_after_items")}
                              className="w-full px-1.5 py-0.5 rounded-md bg-zinc-50 border border-zinc-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 text-[11px] cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
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
                          </div>

                          {/* 3. Warehouse */}
                          {invoiceType === 'items' && (
                            <div>
                              <label className="block text-[9px] font-bold text-zinc-400 mb-0 px-0.5">{language === 'ar' ? 'المخزن' : 'Warehouse'}</label>
                              <select 
                                required
                                disabled={!hasBusinessPermission("change_warehouse")}
                                className="w-full px-1.5 py-0.5 rounded-md bg-zinc-50 border border-zinc-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 text-[11px] cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
                                value={selectedWarehouseId}
                                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                              >
                                <option value="">{language === 'ar' ? 'اختر المخزن' : 'Select Warehouse'}</option>
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                              </select>
                            </div>
                          )}

                          {/* 4. Payment Type */}
                          <div>
                            <label className="block text-[9px] font-bold text-zinc-400 mb-0 px-0.5">{language === 'ar' ? 'طريقة الدفع' : 'Payment Type'}</label>
                            <select 
                              className="w-full px-1.5 py-0.5 rounded-md bg-zinc-50 border border-zinc-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 text-[11px] cursor-pointer"
                              value={paymentType}
                              onChange={(e) => setPaymentType(e.target.value as 'cash' | 'credit')}
                            >
                              <option value="credit">{language === 'ar' ? 'آجل' : 'Credit'}</option>
                              <option value="cash">{language === 'ar' ? 'نقدي' : 'Cash'}</option>
                            </select>
                          </div>
                        </div>

                        {/* Second Row of metadata */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5 mt-1 pt-1 border-t border-zinc-100">
                          {/* 5. Payment Terms or Method */}
                          {paymentType === 'cash' ? (
                            <div>
                              <label className="block text-[9px] font-bold text-zinc-400 mb-0 px-0.5">{t('invoices.form_payment_method')}</label>
                              <select 
                                required
                                className="w-full px-1.5 py-0.5 rounded-md border border-zinc-200 bg-zinc-50 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 text-[11px] cursor-pointer"
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
                            </div>
                          ) : (
                            <>
                              <div>
                                <label className="block text-[9px] font-bold text-zinc-400 mb-0 px-0.5">{language === 'ar' ? 'شروط السداد' : 'Payment Terms'}</label>
                                <select 
                                  className="w-full px-1.5 py-0.5 rounded-md border border-zinc-200 bg-zinc-50 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 text-[11px] cursor-pointer"
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
                              </div>

                              {paymentTerms === 'custom' && (
                                <>
                                  <div>
                                    <label className="block text-[9px] font-bold text-zinc-400 mb-0 px-0.5">{language === 'ar' ? 'أيام السداد' : 'Payment Days'}</label>
                                    <input
                                      type="number"
                                      min={0}
                                      className="w-full px-1.5 py-0.5 rounded-md border border-zinc-200 bg-zinc-50 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 text-[11px]"
                                      value={paymentTermsDays}
                                      onChange={(e) => setPaymentTermsDays(Number(e.target.value) || 0)}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] font-bold text-zinc-400 mb-0 px-0.5">{language === 'ar' ? 'دفعة مقدمة %' : 'Advance %'}</label>
                                    <input
                                      type="number"
                                      min={0}
                                      max={100}
                                      className="w-full px-1.5 py-0.5 rounded-md border border-zinc-200 bg-zinc-50 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 text-[11px]"
                                      value={advancePercentage}
                                      onChange={(e) => setAdvancePercentage(Number(e.target.value) || 0)}
                                    />
                                  </div>
                                </>
                              )}

                              <div>
                                <label className="block text-[9px] font-bold text-zinc-400 mb-0 px-0.5">{language === 'ar' ? 'تاريخ الاستحقاق' : 'Due Date'}</label>
                                <input
                                  type="date"
                                  className="w-full px-1.5 py-0.5 rounded-md border border-zinc-200 bg-zinc-50 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 text-[11px]"
                                  value={dueDate}
                                  onChange={(e) => setDueDate(e.target.value)}
                                />
                              </div>
                            </>
                          )}

                          {/* Currency & Exchange Rate Selection */}
                          {companyData?.settings?.enable_multi_currency && (
                            <>
                              <div>
                                <label className="block text-[9px] font-bold text-zinc-400 mb-0 px-0.5 flex items-center gap-1">
                                  <Coins size={10} className="text-amber-500" />
                                  {language === 'ar' ? 'عملة الفاتورة' : 'Invoice Currency'}
                                </label>
                                <select 
                                  className="w-full px-1.5 py-0.5 rounded-md border border-zinc-200 bg-zinc-50 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 text-[11px] cursor-pointer"
                                  value={selectedCurrencyId}
                                  onChange={(e) => handleCurrencyChange(e.target.value)}
                                >
                                  {(() => {
                                    const baseCode = (companyData?.settings?.currency || (companyData as any)?.currency || 'egp').toLowerCase();
                                    const baseCurrInList = companyCurrencies.find(c => c.code.toLowerCase() === baseCode);
                                    const baseCurrencyName = baseCurrInList 
                                      ? (language === 'ar' ? baseCurrInList.name_ar : baseCurrInList.name_en) 
                                      : (language === 'ar' ? 'العملة الأساسية' : 'Base Currency');
                                    return (
                                      <option value="">
                                        {`${baseCurrencyName} (${(companyData?.settings?.currency || (companyData as any)?.currency || 'EGP').toUpperCase()})`}
                                      </option>
                                    );
                                  })()}
                                  {companyCurrencies.filter(c => (c.is_active || c.id === selectedCurrencyId) && c.code.toLowerCase() !== (companyData?.settings?.currency || (companyData as any)?.currency || 'egp').toLowerCase()).map(curr => (
                                    <option key={curr.id} value={curr.id}>
                                      {language === 'ar' ? `${curr.name_ar} (${curr.code})` : `${curr.name_en} (${curr.code})`}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {(() => {
                                const selectedCurr = companyCurrencies.find(c => c.id === selectedCurrencyId);
                                const baseCurrency = companyData?.settings?.currency || 'EGP';
                                const isForeign = selectedCurr && selectedCurr.code.toLowerCase() !== baseCurrency.toLowerCase();
                                
                                if (!isForeign) return null;

                                return (
                                  <div>
                                    <label className="block text-[9px] font-bold text-zinc-400 mb-0 px-0.5">
                                      {language === 'ar' 
                                        ? `سعر الصرف (${exchangeRateType === 'auto' ? 'تلقائي' : 'يدوي'})` 
                                        : `Exchange Rate (${exchangeRateType === 'auto' ? 'Auto' : 'Manual'})`}
                                    </label>
                                    <input
                                      type="number"
                                      step="any"
                                      min="0.000001"
                                      className="w-full px-1.5 py-0.5 rounded-md border border-zinc-200 bg-zinc-50 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 text-[11px]"
                                      value={exchangeRate}
                                      onChange={(e) => {
                                        setExchangeRate(Number(e.target.value) || 1);
                                        setExchangeRateType('manual');
                                      }}
                                    />
                                  </div>
                                );
                              })()}
                            </>
                          )}
                        </div>

                        {/* Third Row of metadata: Operation, Department, Cost Center */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5 mt-1 pt-1 border-t border-zinc-100">
                          {/* Operation input */}
                          <div>
                            <label className="block text-[9px] font-bold text-zinc-400 mb-0 px-0.5">{language === 'ar' ? 'العملية' : 'Operation'}</label>
                            <div className="flex items-center gap-1">
                              <div className="relative flex-1">
                                <input 
                                  type="text" 
                                  placeholder={language === 'ar' ? 'ابحث عن عملية...' : 'Search operation...'}
                                  className="w-full px-1.5 py-0.5 rounded-md bg-zinc-50 border border-zinc-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 text-[11px]"
                                  value={
                                    activeSearch && activeSearch.index === -1 && activeSearch.type === 'operation'
                                      ? activeSearch.query
                                      : (operations.find(op => op.id === selectedOperationId)?.operation_number || '')
                                  }
                                  onChange={(e) => {
                                    setActiveSearch(prev => prev ? { ...prev, query: e.target.value } : null);
                                  }}
                                  onFocus={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const dropdownWidth = 420;
                                    let left = rect.left;
                                    if (dir === 'rtl') {
                                      left = rect.left + rect.width - dropdownWidth;
                                    }
                                    left = Math.max(10, Math.min(window.innerWidth - dropdownWidth - 10, left));
                                    setActiveSearch({
                                      index: -1,
                                      type: 'operation',
                                      query: operations.find(op => op.id === selectedOperationId)?.operation_number || ''
                                    });
                                    setPopoverRect({
                                      top: rect.bottom,
                                      left: left,
                                      width: dropdownWidth
                                    });
                                  }}
                                />
                                {selectedOperationId && (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedOperationId('')}
                                    className={`absolute ${dir === 'rtl' ? 'left-1.5' : 'right-1.5'} inset-y-0 flex items-center px-1 text-zinc-400 hover:text-red-500`}
                                    title={language === 'ar' ? 'مسح' : 'Clear'}
                                  >
                                    <X size={10} />
                                  </button>
                                )}
                              </div>
                              {selectedOperationId && (
                                <button
                                  type="button"
                                  onClick={() => applyOperationToAllItems()}
                                  className="p-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded text-emerald-600 hover:text-emerald-700 transition-colors flex-shrink-0"
                                  title={language === 'ar' ? 'تطبيق المختار على كافة الأصناف' : 'Apply to all items'}
                                >
                                  <CheckCheck size={12} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Department input */}
                          <div>
                            <label className="block text-[9px] font-bold text-zinc-400 mb-0 px-0.5">{language === 'ar' ? 'الإدارة' : 'Department'}</label>
                            <div className="flex items-center gap-1">
                              <div className="relative flex-1">
                                <input 
                                  type="text" 
                                  placeholder={language === 'ar' ? 'ابحث عن إدارة...' : 'Search department...'}
                                  className="w-full px-1.5 py-0.5 rounded-md bg-zinc-50 border border-zinc-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 text-[11px]"
                                  value={
                                    activeSearch && activeSearch.index === -1 && activeSearch.type === 'department'
                                      ? activeSearch.query
                                      : (departments.find(d => d.id === selectedDepartmentId)?.name || '')
                                  }
                                  onChange={(e) => {
                                    setActiveSearch(prev => prev ? { ...prev, query: e.target.value } : null);
                                  }}
                                  onFocus={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const dropdownWidth = 350;
                                    let left = rect.left;
                                    if (dir === 'rtl') {
                                      left = rect.left + rect.width - dropdownWidth;
                                    }
                                    left = Math.max(10, Math.min(window.innerWidth - dropdownWidth - 10, left));
                                    setActiveSearch({
                                      index: -1,
                                      type: 'department',
                                      query: departments.find(d => d.id === selectedDepartmentId)?.name || ''
                                    });
                                    setPopoverRect({
                                      top: rect.bottom,
                                      left: left,
                                      width: dropdownWidth
                                    });
                                  }}
                                />
                                {selectedDepartmentId && (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedDepartmentId('')}
                                    className={`absolute ${dir === 'rtl' ? 'left-1.5' : 'right-1.5'} inset-y-0 flex items-center px-1 text-zinc-400 hover:text-red-500`}
                                    title={language === 'ar' ? 'مسح' : 'Clear'}
                                  >
                                    <X size={10} />
                                  </button>
                                )}
                              </div>
                              {selectedDepartmentId && (
                                <button
                                  type="button"
                                  onClick={() => applyDepartmentToAllItems()}
                                  className="p-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded text-emerald-600 hover:text-emerald-700 transition-colors flex-shrink-0"
                                  title={language === 'ar' ? 'تطبيق المختار على كافة الأصناف' : 'Apply to all items'}
                                >
                                  <CheckCheck size={12} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Cost Center input */}
                          <div>
                            <label className="block text-[9px] font-bold text-zinc-400 mb-0 px-0.5">{language === 'ar' ? 'مركز التكلفة' : 'Cost Center'}</label>
                            <div className="flex items-center gap-1">
                              <div className="relative flex-1">
                                <input 
                                  type="text" 
                                  placeholder={language === 'ar' ? 'ابحث عن مركز...' : 'Search cost center...'}
                                  className="w-full px-1.5 py-0.5 rounded-md bg-zinc-50 border border-zinc-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800 text-[11px]"
                                  value={
                                    activeSearch && activeSearch.index === -1 && activeSearch.type === 'cost_center'
                                      ? activeSearch.query
                                      : (costCenters.find(cc => cc.id === selectedCostCenterId)?.name || '')
                                  }
                                  onChange={(e) => {
                                    setActiveSearch(prev => prev ? { ...prev, query: e.target.value } : null);
                                  }}
                                  onFocus={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const dropdownWidth = 350;
                                    let left = rect.left;
                                    if (dir === 'rtl') {
                                      left = rect.left + rect.width - dropdownWidth;
                                    }
                                    left = Math.max(10, Math.min(window.innerWidth - dropdownWidth - 10, left));
                                    setActiveSearch({
                                      index: -1,
                                      type: 'cost_center',
                                      query: costCenters.find(cc => cc.id === selectedCostCenterId)?.name || ''
                                    });
                                    setPopoverRect({
                                      top: rect.bottom,
                                      left: left,
                                      width: dropdownWidth
                                    });
                                  }}
                                />
                                {selectedCostCenterId && (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedCostCenterId('')}
                                    className={`absolute ${dir === 'rtl' ? 'left-1.5' : 'right-1.5'} inset-y-0 flex items-center px-1 text-zinc-400 hover:text-red-500`}
                                    title={language === 'ar' ? 'مسح' : 'Clear'}
                                  >
                                    <X size={10} />
                                  </button>
                                )}
                              </div>
                              {selectedCostCenterId && (
                                <button
                                  type="button"
                                  onClick={() => applyCostCenterToAllItems()}
                                  className="p-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded text-emerald-600 hover:text-emerald-700 transition-colors flex-shrink-0"
                                  title={language === 'ar' ? 'تطبيق المختار على كافة الأصناف' : 'Apply to all items'}
                                >
                                  <CheckCheck size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 6. Subject / Description - Full width at the bottom of the metadata card */}
                        <div className="pt-1 border-t border-zinc-100 mt-1">
                          <label className="block text-[9px] font-bold text-zinc-400 mb-0 px-0.5">{language === 'ar' ? 'موضوع الفاتورة' : 'Invoice Subject'}</label>
                          <input
                            type="text"
                            className="w-full px-3 py-0.5 rounded-md bg-zinc-50 border border-zinc-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-850 text-[11px] placeholder:text-zinc-300 font-sans"
                            placeholder={language === 'ar' ? 'أدخل وصفاً عاماً يظهر في أعلى الفاتورة...' : 'Enter a general description...'}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                          />
                        </div>

                        {/* Linked journal entry and Custom payment terms warnings if any */}
                        <div className="flex flex-wrap gap-2 text-xs">
                          {paymentType === 'credit' && paymentTerms === 'custom' && (
                            <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded-md font-bold">
                              <span className="text-[10px] font-bold text-zinc-400 uppercase">{language === 'ar' ? 'أيام السداد:' : 'Days:'}</span>
                              <input
                                type="number"
                                min={0}
                                className="w-12 bg-transparent border-b border-zinc-300 focus:border-emerald-500 outline-none text-center font-bold text-zinc-800"
                                value={paymentTermsDays}
                                onChange={(e) => setPaymentTermsDays(Number(e.target.value) || 0)}
                              />
                              <span className="text-[10px] font-bold text-zinc-400 uppercase">{language === 'ar' ? 'دفعة مقدمة %:' : 'Advance %:'}</span>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                className="w-12 bg-transparent border-b border-zinc-300 focus:border-emerald-500 outline-none text-center font-bold text-zinc-800"
                                value={advancePercentage}
                                onChange={(e) => setAdvancePercentage(Number(e.target.value) || 0)}
                              />
                            </div>
                          )}
                        </div>

                        {/* Credit Limit Warning Banner */}
                        {paymentType === 'credit' && selectedCustomerId && (() => {
                          const currentCustomer = customers.find(c => c.id === selectedCustomerId);
                          const totalInvoiceAmount = items.reduce((sum, i) => sum + (Number(i.total) || 0), 0) - discount;
                          const customerBalance = getCustomerBalance(selectedCustomerId);
                          const totalTentativeBalance = customerBalance + totalInvoiceAmount;
                          
                          if (currentCustomer && currentCustomer.credit_limit > 0 && totalTentativeBalance > currentCustomer.credit_limit) {
                            return (
                              <div className="mt-1 p-1 bg-rose-50 border border-rose-200 rounded-md flex items-start gap-1.5 text-rose-800 animate-in fade-in slide-in-from-top-2 duration-300">
                                <span className="text-xs">⚠️</span>
                                <div className="flex-1 text-[9px] font-medium text-right">
                                  <p className="font-bold text-rose-950 mb-0">
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

                        {/* Pending Sales Orders List */}
                        {pendingOrders.length > 0 && (
                          <div className="pt-1 border-t border-zinc-100 mt-1 space-y-1">
                            <label className="block text-[9px] font-bold text-emerald-600 tracking-tighter px-0.5 uppercase flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              {language === 'ar' ? 'ربط بأوامر البيع المعلقة' : 'Link Pending Sales Orders'}
                            </label>
                            <div className="bg-zinc-50 border border-zinc-200 rounded-md p-1.5 overflow-hidden">
                              <div className="overflow-x-auto max-h-24">
                                <table className="w-full text-[10px] text-right">
                                  <thead>
                                    <tr className="text-zinc-400 font-bold border-b border-zinc-200 pb-0.5">
                                      <th className="py-0.5 text-center w-6"></th>
                                      <th className="py-0.5 text-right">{language === 'ar' ? 'رقم الأمر' : 'Order No'}</th>
                                      <th className="py-0.5 text-right">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                                      <th className="py-0.5 text-right">{language === 'ar' ? 'الإجمالي' : 'Total'}</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-zinc-100">
                                    {pendingOrders.map(order => (
                                      <tr key={order.id} className="hover:bg-zinc-100/50">
                                        <td className="py-1 text-center">
                                          <input 
                                            type="checkbox"
                                            checked={selectedOrderIds.includes(order.id)}
                                            onChange={(e) => handleOrderCheckboxChange(order.id, e.target.checked)}
                                            className="rounded text-emerald-600 focus:ring-emerald-500 w-3 h-3 cursor-pointer"
                                          />
                                        </td>
                                        <td className="py-1 font-mono text-emerald-700 font-bold">{order.order_number}</td>
                                        <td className="py-1 text-zinc-500">{formatDate(order.date)}</td>
                                        <td className="py-1 text-zinc-900 font-bold">{formatMoney(order.total_amount)} {companyData?.settings?.currency || ''}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </section>

                    {/* Card 3: الأصناف */}
                    <section className="bg-white p-2.5 rounded-xl border border-zinc-200 shadow-sm space-y-1.5">
                      <div className="flex flex-row items-center justify-between gap-1.5 mb-1">
                        <div className="flex items-center gap-1.5 text-emerald-600">
                          <Package className="w-3.5 h-3.5" />
                          <h2 className="font-semibold text-zinc-900 text-[11px]">{t('invoices.form_items')}</h2>
                        </div>

                        <div className="flex items-center gap-1">
                            {/* Barcode scanner buttons */}
                            {(barcodeSettings.enable_camera_scanner || barcodeSettings.enable_hid_scanner) && (
                              <>
                                <button
                                  type="button"
                                  title={language === 'ar' ? 'قراءة باركود' : 'Scan Barcode'}
                                  onClick={() => { setBarcodeContinuousMode(false); setShowBarcodeScanner(true); }}
                                  className="px-2 py-0.5 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition-all flex items-center gap-1 shadow-sm text-[10px]"
                                >
                                  <span>📷</span>
                                  <span>{language === 'ar' ? 'باركود' : 'Scan'}</span>
                                </button>
                                {barcodeSettings.enable_continuous_mode && (
                                  <button
                                    type="button"
                                    title={language === 'ar' ? 'قراءة مستمرة' : 'Continuous Scan'}
                                    onClick={() => { setBarcodeContinuousMode(true); setShowBarcodeScanner(true); }}
                                    className="px-2 py-0.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-all flex items-center gap-1 shadow-sm text-[10px]"
                                  >
                                    <span>📷📷</span>
                                    <span>{language === 'ar' ? 'مستمر' : 'Continuous'}</span>
                                  </button>
                                )}
                              </>
                            )}

                            <button 
                              type="button"
                              onClick={() => addEmptyRow()}
                              className="px-2 py-0.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-all flex items-center gap-1 shadow-sm text-[10px]"
                            >
                              <Plus size={10} />
                              {t('invoices.form_add_item')}
                            </button>
                          </div>
                        </div>

                      <div className="overflow-x-auto rounded-xl border border-zinc-200 overflow-hidden">
                        <table className="w-full text-sm text-right border-collapse table-fixed min-w-[1150px]">
                          <thead>
                            <tr className="bg-zinc-100 border-b border-zinc-200 text-zinc-700 text-xs font-bold">
                              <th className="p-1 border-r border-zinc-200 text-right w-80 min-w-[320px]">{t('invoices.item_name')}</th>
                              <th className="p-1 border-r border-zinc-200 text-center w-12">{language === 'ar' ? 'صورة' : 'Image'}</th>
                              <th className="p-1 border-r border-zinc-200 text-center w-24">{language === 'ar' ? 'باركود' : 'Barcode'}</th>
                              <th className="p-1 border-r border-zinc-200 text-center w-28">{language === 'ar' ? 'رقم عملية' : 'Operation No'}</th>
                              <th className="p-1 border-r border-zinc-200 text-center w-28">{language === 'ar' ? 'الإدارة' : 'Department'}</th>
                              <th className="p-1 border-r border-zinc-200 text-center w-28">{language === 'ar' ? 'مركز التكلفة' : 'Cost Center'}</th>
                              <th className="p-1 border-r border-zinc-200 text-center w-16">{t('invoices.item_quantity')}</th>
                              <th className="p-1 border-r border-zinc-200 text-center w-24">{t('invoices.item_price')}</th>
                              {isVatEnabled && (
                                <th className="p-1 border-r border-zinc-200 text-center w-14">{language === 'ar' ? 'ض ق م' : 'VAT %'}</th>
                              )}
                              <th className="p-1 border-r border-zinc-200 text-center w-24">{t('invoices.item_total')}</th>
                              <th className="p-1 w-10"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100">
                            {items.map((item, index) => (
                              <tr key={index} className="group hover:bg-zinc-50 transition-colors">
                                <td className="p-0.5 border-b border-r border-zinc-200 w-80 min-w-[320px]">
                                  <div className="relative">
                                    <select 
                                      className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-white rounded px-1.5 py-0.5 outline-none font-bold text-zinc-800 appearance-none transition-all text-xs"
                                      value={item.product_id}
                                      onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                                    >
                                      <option value="">{t('common.select_product')}</option>
                                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                    <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-2' : 'right-2'} top-1.5 w-3.5 h-3.5 text-zinc-400 pointer-events-none`} />
                                  </div>
                                </td>
                                <td className="p-0.5 border-b border-r border-zinc-200 w-12 text-center">
                                  <div className="flex justify-center items-center">
                                    {item.image_url ? (
                                      <div className="relative group w-8 h-8">
                                        <img src={item.image_url} alt="" className="w-full h-full object-cover rounded shadow-sm" referrerPolicy="no-referrer" />
                                        <button 
                                          onClick={() => updateItem(index, 'image_url', '')}
                                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                          <X size={8} />
                                        </button>
                                      </div>
                                    ) : (
                                      <label className="cursor-pointer p-1 bg-zinc-50 border border-zinc-200 border-dashed rounded hover:bg-zinc-100 transition-colors inline-block">
                                        <ImageIcon size={14} className="text-zinc-400" />
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
                                <td className="p-0.5 border-b border-r border-zinc-200 w-24 text-center">
                                  <div className="flex flex-col items-center gap-0.5">
                                    <input 
                                      type="text" 
                                      placeholder={language === 'ar' ? 'الباركود...' : 'Barcode...'}
                                      className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-white rounded px-1.5 py-0.5 text-center font-bold text-xs text-zinc-800 outline-none transition-all font-mono"
                                      value={item.barcode || ''}
                                      onChange={(e) => updateItem(index, 'barcode', e.target.value)}
                                    />
                                    {item.barcode && (
                                      <div className="bg-white p-0.5 rounded border border-zinc-100 shadow-sm scale-90">
                                        <Barcode 
                                          value={item.barcode} 
                                          width={0.5} 
                                          height={10} 
                                          fontSize={4}
                                          margin={0}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </td>
                                
                                {/* رقم عملية */}
                                <td className="p-0.5 border-b border-r border-zinc-200 w-28 text-center">
                                  <div className="flex items-center gap-1 w-full relative">
                                    <div className="relative flex-1">
                                      <input 
                                        type="text" 
                                        placeholder={language === 'ar' ? 'ابحث عن عملية...' : 'Search operation...'}
                                        className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-white rounded px-1.5 py-0.5 text-right font-bold text-xs text-zinc-800 outline-none transition-all"
                                        value={
                                          activeSearch && activeSearch.index === index && activeSearch.type === 'operation'
                                            ? activeSearch.query
                                            : (operations.find(op => op.id === item.operation_id)?.operation_number || '')
                                        }
                                        onChange={(e) => {
                                          setActiveSearch(prev => prev ? { ...prev, query: e.target.value } : null);
                                        }}
                                        onFocus={(e) => {
                                          const rect = e.currentTarget.getBoundingClientRect();
                                          const dropdownWidth = 420;
                                          let left = rect.left;
                                          if (dir === 'rtl') {
                                            left = rect.left + rect.width - dropdownWidth;
                                          }
                                          left = Math.max(10, Math.min(window.innerWidth - dropdownWidth - 10, left));
                                          setActiveSearch({
                                            index,
                                            type: 'operation',
                                            query: operations.find(op => op.id === item.operation_id)?.operation_number || ''
                                          });
                                          setPopoverRect({
                                            top: rect.bottom,
                                            left: left,
                                            width: dropdownWidth
                                          });
                                        }}
                                      />
                                      {item.operation_id && (
                                        <button
                                          type="button"
                                          onClick={() => updateItem(index, 'operation_id', '')}
                                          className={`absolute ${dir === 'rtl' ? 'left-1' : 'right-1'} inset-y-0 flex items-center px-1 text-zinc-400 hover:text-red-500`}
                                          title={language === 'ar' ? 'مسح' : 'Clear'}
                                        >
                                          <X size={10} />
                                        </button>
                                      )}
                                    </div>
                                    {item.operation_id && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setIsModalOpen(false);
                                          setPendingViewDoc({ type: 'operation', idOrNumber: item.operation_id! });
                                          setCurrentPage('operations');
                                        }}
                                        className="p-0.5 hover:bg-zinc-100 rounded text-zinc-400 hover:text-emerald-600 transition-colors flex-shrink-0"
                                        title={language === 'ar' ? 'انتقال إلى العملية' : 'Go to operation'}
                                      >
                                        <ExternalLink size={12} />
                                      </button>
                                    )}
                                  </div>
                                </td>

                                {/* الإدارة */}
                                <td className="p-0.5 border-b border-r border-zinc-200 w-28 text-center">
                                  <div className="flex items-center gap-1 w-full relative">
                                    <div className="relative flex-1">
                                      <input 
                                        type="text" 
                                        placeholder={language === 'ar' ? 'ابحث عن إدارة...' : 'Search department...'}
                                        className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-white rounded px-1.5 py-0.5 text-right font-bold text-xs text-zinc-800 outline-none transition-all"
                                        value={
                                          activeSearch && activeSearch.index === index && activeSearch.type === 'department'
                                            ? activeSearch.query
                                            : (departments.find(d => d.id === item.department_id)?.name || '')
                                        }
                                        onChange={(e) => {
                                          setActiveSearch(prev => prev ? { ...prev, query: e.target.value } : null);
                                        }}
                                        onFocus={(e) => {
                                          const rect = e.currentTarget.getBoundingClientRect();
                                          const dropdownWidth = 350;
                                          let left = rect.left;
                                          if (dir === 'rtl') {
                                            left = rect.left + rect.width - dropdownWidth;
                                          }
                                          left = Math.max(10, Math.min(window.innerWidth - dropdownWidth - 10, left));
                                          setActiveSearch({
                                            index,
                                            type: 'department',
                                            query: departments.find(d => d.id === item.department_id)?.name || ''
                                          });
                                          setPopoverRect({
                                            top: rect.bottom,
                                            left: left,
                                            width: dropdownWidth
                                          });
                                        }}
                                      />
                                      {item.department_id && (
                                        <button
                                          type="button"
                                          onClick={() => updateItem(index, 'department_id', '')}
                                          className={`absolute ${dir === 'rtl' ? 'left-1' : 'right-1'} inset-y-0 flex items-center px-1 text-zinc-400 hover:text-red-500`}
                                          title={language === 'ar' ? 'مسح' : 'Clear'}
                                        >
                                          <X size={10} />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </td>

                                {/* مركز التكلفة */}
                                <td className="p-0.5 border-b border-r border-zinc-200 w-28 text-center">
                                  <div className="flex items-center gap-1 w-full relative">
                                    <div className="relative flex-1">
                                      <input 
                                        type="text" 
                                        placeholder={language === 'ar' ? 'ابحث عن مركز...' : 'Search cost center...'}
                                        className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-white rounded px-1.5 py-0.5 text-right font-bold text-xs text-zinc-800 outline-none transition-all"
                                        value={
                                          activeSearch && activeSearch.index === index && activeSearch.type === 'cost_center'
                                            ? activeSearch.query
                                            : (costCenters.find(cc => cc.id === item.cost_center_id)?.name || '')
                                        }
                                        onChange={(e) => {
                                          setActiveSearch(prev => prev ? { ...prev, query: e.target.value } : null);
                                        }}
                                        onFocus={(e) => {
                                          const rect = e.currentTarget.getBoundingClientRect();
                                          const dropdownWidth = 350;
                                          let left = rect.left;
                                          if (dir === 'rtl') {
                                            left = rect.left + rect.width - dropdownWidth;
                                          }
                                          left = Math.max(10, Math.min(window.innerWidth - dropdownWidth - 10, left));
                                          setActiveSearch({
                                            index,
                                            type: 'cost_center',
                                            query: costCenters.find(cc => cc.id === item.cost_center_id)?.name || ''
                                          });
                                          setPopoverRect({
                                            top: rect.bottom,
                                            left: left,
                                            width: dropdownWidth
                                          });
                                        }}
                                      />
                                      {item.cost_center_id && (
                                        <button
                                          type="button"
                                          onClick={() => updateItem(index, 'cost_center_id', '')}
                                          className={`absolute ${dir === 'rtl' ? 'left-1' : 'right-1'} inset-y-0 flex items-center px-1 text-zinc-400 hover:text-red-500`}
                                          title={language === 'ar' ? 'مسح' : 'Clear'}
                                        >
                                          <X size={10} />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </td>

                                <td className="p-0.5 border-b border-r border-zinc-200 w-16">
                                  <input 
                                    type="number" 
                                    className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-white rounded px-1.5 py-0.5 text-center font-black text-zinc-900 outline-none transition-all text-xs"
                                    value={item.quantity !== undefined && item.quantity !== null ? Number(item.quantity) : ''}
                                    onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                  />
                                </td>
                                <td className="p-0.5 border-b border-r border-zinc-200 w-24">
                                  <input 
                                    type="text" 
                                    className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-white rounded px-1.5 py-0.5 text-center font-bold text-zinc-800 outline-none transition-all text-xs font-bold font-mono"
                                    value={focusedPriceIndex === index ? tempPriceValue : formatMoney(item.unit_price)}
                                    onFocus={() => {
                                      setFocusedPriceIndex(index);
                                      setTempPriceValue(item.unit_price ? String(item.unit_price) : '');
                                    }}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (/^\d*\.?\d*$/.test(val)) {
                                        setTempPriceValue(val);
                                        updateItem(index, 'unit_price', parseFloat(val) || 0);
                                      }
                                    }}
                                    onBlur={() => {
                                      setFocusedPriceIndex(null);
                                    }}
                                  />
                                </td>
                                {isVatEnabled && (
                                  <td className="p-0.5 border-b border-r border-zinc-200 w-14">
                                    <div className="flex items-center justify-center gap-0.5">
                                      <input 
                                        type="number" 
                                        min={0}
                                        disabled={!hasBusinessPermission("edit_tax")}
                                        max={100}
                                        className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-white rounded px-1 py-0.5 text-center font-black text-zinc-900 outline-none transition-all text-xs disabled:opacity-75 disabled:cursor-not-allowed"
                                        value={item.vat_rate !== undefined && item.vat_rate !== null ? Number(item.vat_rate) : 0}
                                        onChange={(e) => updateItem(index, 'vat_rate', parseFloat(e.target.value) || 0)}
                                      />
                                      <span className="text-sm text-zinc-900 font-black">%</span>
                                    </div>
                                  </td>
                                )}
                                <td className="p-0.5 border-b border-r border-zinc-200 w-24 text-center font-bold text-emerald-600 text-xs">
                                  {formatMoney(item.total)}
                                </td>
                                <td className="p-0.5 border-b border-zinc-200 w-10 text-center">
                                  <button 
                                    type="button"
                                    onClick={() => removeItem(index)}
                                    className="p-1 text-zinc-300 hover:text-red-500 transition-colors"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {items.length === 0 && (
                              <tr>
                                <td colSpan={isVatEnabled ? 11 : 10} className="px-3 py-6 text-center text-zinc-400 italic text-xs">
                                  {t('common.no_items')}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>



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
                                <span>{formatMoney(formSettlements.reduce((sum, s) => sum + Number(s.settled_amount), 0))} {currentInvoiceCurrencyCode}</span>
                              </div>
                              <div className="flex items-center gap-2 bg-slate-50 text-slate-700 px-3 py-1 rounded-full border border-slate-200 text-xs font-sans">
                                <span>{language === 'ar' ? 'الفرق:' : 'Difference:'}</span>
                                <span>{formatMoney(Math.max(0, invoiceGrandTotal - formSettlements.reduce((sum, s) => sum + Number(s.settled_amount), 0)))} {currentInvoiceCurrencyCode}</span>
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

                    {/* Existing Settlements for Editing Invoice */}
                    {editingInvoice && (() => {
                      const existingSettlements = getInvoiceSettlements(editingInvoice);
                      if (existingSettlements.length === 0) return null;
                      
                      return (
                        <section className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm space-y-4 mt-8">
                          <div className="flex items-center gap-2 text-emerald-600 border-b border-zinc-100 pb-4">
                            <Layers className="w-5 h-5" />
                            <h2 className="font-semibold text-zinc-900">
                              {language === 'ar' ? 'التسويات المرتبطة بالفاتورة' : 'Settlements Linked to Invoice'}
                            </h2>
                          </div>
                          
                          <div className="overflow-x-auto">
                            <table className={`w-full text-sm ${dir === 'rtl' ? 'text-right' : 'text-left'} border-collapse`}>
                              <thead>
                                <tr className="border-b border-zinc-100 text-zinc-400 text-xs font-bold uppercase tracking-wider">
                                  <th className="pb-2 text-right">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                                  <th className="pb-2 text-right">{language === 'ar' ? 'رقم التسوية' : 'Settlement No.'}</th>
                                  <th className="pb-2 text-right">{language === 'ar' ? 'نوع الحركة' : 'Transaction Type'}</th>
                                  <th className="pb-2 text-right">{language === 'ar' ? 'رقم الحركة / المرجع' : 'Reference / Doc No'}</th>
                                  <th className="pb-2 text-right">{language === 'ar' ? 'الملاحظات' : 'Notes'}</th>
                                  <th className="pb-2 text-left">{language === 'ar' ? 'المبلغ المسوى' : 'Settled Amount'}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-50 text-zinc-700 font-bold">
                                {existingSettlements.map((s: any) => (
                                  <tr key={s.id} className="hover:bg-zinc-50/50 transition-colors">
                                    <td className="py-2.5 font-mono text-xs">{formatDate(s.date)}</td>
                                    <td className="py-2.5 font-mono text-xs text-indigo-600 font-black">
                                      {s.settlement_number ? (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            closeModal();
                                            setPendingViewDoc({ type: 'settlement', idOrNumber: s.settlement_number });
                                            setCurrentPage(editingInvoice.customer_id ? 'customer_settlements' : 'supplier_settlements');
                                          }}
                                          className="hover:underline text-indigo-600 font-mono font-black"
                                        >
                                          {s.settlement_number}
                                        </button>
                                      ) : (
                                        '-'
                                      )}
                                    </td>
                                    <td className="py-2.5 text-zinc-500 font-semibold">{s.type_label}</td>
                                    <td className="py-2.5 font-mono text-emerald-600 font-black">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          closeModal();
                                          setPendingViewDoc({ type: s.page_name === 'journal_entries' ? 'journal' : s.page_name === 'receipts' ? 'receipt' : s.page_name, idOrNumber: s.number });
                                          setCurrentPage(s.page_name);
                                        }}
                                        className="hover:underline text-emerald-600 font-mono font-black"
                                      >
                                        {s.number}
                                      </button>
                                    </td>
                                    <td className="py-2.5 text-zinc-500 font-medium max-w-xs truncate" title={s.notes}>{s.notes || '-'}</td>
                                    <td className="py-2.5 text-left text-emerald-600 font-black">{formatMoney(s.amount)} {t('invoices.currency')}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </section>
                      );
                    })()}

                    {/* Floating Autocomplete Popover */}
                    {activeSearch && popoverRect && (
                      <>
                        <div 
                          className="fixed inset-0 z-[100]" 
                          onClick={() => setActiveSearch(null)} 
                        />
                        <div 
                          className="fixed z-[110] bg-white rounded-xl border border-zinc-200 shadow-2xl overflow-y-auto text-xs text-right scrollbar-thin scrollbar-thumb-zinc-300"
                          style={{
                            top: popoverRect.top,
                            left: popoverRect.left,
                            width: popoverRect.width,
                            maxHeight: '260px',
                          }}
                        >
                          {activeSearch.type === 'operation' && (() => {
                            const filtered = operations.filter(op => {
                              const q = activeSearch.query.toLowerCase().trim();
                              if (!q) return true;
                              return (
                                (op.operation_number || '').toLowerCase().includes(q) ||
                                (op.customer_name || '').toLowerCase().includes(q) ||
                                (op.description || '').toLowerCase().includes(q)
                              );
                            });
                            return (
                              <table className="w-full text-right border-collapse">
                                <thead>
                                  <tr className="bg-zinc-100 border-b border-zinc-200 text-zinc-600 font-bold text-[10px] sticky top-0 z-10">
                                    <th className="p-2 text-right">{language === 'ar' ? 'رقم العملية' : 'Op Number'}</th>
                                    <th className="p-2 text-right">{language === 'ar' ? 'العميل' : 'Customer'}</th>
                                    <th className="p-2 text-right">{language === 'ar' ? 'التفاصيل' : 'Details'}</th>
                                    <th className="p-2 text-center">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                                    <th className="p-2 text-center">{language === 'ar' ? 'الحالة' : 'Status'}</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100">
                                  {filtered.map(op => (
                                    <tr 
                                      key={op.id} 
                                      onClick={() => {
                                        if (activeSearch.index === -1) {
                                          setSelectedOperationId(op.id);
                                          if (op.department_id) {
                                            setSelectedDepartmentId(op.department_id);
                                          }
                                          if (op.cost_center_id) {
                                            setSelectedCostCenterId(op.cost_center_id);
                                          }
                                        } else {
                                          updateItem(activeSearch.index, 'operation_id', op.id);
                                        }
                                        setActiveSearch(null);
                                      }}
                                      className="hover:bg-emerald-50 cursor-pointer transition-colors"
                                    >
                                      <td className="p-2 font-bold text-zinc-900">{op.operation_number || 'N/A'}</td>
                                      <td className="p-2 text-zinc-600 font-bold">{op.customer_name || '-'}</td>
                                      <td className="p-2 text-zinc-500 truncate max-w-[120px]" title={op.description}>{op.description || '-'}</td>
                                      <td className="p-2 text-center text-zinc-500 font-mono">{op.operation_date || op.date || '-'}</td>
                                      <td className="p-2 text-center">
                                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${op.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                          {op.status}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                  {filtered.length === 0 && (
                                    <tr>
                                      <td colSpan={5} className="p-4 text-center text-zinc-400 italic">
                                        {language === 'ar' ? 'لا توجد نتائج' : 'No results found'}
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            );
                          })()}

                          {activeSearch.type === 'department' && (() => {
                            const filtered = departments.filter(d => {
                              const q = activeSearch.query.toLowerCase().trim();
                              if (!q) return true;
                              return (
                                (d.code || '').toLowerCase().includes(q) ||
                                (d.name || '').toLowerCase().includes(q) ||
                                (d.description || '').toLowerCase().includes(q)
                              );
                            });
                            return (
                              <table className="w-full text-right border-collapse">
                                <thead>
                                  <tr className="bg-zinc-100 border-b border-zinc-200 text-zinc-600 font-bold text-[10px] sticky top-0 z-10">
                                    <th className="p-2 text-right">{language === 'ar' ? 'الكود' : 'Code'}</th>
                                    <th className="p-2 text-right">{language === 'ar' ? 'الاسم' : 'Name'}</th>
                                    <th className="p-2 text-right">{language === 'ar' ? 'الوصف' : 'Description'}</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100">
                                  {filtered.map(d => (
                                    <tr 
                                      key={d.id} 
                                      onClick={() => {
                                        if (activeSearch.index === -1) {
                                          setSelectedDepartmentId(d.id);
                                        } else {
                                          updateItem(activeSearch.index, 'department_id', d.id);
                                        }
                                        setActiveSearch(null);
                                      }}
                                      className="hover:bg-emerald-50 cursor-pointer transition-colors"
                                    >
                                      <td className="p-2 font-mono text-zinc-900 font-bold">{d.code || '-'}</td>
                                      <td className="p-2 text-zinc-600 font-bold">{d.name}</td>
                                      <td className="p-2 text-zinc-500 truncate max-w-[150px]" title={d.description}>{d.description || '-'}</td>
                                    </tr>
                                  ))}
                                  {filtered.length === 0 && (
                                    <tr>
                                      <td colSpan={3} className="p-4 text-center text-zinc-400 italic">
                                        {language === 'ar' ? 'لا توجد نتائج' : 'No results found'}
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            );
                          })()}

                          {activeSearch.type === 'cost_center' && (() => {
                            const filtered = costCenters.filter(cc => {
                              const q = activeSearch.query.toLowerCase().trim();
                              if (!q) return true;
                              return (
                                (cc.code || '').toLowerCase().includes(q) ||
                                (cc.name || '').toLowerCase().includes(q) ||
                                (cc.description || '').toLowerCase().includes(q)
                              );
                            });
                            return (
                              <table className="w-full text-right border-collapse">
                                <thead>
                                  <tr className="bg-zinc-100 border-b border-zinc-200 text-zinc-600 font-bold text-[10px] sticky top-0 z-10">
                                    <th className="p-2 text-right">{language === 'ar' ? 'الكود' : 'Code'}</th>
                                    <th className="p-2 text-right">{language === 'ar' ? 'الاسم' : 'Name'}</th>
                                    <th className="p-2 text-right">{language === 'ar' ? 'الوصف' : 'Description'}</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100">
                                  {filtered.map(cc => (
                                    <tr 
                                      key={cc.id} 
                                      onClick={() => {
                                        if (activeSearch.index === -1) {
                                          setSelectedCostCenterId(cc.id);
                                        } else {
                                          updateItem(activeSearch.index, 'cost_center_id', cc.id);
                                        }
                                        setActiveSearch(null);
                                      }}
                                      className="hover:bg-emerald-50 cursor-pointer transition-colors"
                                    >
                                      <td className="p-2 font-mono text-zinc-900 font-bold">{cc.code || '-'}</td>
                                      <td className="p-2 text-zinc-600 font-bold">{cc.name}</td>
                                      <td className="p-2 text-zinc-500 truncate max-w-[150px]" title={cc.description}>{cc.description || '-'}</td>
                                    </tr>
                                  ))}
                                  {filtered.length === 0 && (
                                    <tr>
                                      <td colSpan={3} className="p-4 text-center text-zinc-400 italic">
                                        {language === 'ar' ? 'لا توجد نتائج' : 'No results found'}
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            );
                          })()}
                        </div>
                      </>
                    )}

                    {/* Inline Section for Activity Log and Journal Entry */}
                    {showSidePanel && (
                      <div className="mt-6 border border-zinc-200 rounded-2xl overflow-hidden bg-white shadow-sm flex flex-col w-full">
                        <div 
                          onClick={() => setIsPanelExpanded(!isPanelExpanded)}
                          className="p-3 border-b border-zinc-150 flex items-center justify-between bg-zinc-50 cursor-pointer select-none"
                        >
                          <div className="flex items-center gap-3">
                            <button 
                              type="button"
                              className="w-7 h-7 rounded-full bg-slate-200/70 hover:bg-slate-300 flex items-center justify-center transition-all shadow-sm"
                            >
                              {isPanelExpanded ? <ChevronDown size={16} className="text-slate-600" /> : <ChevronUp size={16} className="text-slate-600" />}
                            </button>
                            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                              <History size={16} className="text-emerald-600 animate-pulse" />
                              <span>{language === 'ar' ? 'سجل التعديلات والقيد' : 'Activity Log & Journal'}</span>
                            </h3>
                          </div>
                          <button 
                            type="button" 
                            onClick={(e) => { e.stopPropagation(); setShowSidePanel(false); }} 
                            className="p-1.5 text-slate-400 hover:text-slate-650 hover:bg-slate-200/50 rounded-lg transition-all"
                          >
                            <X size={18} />
                          </button>
                        </div>
                        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isPanelExpanded ? 'max-h-[1200px] border-t border-zinc-200' : 'max-h-0'}`}>
                          {(() => {
                            const activeCurrency = companyCurrencies.find(c => c.id === (editingInvoice?.currency_id || selectedCurrencyId));
                            const currencyCode = activeCurrency ? activeCurrency.code : (companyData?.settings?.currency || (companyData as any)?.currency || 'EGP');
                            const exchangeRateVal = editingInvoice ? (editingInvoice.exchange_rate || 1) : (Number(exchangeRate) || 1);
                            
                            return (
                              <TransactionSidePanel 
                                documentId={editingInvoice?.id || ''} 
                                category="invoices" 
                                previewJournalEntry={previewJournalEntry}
                                previewActivityLog={previewActivityLog}
                                layout="bottom"
                                currencyCode={currencyCode}
                                exchangeRate={exchangeRateVal}
                                previewItems={items}
                              />
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    {!showSidePanel && (
                      <div className="mt-6 pt-4 border-t border-zinc-100 flex items-center justify-start">
                        <button 
                          type="button"
                          onClick={() => { setShowSidePanel(true); setIsPanelExpanded(true); }}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm bg-white text-slate-755 border-slate-200 hover:bg-zinc-50"
                        >
                          <History size={14} />
                          <span>{language === 'ar' ? 'عرض سجل التعديلات والقيد' : 'Show Activity Log & Journal'}</span>
                        </button>
                      </div>
                    )}

                    {/* Actions removed from bottom of scrollable area as they are in the fixed footer */}
                  </form>
                </div>
              </div>
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
                    {viewInvoice.currency_id && (
                      <p className="text-xs text-slate-500 font-medium mt-1">
                        {language === 'ar' ? 'العملة:' : 'Currency:'}{' '}
                        <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100/50">
                          {companyCurrencies.find(c => c.id === viewInvoice.currency_id)?.code || viewInvoice.currency_id}
                        </span>
                        {viewInvoice.exchange_rate && Number(viewInvoice.exchange_rate) !== 1 && (
                          <span className="text-zinc-500 text-[10px] ml-2 mr-2 font-bold bg-zinc-50 px-2 py-0.5 rounded border border-zinc-200">
                            {language === 'ar' ? 'سعر الصرف:' : 'Exchange Rate:'} {viewInvoice.exchange_rate}
                          </span>
                        )}
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
                          <td className="px-4 py-3 text-[#71717a]">{item.quantity !== undefined && item.quantity !== null ? Number(item.quantity) : ''}</td>
                          <td className="px-4 py-3 text-[#71717a]">{formatMoney(item.unit_price)}</td>
                          <td className="px-4 py-3 font-bold text-[#18181b]">{formatMoney(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50/50 font-bold border-t border-slate-100">
                      {(() => {
                        const currencyCode = viewInvoice.currency_id ? (companyCurrencies.find(c => c.id === viewInvoice.currency_id)?.code || '') : (companyData?.settings?.currency || '');
                        return (
                          <>
                            <tr>
                              <td colSpan={5} className={`px-6 py-3 ${dir === 'rtl' ? 'text-left' : 'text-right'} text-slate-400 font-bold text-[10px] uppercase tracking-wider`}>{t('invoices.summary_subtotal')}</td>
                              <td className="px-6 py-3 text-slate-900 text-base">{formatMoney(viewInvoice.subtotal)} {currencyCode}</td>
                            </tr>
                            {Number(viewInvoice.discount_amount || viewInvoice.discount) > 0 && (
                              <tr>
                                <td colSpan={5} className={`px-6 py-3 ${dir === 'rtl' ? 'text-left' : 'text-right'} text-red-400 font-bold text-[10px] uppercase tracking-wider`}>{t('invoices.summary_discount')}</td>
                                <td className="px-6 py-3 text-red-600 text-base">-{formatMoney(viewInvoice.discount_amount || viewInvoice.discount)} {currencyCode}</td>
                              </tr>
                            )}
                            {Number(viewInvoice.tax_amount) > 0 && (
                              <tr>
                                <td colSpan={5} className={`px-6 py-3 ${dir === 'rtl' ? 'text-left' : 'text-right'} text-zinc-600 font-bold text-[10px] uppercase tracking-wider`}>{language === 'ar' ? 'ضريبة القيمة المضافة' : 'VAT'}</td>
                                <td className="px-6 py-3 text-zinc-750 text-base">+{formatMoney(viewInvoice.tax_amount)} {currencyCode}</td>
                              </tr>
                            )}
                            <tr className="bg-slate-900 text-white">
                              <td colSpan={5} className={`px-6 py-5 ${dir === 'rtl' ? 'text-left' : 'text-right'} font-black text-lg uppercase tracking-tight`}>{t('invoices.summary_total')}</td>
                              <td className="px-6 py-5 text-2xl font-black text-brand-primary">{formatMoney(viewInvoice.total_amount)} {currencyCode}</td>
                            </tr>
                          </>
                        );
                      })()}
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
                              <th className="px-4 py-3 text-right">رقم التسوية</th>
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
                                <td className="px-4 py-3 font-mono text-xs text-indigo-600 font-bold">
                                  {s.settlement_number ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setViewInvoice(null);
                                        setPendingViewDoc({ type: 'settlement', idOrNumber: s.settlement_number });
                                        setCurrentPage(viewInvoice.customer_id ? 'customer_settlements' : 'supplier_settlements');
                                      }}
                                      className="hover:underline text-indigo-600 font-mono font-bold"
                                    >
                                      {s.settlement_number}
                                    </button>
                                  ) : (
                                    '-'
                                  )}
                                </td>
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
                  onClick={() => {
                    if (viewInvoice) {
                      printDocument('invoices', viewInvoice.id);
                    }
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-white text-slate-700 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                >
                  <Printer size={20} />
                  طباعة ونموذج
                </button>
                <button 
                  onClick={() => {
                    if (viewInvoice) {
                      printDocument('invoices', viewInvoice.id);
                    }
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-white text-slate-700 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                >
                  <Download size={20} />
                  تصدير بالنموذج
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

      {/* Barcode Scanner Modal */}
      {showBarcodeScanner && (
        <BarcodeScanner
          products={products}
          continuousMode={barcodeContinuousMode}
          settings={barcodeSettings}
          language={language}
          onProductFound={(product) => {
            addItemByBarcode(product);
          }}
          onProductNotFound={(barcode) => {
            showNotification(
              language === 'ar'
                ? `الباركود غير مسجل بالنظام: ${barcode}`
                : `Barcode not found: ${barcode}`,
              'error'
            );
          }}
          onMultipleFound={(barcode) => {
            showNotification(
              language === 'ar'
                ? `يوجد أكثر من صنف بنفس الباركود: ${barcode}`
                : `Multiple products with same barcode: ${barcode}`,
              'error'
            );
          }}
          onClose={() => setShowBarcodeScanner(false)}
        />
      )}
    </div>
  );
};

