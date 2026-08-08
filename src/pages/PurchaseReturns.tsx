import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Supplier, Product, PaymentMethod, JournalEntry, JournalEntryItem, Account, Company, Operation, Department, CostCenter, Currency, ExchangeRate } from '../types';
import { 
  Search, Plus, Trash2, X, RotateCcw, User, CreditCard, Calendar, Hash, Package, 
  Save, Eye, Download, History, Printer, Edit, Phone, Mail, MapPin, Wallet, Box, 
  Maximize2, Minimize2, ChevronRight, ChevronLeft, FileText, FileSpreadsheet, Layers, ChevronDown, 
  LayoutGrid, List, CheckCheck, Coins, ImageIcon, ExternalLink, ChevronUp, Copy
} from 'lucide-react';

import { motion, AnimatePresence } from 'framer-motion';
import Barcode from 'react-barcode';
import { SmartAIInput } from '../components/SmartAIInput';
import { exportToPDF as exportToPDFUtil, printElement } from '../utils/pdfUtils';
import { exportToExcel, exportSingleDocumentToExcel, formatDataForExcel } from '../utils/excelUtils';
import { printDocument } from '../utils/printEngine';

import { dbService, apiRequest } from '../services/dbService';
import { PageActivityLog } from '../components/PageActivityLog';
import { InlineActivityLog } from '../components/InlineActivityLog';
import { TransactionSidePanel } from '../components/TransactionSidePanel';
import { ExportButtons } from '../components/ExportButtons';

import { TransactionManager } from '../services/TransactionManager';
import { ReturnSchema, JournalEntrySchema } from '../lib/schemas';
import { ActivityLog } from '../types';
import { formatNumber, formatDate, formatMoney } from '../utils/formatUtils';
import { PaginationControls } from '../components/PaginationControls';
import { CompanyInvoiceHeader } from '../components/CompanyInvoiceHeader';
import { useNavigation } from '../contexts/NavigationContext';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { DEFAULT_BARCODE_SETTINGS } from '../hooks/useBarcodeScanner';
import type { BarcodeScannerSettings } from '../hooks/useBarcodeScanner';

export const PurchaseReturns: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { showNotification } = useNotification();
  const { pendingViewDoc, setPendingViewDoc, setCurrentPage } = useNavigation();

  // Catalogs
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [purchaseReturns, setPurchaseReturns] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [companyCurrencies, setCompanyCurrencies] = useState<Currency[]>([]);

  // Multi-Currency & Exchange Rate
  const [selectedCurrencyId, setSelectedCurrencyId] = useState<string>('');
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [exchangeRateType, setExchangeRateType] = useState<'manual' | 'auto'>('manual');
  // Barcode scanner state
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [barcodeContinuousMode, setBarcodeContinuousMode] = useState(false);

  // UI state
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewReturn, setViewReturn] = useState<any | null>(null);
  const [view, setView] = useState<'table' | 'card'>('table');
  const [showAiInput, setShowAiInput] = useState(false);

  const [editingReturn, setEditingReturn] = useState<any | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [returnToDelete, setReturnToDelete] = useState<string | null>(null);
  
  const returnRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [totalRecords, setTotalRecords] = useState(0);
  const [serverSummary, setServerSummary] = useState<any>({});
  const [returnNumber, setReturnNumber] = useState('');
  const [company, setCompany] = useState<Company | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const currentReturnCurrencyCode = selectedCurrencyId 
    ? companyCurrencies.find(c => c.id === selectedCurrencyId)?.code || 'EGP'
    : company?.settings?.currency || 'EGP';

  // Form State
  const [returnData, setReturnData] = useState({
    supplier_id: '',
    warehouse_id: '',
    date: new Date().toISOString().slice(0, 10),
    payment_type: 'credit' as 'credit' | 'cash',
    payment_method_id: '',
    notes: ''
  });
  const [items, setItems] = useState<any[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [description, setDescription] = useState<string>('');

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

  const [selectedOperationId, setSelectedOperationId] = useState<string>('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [selectedCostCenterId, setSelectedCostCenterId] = useState<string>('');

  const [focusedPriceIndex, setFocusedPriceIndex] = useState<number | null>(null);
  const [tempPriceValue, setTempPriceValue] = useState<string>('');

  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  const [activityLogDocumentId, setActivityLogDocumentId] = useState<string | undefined>(undefined);
  
  const [previewJournalEntry, setPreviewJournalEntry] = useState<JournalEntry | null>(null);
  const [previewActivityLog, setPreviewActivityLog] = useState<Partial<ActivityLog> | null>(null);

  // States and effect for offscreen PDF generation
  const [pdfReturn, setPdfReturn] = useState<any | null>(null);
  const pdfReturnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pdfReturn && pdfReturnRef.current) {
      const generatePDF = async () => {
        try {
          await exportToPDFUtil(pdfReturnRef.current!, {
            filename: `${pdfReturn.return_number}.pdf`,
            margin: 10,
            orientation: 'portrait',
            reportTitle: `مرتجع مشتريات رقم: ${pdfReturn.return_number}`
          });
        } catch (e) {
          console.error('PDF Export Error:', e);
          showNotification('حدث خطأ أثناء تصدير PDF', 'error');
        } finally {
          setPdfReturn(null);
        }
      };
      const timer = setTimeout(generatePDF, 200);
      return () => clearTimeout(timer);
    }
  }, [pdfReturn]);

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
    name: '',
    code: '',
    category: '',
    cost_price: 0,
    sale_price: 0,
    stock: 0,
    min_stock: 0,
    unit: 'قطعة'
  });

  const [paymentMethodFormData, setPaymentMethodFormData] = useState({
    name: '',
    type: 'cash' as 'cash' | 'bank',
    account_number: '',
    opening_balance: 0
  });

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(field);
      setSortOrder('DESC');
    }
    setPage(1);
  };

  useEffect(() => {
    const fetchCompany = async () => {
      if (user?.company_id) {
        const companyData = await dbService.get<Company>('companies', user.company_id);
        setCompany(companyData);
      }
    };
    fetchCompany();
  }, [user?.company_id]);

  const editModalRef = useRef<HTMLDivElement>(null);


  const generateReturnNumber = async (selectedDate: string) => {
    return await dbService.getNextSequence('purchase_returns', selectedDate);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingReturn(null);
    setReturnData({
      supplier_id: '',
      warehouse_id: '',
      date: new Date().toISOString().slice(0, 10),
      payment_type: 'credit',
      payment_method_id: '',
      notes: ''
    });
    setItems([]);
    setSelectedOperationId('');
    setSelectedDepartmentId('');
    setSelectedCostCenterId('');
    setSelectedCurrencyId('');
    setExchangeRate(1);
    setExchangeRateType('manual');
    setDescription('');
    setDiscount(0);
    setShowAiInput(false);
    prevExchangeRateRef.current = 1;
  };

  const handlePrevReturn = () => {
    if (!editingReturn) return;
    const currentIndex = purchaseReturns.findIndex(r => r.id === editingReturn.id);
    if (currentIndex > 0) {
      const prev = purchaseReturns[currentIndex - 1];
      handleEdit(prev);
    }
  };

  const handleNextReturn = () => {
    if (!editingReturn) return;
    const currentIndex = purchaseReturns.findIndex(r => r.id === editingReturn.id);
    if (currentIndex < purchaseReturns.length - 1) {
      const next = purchaseReturns[currentIndex + 1];
      handleEdit(next);
    }
  };

  // Subscriptions
  useEffect(() => {
    if (user) {
      const unsubPR = dbService.subscribePaginated('purchase_returns', {
        company_id: user.company_id,
        _page: page,
        _limit: limit,
        _sortBy: sortBy,
        _sortOrder: sortOrder,
        _search: searchTerm
      }, (result: any) => {
        setPurchaseReturns(result.data);
        setTotalRecords(result.total);
        setServerSummary(result.summary);
      });
      const unsubSuppliers = dbService.subscribe<Supplier>('suppliers', user.company_id, setSuppliers);
      const unsubProducts = dbService.subscribe<Product>('products', user.company_id, setProducts);
      const unsubPM = dbService.subscribe<PaymentMethod>('payment_methods', user.company_id, setPaymentMethods);
      const unsubAccounts = dbService.subscribe<any>('accounts', user.company_id, setAccounts);
      const unsubWarehouses = dbService.subscribe<any>('warehouses', user.company_id, setWarehouses);
      const unsubOps = dbService.subscribe<Operation>('operations', user.company_id, setOperations);
      const unsubDepts = dbService.subscribe<Department>('departments', user.company_id, setDepartments);
      const unsubCC = dbService.subscribe<CostCenter>('cost_centers', user.company_id, setCostCenters);
      const unsubCurrencies = dbService.subscribe<Currency>('currencies', user.company_id, setCompanyCurrencies);
      
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
        unsubPR();
        unsubSuppliers();
        unsubProducts();
        unsubPM();
        unsubAccounts();
        unsubWarehouses();
        unsubOps();
        unsubDepts();
        unsubCC();
        unsubCurrencies();
      };
    }
  }, [user, page, limit, sortBy, sortOrder, searchTerm]);

  const isVatEnabled = company?.settings?.vat_enabled !== false && company?.vat_enabled !== false;
  const isMultiCurrencyEnabled = company?.settings?.enable_multi_currency || (company as any)?.enable_multi_currency || false;

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

  // Currency Handler
  const handleCurrencyChange = async (currencyId: string) => {
    setSelectedCurrencyId(currencyId);
    if (!currencyId || !user?.company_id || !company) {
      setExchangeRate(1);
      return;
    }
    
    const currency = companyCurrencies.find(c => c.id === currencyId);
    if (!currency) {
      setExchangeRate(1);
      return;
    }
    
    const baseCurrency = company?.settings?.currency || 'EGP';
    if (currency.code.toLowerCase() === baseCurrency.toLowerCase()) {
      setExchangeRate(1);
      setExchangeRateType('manual');
      return;
    }

    const updateMethod = company?.settings?.exchange_rate_update_method || 'manual';
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

  const selectedCurr = companyCurrencies.find(c => c.id === selectedCurrencyId);
  const currentInvoiceCurrencyCode = (selectedCurr?.code || company?.settings?.currency || (company as any)?.currency || 'EGP').toUpperCase();

  // Real-time Preview Logic
  useEffect(() => {
    if (!isModalOpen || !user) {
      setPreviewJournalEntry(null);
      setPreviewActivityLog(null);
      return;
    }

    if (!editingReturn && isModalOpen) {
      const updateNum = async () => {
        const num = await generateReturnNumber(returnData.date);
        setReturnNumber(num);
      };
      updateNum();
    }

    const generatePreview = () => {
      const isVatEnabled = company?.settings?.vat_enabled !== false && company?.vat_enabled !== false;
      const subtotalVal = (items || []).reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)), 0);
      const vatTotal = isVatEnabled
        ? (items || []).reduce((sum, item) => sum + (Number(item.vat_amount) || 0), 0)
        : 0;
      const discountVal = Number(discount) || 0;
      const total_amount = Number((subtotalVal + vatTotal - discountVal).toFixed(2)) || 0;

      if (subtotalVal <= 0) {
        setPreviewJournalEntry(null);
        setPreviewActivityLog(null);
        return;
      }

      const supplier = suppliers.find(s => s.id === returnData.supplier_id);
      const return_number = 'PRET-PREVIEW';

      // Preview Activity Log
      setPreviewActivityLog({
        action: 'إضافة مرتجع مشتريات',
        details: `إضافة مرتجع مشتريات جديد للمورد ${supplier?.name || '...'} بمبلغ ${formatNumber(total_amount)}`,
        created_at: new Date().toISOString()
      });

      // Preview Journal Entry
      const journalItems: JournalEntryItem[] = [];
      const rate = Number(exchangeRate) || 1;

      (items || []).forEach(item => {
        const product = products.find(p => p.id === item.product_id);
        
        // Calculate in foreign currency first (no rounding)
        const itemTotalFC = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
        const itemVatFC = isVatEnabled ? (Number(item.vat_amount) || 0) : 0;
        const itemDiscountFC = subtotalVal > 0 ? (itemTotalFC / subtotalVal) * discountVal : 0;
        const itemNetTotalFC = itemTotalFC + itemVatFC - itemDiscountFC;

        // Convert to local currency and round once
        const itemTotal = Number((itemTotalFC * rate).toFixed(2));
        const itemVat = Number((itemVatFC * rate).toFixed(2));
        const itemDiscount = Number((itemDiscountFC * rate).toFixed(2));
        const itemNetTotal = Number((itemNetTotalFC * rate).toFixed(2));

        let creditAccountId = '';
        let creditAccountName = '';

        if (product && product.type !== 'service') {
          creditAccountId = product.inventory_account_id || product.cost_account_id || '';
          creditAccountName = product.inventory_account_name || product.cost_account_name || 'حساب المخزون/المشتريات';
        } else {
          creditAccountId = product?.cost_account_id || '';
          creditAccountName = product?.cost_account_name || 'حساب المشتريات';
        }

        const creditAcc = accounts.find(a => a.id === creditAccountId);
        const creditAccountCode = creditAcc?.code || '';

        // 1. Credit Inventory/Purchase Account
        journalItems.push({
          account_id: creditAccountId,
          account_name: creditAccountName,
          account_code: creditAccountCode,
          product_name: item.product_name,
          debit: 0,
          credit: itemTotal,
          description: `مرتجع مشتريات صنف: ${item.product_name} - مرتجع ${return_number}`,
          operation_id: item.operation_id || null,
          department_id: item.department_id || null,
          cost_center_id: item.cost_center_id || null
        });

        // 2. Credit VAT (reverse tax) if itemVat > 0
        if (itemVat > 0) {
          let vatAccountId = product?.vat_account_id || '';
          let vatAccountName = product?.vat_account_name || (language === 'ar' ? 'حساب ضريبة القيمة المضافة' : 'VAT Account');
          if (!vatAccountId) {
            const globalVatAccount = accounts.find(a => 
              a.name.includes('ضريبة القيمة المضافة') || a.name.includes('قيمة مضافة') || a.name.includes('ضريبة مدخلات')
            );
            vatAccountId = globalVatAccount?.id || '';
            vatAccountName = globalVatAccount?.name || vatAccountName;
          }
          const vatAcc = accounts.find(a => a.id === vatAccountId);
          const vatAccountCode = vatAcc?.code || '';

          journalItems.push({
            account_id: vatAccountId,
            account_name: vatAccountName,
            account_code: vatAccountCode,
            product_name: item.product_name,
            debit: 0,
            credit: itemVat,
            description: `ضريبة القيمة المضافة - صنف: ${item.product_name} - مرتجع رقم ${return_number}`
          });
        }

        // 3. Debit Discount (reverse discount) if itemDiscount > 0
        if (itemDiscount > 0) {
          const discountAccountId = settings?.supplier_discount_account_id || '';
          const discountAccount = accounts.find(a => a.id === discountAccountId);
          const discountAccountCode = discountAccount?.code || '';

          journalItems.push({
            account_id: discountAccountId,
            account_name: discountAccount?.name || 'حساب الخصم المكتسب',
            account_code: discountAccountCode,
            product_name: item.product_name,
            debit: itemDiscount,
            credit: 0,
            description: `تسوية خصم صنف: ${item.product_name} - مرتجع مشتريات رقم ${return_number}`
          });
        }

        // Debit Accounts
        let supplierAccountId = supplier?.account_id || '';
        let supplierAccountName = supplier?.account_name || 'حساب الموردين';
        const supplierAcc = accounts.find(a => a.id === supplierAccountId);
        const supplierAccountCode = supplierAcc?.code || '';

        // 4. Debit Supplier or Cash
        if (returnData.payment_type === 'cash' && returnData.payment_method_id) {
          const pm = paymentMethods.find(p => p.id === returnData.payment_method_id);
          const cashAccountId = pm?.account_id || '';
          const cashAccountName = pm?.account_name || 'حساب النقدية';
          const cashAcc = accounts.find(a => a.id === cashAccountId);
          const cashAccountCode = cashAcc?.code || '';

          // Debit cash immediately
          journalItems.push({
            account_id: cashAccountId,
            account_name: cashAccountName,
            account_code: cashAccountCode,
            product_name: item.product_name,
            debit: itemNetTotal,
            credit: 0,
            description: `استلام نقدية مقابل مرتجع صنف: ${item.product_name} - مرتجع رقم ${return_number} - ${supplier?.name || '...'}`
          });

          // And we also clear through supplier ledger
          journalItems.push({
            account_id: supplierAccountId,
            account_name: supplierAccountName,
            account_code: supplierAccountCode,
            product_name: item.product_name,
            debit: 0,
            credit: itemNetTotal,
            description: `تسوية نقدية لمرتجع صنف: ${item.product_name} - مرتجع رقم ${return_number}`,
            supplier_id: returnData.supplier_id,
            supplier_name: supplier?.name
          });

          journalItems.push({
            account_id: supplierAccountId,
            account_name: supplierAccountName,
            account_code: supplierAccountCode,
            product_name: item.product_name,
            debit: itemNetTotal,
            credit: 0,
            description: `مرتجع مشتريات صنف: ${item.product_name} - مرتجع رقم ${return_number}`,
            supplier_id: returnData.supplier_id,
            supplier_name: supplier?.name
          });
        } else {
          // Debit Supplier Account
          journalItems.push({
            account_id: supplierAccountId,
            account_name: supplierAccountName,
            account_code: supplierAccountCode,
            product_name: item.product_name,
            debit: itemNetTotal,
            credit: 0,
            description: `مرتجع مشتريات صنف: ${item.product_name} - مرتجع رقم ${return_number}`,
            supplier_id: returnData.supplier_id,
            supplier_name: supplier?.name
          });
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
        total_debit = Number(journalItems.reduce((sum, item) => sum + (Number(item.debit) || 0), 0).toFixed(2)) || 0;
        total_credit = Number(journalItems.reduce((sum, item) => sum + (Number(item.credit) || 0), 0).toFixed(2)) || 0;
      }

      setPreviewJournalEntry({
        id: 'preview',
        date: returnData.date,
        reference_number: return_number,
        reference_id: 'preview',
        reference_type: 'purchase_return',
        description: `قيد مرتجع مشتريات رقم ${return_number}`,
        items: journalItems,
        total_debit: total_debit,
        total_credit: total_credit,
        company_id: user.company_id,
        created_at: new Date().toISOString(),
        created_by: user.id
      });
    };

    generatePreview();
  }, [isModalOpen, items, returnData.supplier_id, returnData.date, returnData.payment_type, returnData.payment_method_id, discount, user, suppliers, products, accounts]);

  const barcodeSettings: BarcodeScannerSettings = {
    ...DEFAULT_BARCODE_SETTINGS,
    ...(company?.settings?.barcode_scanner || {}),
  };

  const addItemByBarcode = (product: any) => {
    if (barcodeSettings.auto_increase_quantity) {
      const existingIndex = items.findIndex((i: any) => i.product_id === product.id);
      if (existingIndex !== -1) {
        setItems((prev: any[]) => prev.map((item: any, idx: number) => {
          if (idx === existingIndex) {
            const qty = item.quantity + 1;
            const total = Number((qty * item.unit_price).toFixed(4));
            const vat_amount = isVatEnabled ? Number((total * (item.vat_rate / 100)).toFixed(4)) : 0;
            return { ...item, quantity: qty, total, vat_amount };
          }
          return item;
        }));
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

    const baseCurrency = company?.settings?.currency || 'EGP';
    const selectedCurr = companyCurrencies.find(c => c.id === selectedCurrencyId);
    const isForeign = selectedCurr && selectedCurr.code.toLowerCase() !== baseCurrency.toLowerCase();
    
    let price = product.cost_price || 0;
    if (isForeign && exchangeRate > 0) {
      price = Number((price / exchangeRate).toFixed(4));
    }

    const total = price;
    const vat_rate = product.vat_rate || 0;
    const vat_amount = isVatEnabled ? Number((total * (vat_rate / 100)).toFixed(4)) : 0;

    setItems((prev: any[]) => [
      ...prev,
      {
        product_id: product.id,
        product_name: product.name,
        product_code: product.code,
        product_image_url: product.image_url || '',
        barcode: product.barcode || '',
        image_url: product.image_url || '',
        quantity: 1,
        unit_price: price,
        total,
        vat_rate,
        vat_amount,
        operation_id: selectedOperationId || null,
        department_id: selectedDepartmentId || null,
        cost_center_id: selectedCostCenterId || null,
      }
    ]);

    if (barcodeSettings.show_success_message) {
      showNotification(
        language === 'ar'
          ? `تمت إضافة: ${product.name}`
          : `Added: ${product.name}`,
        'success'
      );
    }
  };

  const addEmptyRow = () => {
    setItems((prev) => [
      ...prev,
      {
        product_id: '',
        product_name: '',
        product_code: '',
        product_image_url: '',
        barcode: '',
        image_url: '',
        quantity: 1,
        unit_price: 0,
        total: 0,
        vat_rate: 0,
        vat_amount: 0,
        operation_id: selectedOperationId || null,
        department_id: selectedDepartmentId || null,
        cost_center_id: selectedCostCenterId || null,
      },
    ]);
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: any) => {
    setItems(prev => {
      const newItems = [...prev];
      const item = { ...newItems[index] };
      
      if (field === 'product_id') {
        const prod = products.find(p => p.id === value);
        if (prod) {
          item.product_id = prod.id;
          item.product_name = prod.name;
          item.product_code = prod.code;
          item.product_image_url = prod.image_url || '';
          item.barcode = prod.barcode || '';
          item.image_url = prod.image_url || '';
          
          // Cost price based on currency exchange rate
          const baseCurrency = company?.settings?.currency || 'EGP';
          const selectedCurr = companyCurrencies.find(c => c.id === selectedCurrencyId);
          const isForeign = selectedCurr && selectedCurr.code.toLowerCase() !== baseCurrency.toLowerCase();
          
          let price = prod.cost_price || 0;
          if (isForeign && exchangeRate > 0) {
            price = Number((price / exchangeRate).toFixed(4));
          }
          item.unit_price = price;
          item.quantity = item.quantity || 1;
          item.vat_rate = prod.vat_rate || 0;
          item.total = Number((item.quantity * item.unit_price).toFixed(4));
          item.vat_amount = isVatEnabled ? Number((item.total * (item.vat_rate / 100)).toFixed(4)) : 0;
        } else {
          item.product_id = '';
          item.product_name = '';
          item.product_code = '';
          item.product_image_url = '';
          item.barcode = '';
          item.image_url = '';
          item.unit_price = 0;
          item.vat_rate = 0;
          item.vat_amount = 0;
          item.total = 0;
        }
      } else {
        (item as any)[field] = value;
        if (field === 'quantity' || field === 'unit_price' || field === 'vat_rate') {
          if ((item.vat_rate === undefined || item.vat_rate === null || item.vat_rate === 0) && item.product_id) {
            const p = products.find(prod => prod.id === item.product_id);
            if (p && p.vat_rate) item.vat_rate = Number(p.vat_rate);
          }
          const qty = Number(item.quantity) || 0;
          const price = Number(item.unit_price) || 0;
          const vat_rate = Number(item.vat_rate) || 0;
          item.total = Number((qty * price).toFixed(4));
          item.vat_amount = isVatEnabled ? Number((item.total * (vat_rate / 100)).toFixed(4)) : 0;
        }
      }
      
      newItems[index] = item;
      return newItems;
    });
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

      await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة مورد', `إضافة مورد جديد من مرتجع المشتريات: ${supplierFormData.name}`, ['suppliers', 'purchase_returns']);
      
      setReturnData({ ...returnData, supplier_id: supplierId });
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
      showNotification(t('common.save_success'), 'success');
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء إضافة المورد', 'error');
    }
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const productId = await dbService.add('products', {
        ...productFormData,
        company_id: user.company_id
      });
      await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة صنف', `إضافة صنف جديد من مرتجع المشتريات: ${productFormData.name}`, ['products', 'purchase_returns']);
      
      setItems([...items, {
        product_id: productId,
        product_name: productFormData.name,
        product_code: productFormData.code,
        quantity: 1,
        unit_price: productFormData.cost_price,
        total: productFormData.cost_price,
        vat_rate: 0,
        vat_amount: 0
      }]);
      setIsProductModalOpen(false);
      setProductFormData({
        name: '',
        code: '',
        category: '',
        cost_price: 0,
        sale_price: 0,
        stock: 0,
        min_stock: 0,
        unit: 'قطعة'
      });
      showNotification(t('common.save_success'), 'success');
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء إضافة الصنف', 'error');
    }
  };

  const handlePaymentMethodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const pmId = await dbService.add('payment_methods', {
        ...paymentMethodFormData,
        company_id: user.company_id
      });
      await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة طريقة دفع', `إضافة طريقة دفع جديدة من مرتجع المشتريات: ${paymentMethodFormData.name}`, ['payment_methods', 'purchase_returns']);
      
      setReturnData({ ...returnData, payment_method_id: pmId });
      setIsPaymentMethodModalOpen(false);
      setPaymentMethodFormData({
        name: '',
        type: 'cash',
        account_number: '',
        opening_balance: 0
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

    const validItems = items.filter(item => item.product_id);
    if (!returnData.supplier_id || validItems.length === 0) {
      showNotification(language === 'ar' ? 'يرجى اختيار المورد وإضافة أصناف مكتملة للمرتجع' : 'Please select supplier and add complete items to return', 'error');
      return;
    }

    const hasPhysicalProduct = items.some(item => {
      const prod = products.find(p => p.id === item.product_id);
      return prod && prod.type !== 'service';
    });

    if (hasPhysicalProduct && !returnData.warehouse_id) {
      showNotification(language === 'ar' ? 'يرجى اختيار المخزن' : 'Please select warehouse', 'error');
      return;
    }

    try {
      const supplier = suppliers.find(s => s.id === returnData.supplier_id);
      const paymentMethod = paymentMethods.find(pm => pm.id === returnData.payment_method_id);
      const return_number = editingReturn ? editingReturn.return_number : returnNumber;
      
      const subtotal = Number(validItems.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_price || 0)), 0)) || 0;
      const discount_amount = Number(discount) || 0;

      const sanitizedItems = validItems.map(item => {
        const product = products.find(p => p.id === item.product_id);
        const rate = item.vat_rate !== undefined ? item.vat_rate : (product?.vat_rate || 0);
        const total = Number((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)) || 0;
        const vat_amount = isVatEnabled ? Number((total * (rate / 100)).toFixed(2)) : 0;
        return {
          product_id: item.product_id,
          product_name: product?.name || item.product_name || '',
          product_code: product?.code || item.product_code || '',
          product_image_url: product?.image_url || item.product_image_url || '',
          barcode: product?.barcode || item.barcode || '',
          image_url: product?.image_url || item.image_url || '',
          quantity: Number(item.quantity) || 0,
          unit_price: Number(item.unit_price) || 0,
          total: total,
          vat_rate: rate,
          vat_amount: vat_amount,
          operation_id: item.operation_id || null,
          department_id: item.department_id || null,
          cost_center_id: item.cost_center_id || null,
        };
      });

      const vatTotal = isVatEnabled
        ? Number(sanitizedItems.reduce((sum, item) => sum + (Number(item.vat_amount) || 0), 0).toFixed(2))
        : 0;

      const total_amount = Number(subtotal + vatTotal - discount_amount) || 0;

      // Diff calculation
      const changes: any[] = [];
      const detailsList: string[] = [];

      if (editingReturn) {
        if (editingReturn.date !== returnData.date) {
          const oldD = formatDate(editingReturn.date);
          const newD = formatDate(returnData.date);
          changes.push({ field: language === 'ar' ? 'التاريخ' : 'Date', old_value: oldD, new_value: newD });
          detailsList.push(language === 'ar' ? `تغيير التاريخ من ${oldD} إلى ${newD}` : `Date changed from ${oldD} to ${newD}`);
        }
        if (editingReturn.supplier_id !== returnData.supplier_id) {
          const oldS = suppliers.find(s => s.id === editingReturn.supplier_id)?.name || editingReturn.supplier_name;
          const newS = suppliers.find(s => s.id === returnData.supplier_id)?.name;
          changes.push({ field: language === 'ar' ? 'المورد' : 'Supplier', old_value: oldS, new_value: newS });
          detailsList.push(language === 'ar' ? `تغيير المورد من ${oldS} إلى ${newS}` : `Supplier changed from ${oldS} to ${newS}`);
        }
        if (editingReturn.warehouse_id !== returnData.warehouse_id) {
          const oldW = warehouses.find(w => w.id === editingReturn.warehouse_id)?.name || '-';
          const newW = warehouses.find(w => w.id === returnData.warehouse_id)?.name || '-';
          changes.push({ field: language === 'ar' ? 'المخزن' : 'Warehouse', old_value: oldW, new_value: newW });
          detailsList.push(language === 'ar' ? `تغيير المخزن من ${oldW} إلى ${newW}` : `Warehouse changed from ${oldW} to ${newW}`);
        }
        if (Number(editingReturn.discount_amount || editingReturn.discount || 0) !== discount_amount) {
          const oldDisc = Number(editingReturn.discount_amount || editingReturn.discount || 0);
          changes.push({ field: language === 'ar' ? 'الخصم' : 'Discount', old_value: oldDisc, new_value: discount_amount });
          detailsList.push(language === 'ar' ? `تغيير الخصم من ${oldDisc} إلى ${discount_amount}` : `Discount changed from ${oldDisc} to ${discount_amount}`);
        }
        if (Number(editingReturn.total_amount || 0) !== total_amount) {
          const oldTot = Number(editingReturn.total_amount || 0);
          changes.push({ field: language === 'ar' ? 'إجمالي المرتجع' : 'Total Amount', old_value: oldTot, new_value: total_amount });
          detailsList.push(language === 'ar' ? `تغيير الإجمالي من ${oldTot} إلى ${total_amount}` : `Total changed from ${oldTot} to ${total_amount}`);
        }

        // Currency
        const oldCurrencyId = editingReturn.currency_id || '';
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

        // Exchange Rate
        const oldRate = Number(editingReturn.exchange_rate) || 1;
        const newRate = Number(exchangeRate) || 1;
        if (oldRate !== newRate) {
          changes.push({
            field: language === 'ar' ? 'سعر الصرف' : 'Exchange Rate',
            old_value: oldRate,
            new_value: newRate
          });
          detailsList.push(language === 'ar' ? `تغيير سعر الصرف من ${oldRate} إلى ${newRate}` : `Exchange rate changed from ${oldRate} to ${newRate}`);
        }

        // Tax
        const oldTax = Number(editingReturn.tax_amount) || 0;
        const newTax = Number(vatTotal) || 0;
        if (oldTax !== newTax) {
          changes.push({
            field: language === 'ar' ? 'الضريبة' : 'Tax',
            old_value: oldTax,
            new_value: newTax
          });
          detailsList.push(language === 'ar' ? `تغيير قيمة الضريبة من ${oldTax} إلى ${newTax}` : `Tax amount changed from ${oldTax} to ${newTax}`);
        }

        // Description
        const oldDesc = editingReturn.description || '';
        const newDesc = description || '';
        if (oldDesc !== newDesc) {
          changes.push({
            field: language === 'ar' ? 'الوصف' : 'Description',
            old_value: oldDesc || (language === 'ar' ? 'فارغ' : 'Empty'),
            new_value: newDesc || (language === 'ar' ? 'فارغ' : 'Empty')
          });
          detailsList.push(language === 'ar' ? `تعديل وصف المرتجع` : `Description updated`);
        }

        // Payment Type
        if (editingReturn.payment_type !== returnData.payment_type) {
          const oldPT = editingReturn.payment_type === 'cash' ? (language === 'ar' ? 'نقدي' : 'Cash') : (language === 'ar' ? 'آجل' : 'Credit');
          const newPT = returnData.payment_type === 'cash' ? (language === 'ar' ? 'نقدي' : 'Cash') : (language === 'ar' ? 'آجل' : 'Credit');
          changes.push({
            field: language === 'ar' ? 'نوع الدفع' : 'Payment Type',
            old_value: oldPT,
            new_value: newPT
          });
          detailsList.push(language === 'ar' ? `تغيير طريقة الدفع من ${oldPT} إلى ${newPT}` : `Payment type changed from ${oldPT} to ${newPT}`);
        }

        // Payment Method
        const oldPMId = editingReturn.payment_method_id || '';
        const newPMId = returnData.payment_type === 'cash' ? (returnData.payment_method_id || '') : '';
        if (oldPMId !== newPMId) {
          const oldPMName = paymentMethods.find(pm => pm.id === oldPMId)?.name || oldPMId || '-';
          const newPMName = paymentMethods.find(pm => pm.id === newPMId)?.name || newPMId || '-';
          changes.push({
            field: language === 'ar' ? 'طريقة الدفع' : 'Payment Method',
            old_value: oldPMName,
            new_value: newPMName
          });
          detailsList.push(language === 'ar' ? `تغيير طريقة السداد النقدي من ${oldPMName} إلى ${newPMName}` : `Payment method changed from ${oldPMName} to ${newPMName}`);
        }
        
        // Items Diff
        const oldItems = editingReturn.items || [];
        const newItems = sanitizedItems;

        oldItems.forEach((oldItem: any) => {
          const stillExists = newItems.some(newItem => newItem.product_id === oldItem.product_id);
          if (!stillExists) {
            changes.push({
              field: language === 'ar' ? 'حذف صنف' : 'Delete Product',
              old_value: `${oldItem.product_name} (${oldItem.quantity} × ${oldItem.unit_price || oldItem.price})`,
              new_value: language === 'ar' ? 'تم الحذف' : 'Deleted'
            });
            detailsList.push(language === 'ar' ? `حذف الصنف: ${oldItem.product_name}` : `Deleted product: ${oldItem.product_name}`);
          }
        });

        newItems.forEach(newItem => {
          const wasPresent = oldItems.some((oldItem: any) => oldItem.product_id === newItem.product_id);
          if (!wasPresent) {
            changes.push({
              field: language === 'ar' ? 'إضافة صنف' : 'Add Product',
              old_value: language === 'ar' ? 'جديد' : 'New',
              new_value: `${newItem.product_name} (${newItem.quantity} × ${newItem.unit_price})`
            });
            detailsList.push(language === 'ar' ? `إضافة صنف جديد: ${newItem.product_name}` : `Added new product: ${newItem.product_name}`);
          }
        });

        newItems.forEach(newItem => {
          const oldItem = oldItems.find((oi: any) => oi.product_id === newItem.product_id);
          if (oldItem) {
            const qtyChanged = Number(oldItem.quantity) !== Number(newItem.quantity);
            const priceChanged = Number(oldItem.unit_price || oldItem.price) !== Number(newItem.unit_price);
            const opChanged = oldItem.operation_id !== newItem.operation_id;
            const ccChanged = oldItem.cost_center_id !== newItem.cost_center_id;
            const deptChanged = oldItem.department_id !== newItem.department_id;

            if (qtyChanged || priceChanged || opChanged || ccChanged || deptChanged) {
              const diffParts: string[] = [];
              if (qtyChanged) diffParts.push(language === 'ar' ? `الكمية من ${oldItem.quantity} إلى ${newItem.quantity}` : `Qty from ${oldItem.quantity} to ${newItem.quantity}`);
              if (priceChanged) diffParts.push(language === 'ar' ? `السعر من ${oldItem.unit_price || oldItem.price} إلى ${newItem.unit_price}` : `Price from ${oldItem.unit_price || oldItem.price} to ${newItem.unit_price}`);
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
                old_value: `${language === 'ar' ? 'الكمية:' : 'Qty:'} ${oldItem.quantity}، ${language === 'ar' ? 'السعر:' : 'Price:'} ${oldItem.unit_price || oldItem.price}`,
                new_value: `${language === 'ar' ? 'الكمية:' : 'Qty:'} ${newItem.quantity}، ${language === 'ar' ? 'السعر:' : 'Price:'} ${newItem.unit_price} (${diffParts.join('، ')})`
              });
              detailsList.push(language === 'ar' ? `تعديل تفاصيل الصنف: ${newItem.product_name}` : `Updated details of product: ${newItem.product_name}`);
            }
          }
        });
      }

      const data = {
        return_number,
        supplier_id: returnData.supplier_id,
        supplier_name: supplier?.name || '',
        warehouse_id: returnData.warehouse_id || null,
        date: returnData.date, 
        items: sanitizedItems,
        subtotal,
        discount: discount_amount,
        discount_amount,
        tax_amount: vatTotal,
        total_amount,
        payment_type: returnData.payment_type,
        payment_method_id: returnData.payment_type === 'cash' ? (returnData.payment_method_id || null) : null,
        payment_method_name: returnData.payment_type === 'cash' ? (paymentMethod?.name || '') : null,
        company_id: user.company_id,
        operation_id: selectedOperationId || null,
        department_id: selectedDepartmentId || null,
        cost_center_id: selectedCostCenterId || null,
        currency_id: selectedCurrencyId || null,
        exchange_rate: Number(exchangeRate) || 1,
        description: description || null,
        notes: returnData.notes || null,
        created_at: editingReturn ? editingReturn.created_at : new Date().toISOString(),
        created_by: editingReturn ? editingReturn.created_by : user.id,
        updated_at: editingReturn ? new Date().toISOString() : undefined,
        updated_by: editingReturn ? user.id : undefined,
      };

      const rate = Number(exchangeRate) || 1;
      const journalItems: any[] = [];

      (sanitizedItems || []).forEach(item => {
        const product = products.find(p => p.id === item.product_id);
        
        // Calculate in foreign currency first (no rounding)
        const itemTotalFC = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
        const itemVatFC = isVatEnabled ? (Number(item.vat_amount) || 0) : 0;
        const itemDiscountFC = subtotal > 0 ? (itemTotalFC / subtotal) * discount_amount : 0;
        const itemNetTotalFC = itemTotalFC + itemVatFC - itemDiscountFC;
        
        // Convert to local currency and round once
        const itemTotal = Number((itemTotalFC * rate).toFixed(2));
        const itemVat = Number((itemVatFC * rate).toFixed(2));
        const itemDiscount = Number((itemDiscountFC * rate).toFixed(2));
        const itemNetTotal = Number((itemNetTotalFC * rate).toFixed(2));

        let creditAccountId = '';
        let creditAccountName = '';

        if (product && product.type !== 'service') {
          creditAccountId = product.inventory_account_id || product.cost_account_id || '';
          creditAccountName = product.inventory_account_name || product.cost_account_name || 'حساب المخزون/المشتريات';
        } else {
          creditAccountId = product?.cost_account_id || '';
          creditAccountName = product?.cost_account_name || 'حساب المشتريات';
        }

        const creditAcc = accounts.find(a => a.id === creditAccountId);
        const creditAccountCode = creditAcc?.code || '';

        // 1. Credit Inventory/Purchase Account
        journalItems.push({
          account_id: creditAccountId,
          account_name: creditAccountName,
          account_code: creditAccountCode,
          product_name: item.product_name,
          debit: 0,
          credit: itemTotal,
          description: `مرتجع مشتريات صنف: ${item.product_name} - مرتجع ${return_number}`,
          operation_id: item.operation_id || null,
          department_id: item.department_id || null,
          cost_center_id: item.cost_center_id || null
        });

        // 2. Credit VAT (reverse tax) if itemVat > 0
        if (itemVat > 0) {
          let vatAccountId = product?.vat_account_id || '';
          let vatAccountName = product?.vat_account_name || (language === 'ar' ? 'حساب ضريبة القيمة المضافة' : 'VAT Account');
          if (!vatAccountId) {
            const globalVatAccount = accounts.find(a => 
              a.name.includes('ضريبة القيمة المضافة') || a.name.includes('قيمة مضافة') || a.name.includes('ضريبة مدخلات')
            );
            vatAccountId = globalVatAccount?.id || '';
            vatAccountName = globalVatAccount?.name || vatAccountName;
          }
          const vatAcc = accounts.find(a => a.id === vatAccountId);
          const vatAccountCode = vatAcc?.code || '';

          journalItems.push({
            account_id: vatAccountId,
            account_name: vatAccountName,
            account_code: vatAccountCode,
            product_name: item.product_name,
            debit: 0,
            credit: itemVat,
            description: `ضريبة القيمة المضافة - صنف: ${item.product_name} - مرتجع رقم ${return_number}`
          });
        }

        // 3. Debit Discount (reverse discount) if itemDiscount > 0
        if (itemDiscount > 0) {
          const discountAccountId = settings?.supplier_discount_account_id || '';
          const discountAccount = accounts.find(a => a.id === discountAccountId);
          const discountAccountCode = discountAccount?.code || '';

          journalItems.push({
            account_id: discountAccountId,
            account_name: discountAccount?.name || 'حساب الخصم المكتسب',
            account_code: discountAccountCode,
            product_name: item.product_name,
            debit: itemDiscount,
            credit: 0,
            description: `تسوية خصم صنف: ${item.product_name} - مرتجع مشتريات رقم ${return_number}`
          });
        }

        // Debit Accounts
        let supplierAccountId = supplier?.account_id || '';
        let supplierAccountName = supplier?.account_name || 'حساب الموردين';
        const supplierAcc = accounts.find(a => a.id === supplierAccountId);
        const supplierAccountCode = supplierAcc?.code || '';

        // 4. Debit Supplier or Cash
        if (returnData.payment_type === 'cash' && returnData.payment_method_id) {
          const pm = paymentMethods.find(p => p.id === returnData.payment_method_id);
          const cashAccountId = pm?.account_id || '';
          const cashAccountName = pm?.account_name || 'حساب النقدية';
          const cashAcc = accounts.find(a => a.id === cashAccountId);
          const cashAccountCode = cashAcc?.code || '';

          // Debit cash immediately
          journalItems.push({
            account_id: cashAccountId,
            account_name: cashAccountName,
            account_code: cashAccountCode,
            product_name: item.product_name,
            debit: itemNetTotal,
            credit: 0,
            description: `استلام نقدية مقابل مرتجع صنف: ${item.product_name} - مرتجع رقم ${return_number} - ${supplier?.name || '...'}`
          });

          // And we also clear through supplier ledger
          journalItems.push({
            account_id: supplierAccountId,
            account_name: supplierAccountName,
            account_code: supplierAccountCode,
            product_name: item.product_name,
            debit: 0,
            credit: itemNetTotal,
            description: `تسوية نقدية لمرتجع صنف: ${item.product_name} - مرتجع رقم ${return_number}`,
            supplier_id: returnData.supplier_id,
            supplier_name: supplier?.name
          });

          journalItems.push({
            account_id: supplierAccountId,
            account_name: supplierAccountName,
            account_code: supplierAccountCode,
            product_name: item.product_name,
            debit: itemNetTotal,
            credit: 0,
            description: `مرتجع مشتريات صنف: ${item.product_name} - مرتجع رقم ${return_number}`,
            supplier_id: returnData.supplier_id,
            supplier_name: supplier?.name
          });
        } else {
          // Debit Supplier Account
          journalItems.push({
            account_id: supplierAccountId,
            account_name: supplierAccountName,
            account_code: supplierAccountCode,
            product_name: item.product_name,
            debit: itemNetTotal,
            credit: 0,
            description: `مرتجع مشتريات صنف: ${item.product_name} - مرتجع رقم ${return_number}`,
            supplier_id: returnData.supplier_id,
            supplier_name: supplier?.name
          });
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
        date: returnData.date,
        reference_number: return_number,
        reference_type: 'purchase_return',
        description: `قيد مرتجع مشتريات رقم ${return_number}`,
        items: journalItems,
        total_debit,
        total_credit,
        company_id: user.company_id,
        created_at: new Date().toISOString(),
        created_by: user.id
      };

      if (editingReturn) {
        await dbService.deleteJournalEntryByReference(editingReturn.id, user.company_id);
        await TransactionManager.updateWithAccounting(
          'purchase_returns',
          editingReturn.id,
          data,
          ReturnSchema,
          journalEntryData,
          JournalEntrySchema
        );
      } else {
        await TransactionManager.saveWithAccounting(
          'purchase_returns',
          data,
          ReturnSchema,
          journalEntryData,
          JournalEntrySchema
        );
      }

      // Log activity
      if (editingReturn) {
        if (changes.length > 0) {
          const logAction = language === 'ar' ? 'تعديل مرتجع مشتريات' : 'Update Purchase Return';
          const logDetails = detailsList.join(' | ');
          await dbService.logActivity(
            user.id,
            user.username,
            user.company_id,
            logAction,
            logDetails || `تعديل المرتجع رقم ${return_number}`,
            'purchase_returns',
            editingReturn.id,
            changes
          );
        }
      } else {
        await dbService.logActivity(
          user.id, 
          user.username, 
          user.company_id, 
          'إضافة مرتجع مشتريات', 
          `إضافة مرتجع مشتريات جديد رقم: ${return_number}`, 
          'purchase_returns'
        );
      }

      showNotification(language === 'ar' ? (editingReturn ? 'تم تحديث مرتجع المشتريات بنجاح' : 'تم حفظ مرتجع المشتريات بنجاح') : (editingReturn ? 'Purchase return updated successfully' : 'Purchase return saved successfully'), 'success');
      closeModal();
    } catch (e: any) {
      console.error('Save failed:', e);
      showNotification(e.message || (language === 'ar' ? 'حدث خطأ أثناء حفظ مرتجع المشتريات' : 'An error occurred while saving purchase return'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportExcel = () => {
    const formattedData = formatDataForExcel(filteredReturns, {
      'return_number': 'رقم المرتجع',
      'supplier_name': 'المورد',
      'date': 'التاريخ',
      'total_amount': 'المبلغ الإجمالي'
    });
    exportToExcel(formattedData, { filename: 'PurchaseReturns_Report', sheetName: language === 'ar' ? 'مرتجع مشتريات' : 'Purchase Returns' });
  };

  const handleExportPDF = async () => {
    if (tableRef.current) {
      await exportToPDFUtil(tableRef.current, { 
        filename: 'PurchaseReturns_Report', 
        orientation: 'landscape',
        reportTitle: language === 'ar' ? 'قائمة مرتجعات المشتريات' : 'Purchase Returns List'
      });
    }
  };

  const openModal = async () => {
    const newDate = new Date().toISOString().slice(0, 10);
    setReturnData({
      supplier_id: '',
      warehouse_id: '',
      date: newDate,
      payment_type: 'credit',
      payment_method_id: '',
      notes: ''
    });
    setItems([
      {
        product_id: '',
        product_name: '',
        product_code: '',
        product_image_url: '',
        barcode: '',
        image_url: '',
        quantity: 1,
        unit_price: 0,
        total: 0,
        vat_rate: 0,
        vat_amount: 0,
        operation_id: '',
        department_id: '',
        cost_center_id: ''
      }
    ]);
    setSelectedOperationId('');
    setSelectedDepartmentId('');
    setSelectedCostCenterId('');
    setSelectedCurrencyId('');
    setExchangeRate(1);
    setExchangeRateType('manual');
    setDescription('');
    setDiscount(0);
    prevExchangeRateRef.current = 1;
    const num = await generateReturnNumber(newDate);
    setReturnNumber(num);
    setEditingReturn(null);
    setIsModalOpen(true);
  };

  const handleEdit = async (ret: any) => {

    try {
      const fullData = await dbService.get<any>('purchase_returns', ret.id);

      if (!fullData) throw new Error('Return details not found');

      setEditingReturn(fullData);
      setReturnNumber(fullData.return_number);
      setReturnData({
        supplier_id: fullData.supplier_id,
        warehouse_id: fullData.warehouse_id || '',
        date: fullData.date ? fullData.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
        payment_type: fullData.payment_type || 'credit',
        payment_method_id: fullData.payment_method_id || '',
        notes: fullData.notes || ''
      });
      
      setSelectedOperationId(fullData.operation_id || '');
      setSelectedDepartmentId(fullData.department_id || '');
      setSelectedCostCenterId(fullData.cost_center_id || '');
      setSelectedCurrencyId(fullData.currency_id || '');
      setExchangeRate(fullData.exchange_rate || 1);
      prevExchangeRateRef.current = fullData.exchange_rate || 1;
      setDescription(fullData.description || '');
      setDiscount(fullData.discount_amount || fullData.discount || 0);

      setItems((fullData.items || []).map((item: any) => {
        const qty = Number(item.quantity) || 0;
        const price = Number(item.unit_price || item.price) || 0;
        const total = Number(item.total) || (qty * price);
        const prod = products.find(p => p.id === item.product_id);
        let vatRate = (item.vat_rate !== undefined && item.vat_rate !== null && Number(item.vat_rate) > 0)
          ? Number(item.vat_rate)
          : (item.tax_rate ? Number(item.tax_rate) : (prod?.vat_rate ? Number(prod.vat_rate) : 0));
        let vatAmount = (item.vat_amount !== undefined && item.vat_amount !== null && Number(item.vat_amount) > 0)
          ? Number(item.vat_amount)
          : (item.tax ? Number(item.tax) : Number((total * (vatRate / 100)).toFixed(2)));
        if (!vatRate && vatAmount > 0 && total > 0) {
          vatRate = Number(((vatAmount / total) * 100).toFixed(2));
        }
        return {
          product_id: item.product_id,
          product_name: item.product_name || '',
          product_code: item.product_code || '',
          product_image_url: item.product_image_url || item.image_url || '',
          barcode: item.barcode || '',
          image_url: item.image_url || '',
          quantity: qty,
          unit_price: price,
          total: total,
          vat_rate: vatRate,
          vat_amount: vatAmount,
          operation_id: item.operation_id || null,
          department_id: item.department_id || null,
          cost_center_id: item.cost_center_id || null
        };
      }));
      setIsModalOpen(true);

    } catch (error: any) {
      console.error('[EDIT] Error loading purchase return:', error);
      showNotification(language === 'ar' ? 'فشل تحميل بيانات المرتجع' : 'Failed to load return details', 'error');
    }
  };

  useEffect(() => {
    if (pendingViewDoc && pendingViewDoc.type === 'purchase_return' && user) {
      const loadPendingDoc = async () => {
        try {
          const existing = purchaseReturns.find(r => r.return_number === pendingViewDoc.idOrNumber || r.id === pendingViewDoc.idOrNumber);
          if (existing) {
            handleEdit(existing);
            setPendingViewDoc(null);
            return;
          }
          const docs = await dbService.getDocsByFilter<any>('purchase_returns', user.company_id, [
            { field: 'return_number', operator: '==', value: pendingViewDoc.idOrNumber }
          ]);
          if (docs && docs.length > 0) {
            handleEdit(docs[0]);
          } else {
            const docById = await dbService.get<any>('purchase_returns', pendingViewDoc.idOrNumber);
            if (docById) {
              handleEdit(docById);
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
  }, [pendingViewDoc, purchaseReturns, user, setPendingViewDoc]);

  const handleDelete = (id: string) => {
    setReturnToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!returnToDelete || !user) return;
    try {
      const ret = purchaseReturns.find(r => r.id === returnToDelete);
      await dbService.deleteJournalEntryByReference(returnToDelete, user.company_id);
      await dbService.delete('purchase_returns', returnToDelete);
      await dbService.logActivity(user.id, user.username, user.company_id, 'حذف مرتجع مشتريات', `حذف مرتجع مشتريات رقم: ${ret?.return_number}`, 'purchase_returns');
      showNotification(t('common.delete_success'), 'success');
      setIsDeleteModalOpen(false);
      setReturnToDelete(null);
    } catch (e: any) {
      console.error(e);
      showNotification(e.message || t('common.delete_error'), 'error');
    }
  };

  const handleViewReturn = async (id: string) => {
    const ret = purchaseReturns.find(r => r.id === id);
    if (ret) {
      setViewReturn(ret);
    }
  };

  const exportToPDF = async (ret: any) => {
    if (!ret) return;
    
    // If the view modal is currently open for this return, use its ref
    if (viewReturn && viewReturn.id === ret.id && returnRef.current) {
      try {
        await exportToPDFUtil(returnRef.current, {
          filename: `${ret.return_number}.pdf`,
          margin: 10,
          orientation: 'portrait',
          reportTitle: `مرتجع مشتريات رقم: ${ret.return_number}`
        });
      } catch (e) {
        console.error('PDF Export Error:', e);
        showNotification('حدث خطأ أثناء تصدير PDF', 'error');
      }
      return;
    }

    // Otherwise, trigger the offscreen container
    setPdfReturn(ret);
  };

  const handlePrint = () => {
    if (returnRef.current) {
      printElement(returnRef.current);
    }
  };

  const filteredReturns = purchaseReturns.filter(r => 
    r.return_number.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const applyAiData = (data: any) => {
    if (data.supplierName) {
      const supplier = suppliers.find(s => s.name.toLowerCase().includes(data.supplierName.toLowerCase()));
      if (supplier) setReturnData(prev => ({ ...prev, supplier_id: supplier.id }));
    }
    if (data.date) setReturnData(prev => ({ ...prev, date: data.date }));
    if (data.items) {
      const newItems = data.items.map((item: any) => {
        const product = products.find(p => p.name.toLowerCase().includes(item.productName.toLowerCase()));
        const price = item.price || product?.cost_price || 0;
        const total = (item.quantity || 1) * price;
        const vatRate = product?.vat_rate || 0;
        const vatAmount = isVatEnabled ? (total * vatRate) / 100 : 0;
        return {
          product_id: product?.id || '',
          product_name: product?.name || '',
          product_code: product?.code || '',
          product_image_url: product?.image_url || '',
          barcode: product?.barcode || '',
          image_url: product?.image_url || '',
          quantity: item.quantity || 1,
          unit_price: price,
          total: total,
          vat_rate: vatRate,
          vat_amount: vatAmount,
          operation_id: selectedOperationId || null,
          department_id: selectedDepartmentId || null,
          cost_center_id: selectedCostCenterId || null,
        };
      });
      setItems(newItems);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir={dir}>
      {!isModalOpen ? (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">{t('nav.purchase_returns')}</h2>
              <p className="text-zinc-505">{language === 'ar' ? 'إدارة الأصناف المرتجعة للموردين.' : 'Manage product returns to suppliers.'}</p>
              {serverSummary.total_amount !== undefined && (
                <div className="mt-2 flex items-center gap-4 text-sm">
                   <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100 font-bold">
                     {language === 'ar' ? 'إجمالي المرتجعات:' : 'Total Returns:'} {formatMoney(serverSummary.total_amount)} {t('common.currency')}
                   </span>
                </div>
              )}
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
                onPrint={() => printElement(tableRef.current, 'مرتجعات المشتريات')}
              />
              <button 
                onClick={openModal}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-200"
              >
                <Plus size={20} />
                إضافة مرتجع
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-zinc-50 flex items-center justify-between gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 text-zinc-400" size={18} />
                <input
                  type="text"
                  placeholder={language === 'ar' ? 'البحث عن مرتجعات...' : 'Search returns...'}
                  className="w-full pl-10 pr-4 py-2 bg-zinc-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-550 transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50 shadow-inner">
                <button
                  onClick={() => setView('table')}
                  className={`p-2 rounded-lg transition-all ${view === 'table' ? 'bg-white text-emerald-600 shadow-sm border border-slate-100/50' : 'text-zinc-500 hover:text-zinc-700'}`}
                  title={language === 'ar' ? 'عرض الجدول' : 'Table View'}
                >
                  <List size={18} />
                </button>
                <button
                  onClick={() => setView('card')}
                  className={`p-2 rounded-lg transition-all ${view === 'card' ? 'bg-white text-emerald-600 shadow-sm border border-slate-100/50' : 'text-zinc-500 hover:text-zinc-700'}`}
                  title={language === 'ar' ? 'عرض الكروت' : 'Card View'}
                >
                  <LayoutGrid size={18} />
                </button>
              </div>
            </div>

            {view === 'table' ? (
              <div ref={tableRef} id="purchase-returns-list-table" className="hidden md:block overflow-x-auto">
                <table className="w-full text-right">
                  <thead>
                    <tr className="bg-zinc-50/50 text-zinc-500 text-xs uppercase tracking-wider">
                      <th className="px-6 py-4 font-bold cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('return_number')}>
                        <div className="flex items-center gap-1">
                          رقم المرتجع
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                            {sortBy === 'return_number' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                          </span>
                        </div>
                      </th>
                      <th className="px-6 py-4 font-bold cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('supplier_name')}>
                        <div className="flex items-center gap-1">
                          المورد
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                            {sortBy === 'supplier_name' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                          </span>
                        </div>
                      </th>
                      <th className="px-6 py-4 font-bold cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('date')}>
                        <div className="flex items-center gap-1">
                          التاريخ
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                            {sortBy === 'date' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                          </span>
                        </div>
                      </th>
                      <th className="px-6 py-4 font-bold cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('payment_type')}>
                        <div className="flex items-center gap-1">
                          النوع
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                            {sortBy === 'payment_type' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                          </span>
                        </div>
                      </th>
                      <th className="px-6 py-4 font-bold cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('total_amount')}>
                        <div className="flex items-center gap-1">
                          المبلغ
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                            {sortBy === 'total_amount' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                          </span>
                        </div>
                      </th>
                      <th className={`px-6 py-4 font-bold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                        {language === 'ar' ? 'رقم القيد' : 'Journal Entry'}
                      </th>
                      <th className="px-6 py-4 font-bold text-left">{language === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {filteredReturns.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-zinc-400 italic">{language === 'ar' ? 'لا توجد مرتجعات مشتريات حالياً' : 'No purchase returns currently'}</td>
                      </tr>
                    ) : (
                      filteredReturns.map((ret) => (
                        <tr 
                          key={ret.id} 
                          className="hover:bg-zinc-50/50 transition-colors group cursor-pointer"
                          onClick={() => handleEdit(ret)}
                        >
                          <td className="px-6 py-4">
                            <span className="font-mono text-xs bg-red-50 px-2 py-1 rounded text-red-700 font-bold">{ret.return_number}</span>
                          </td>
                          <td className="px-6 py-4 font-bold text-zinc-900">{ret.supplier_name}</td>
                          <td className="px-6 py-4 text-zinc-500">{formatDate(ret.date)}</td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                              {ret.payment_type === 'cash' ? (language === 'ar' ? 'نقدي' : 'Cash') : (language === 'ar' ? 'آجل' : 'Credit')}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-bold text-zinc-900">{formatNumber(ret.total_amount)} {t('common.currency')}</td>
                          <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                            {ret.entry_number ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPendingViewDoc({ type: 'journal', idOrNumber: ret.entry_number! });
                                  setCurrentPage('journal_entries');
                                }}
                                className="text-emerald-600 hover:text-emerald-700 hover:underline font-mono text-xs font-bold bg-emerald-50 px-2 py-1 rounded border border-emerald-100/50 transition-all active:scale-95 animate-in fade-in"
                              >
                                {ret.entry_number}
                              </button>
                            ) : (
                              <span className="text-zinc-400 font-mono text-xs">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-left">
                            <div className="flex items-center justify-start gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActivityLogDocumentId(ret.id);
                                  setIsActivityLogOpen(true);
                                }}
                                className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all no-pdf"
                                title="سجل النشاط"
                              >
                                <History size={18} />
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewReturn(ret.id);
                                }}
                                className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all no-pdf"
                              >
                                <Eye size={18} />
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEdit(ret);
                                }}
                                className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all no-pdf"
                                title="تعديل"
                              >
                                <Edit size={18} />
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  exportToPDF(ret);
                                }}
                                className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all no-pdf"
                              >
                                <Download size={18} />
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(ret.id);
                                }}
                                className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all no-pdf"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                <PaginationControls page={page} limit={limit} total={totalRecords} onPageChange={setPage} onLimitChange={setLimit} />
              </div>
            ) : (
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredReturns.map((ret) => (
                  <div 
                    key={ret.id} 
                    onClick={() => handleEdit(ret)}
                    className="p-6 bg-zinc-50/50 rounded-3xl border border-zinc-100 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5 transition-all group relative overflow-hidden cursor-pointer flex flex-col justify-between"
                  >
                    <div className="absolute top-4 left-4 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewReturn(ret.id);
                        }}
                        className="p-2 bg-white text-emerald-500 rounded-xl border border-emerald-50 shadow-sm hover:bg-emerald-50 transition-all font-bold"
                      >
                        <Eye size={16} />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(ret);
                        }}
                        className="p-2 bg-white text-blue-500 rounded-xl border border-blue-50 shadow-sm hover:bg-blue-50 transition-all font-bold"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(ret.id);
                        }}
                        className="p-2 bg-white text-red-500 rounded-xl border border-red-50 shadow-sm hover:bg-red-50 transition-all font-bold"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    
                    <div className="flex flex-col h-full justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs bg-red-50 px-2 py-1 rounded text-red-700 font-bold">{ret.return_number}</span>
                            {ret.entry_number && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPendingViewDoc({ type: 'journal', idOrNumber: ret.entry_number! });
                                  setCurrentPage('journal_entries');
                                }}
                                className="font-mono text-[9px] bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded text-emerald-700 font-bold border border-emerald-100/50 transition-all active:scale-95 z-10"
                              >
                                {ret.entry_number}
                              </button>
                            )}
                          </div>
                          <span className="text-xs text-zinc-400 font-medium">{formatDate(ret.date)}</span>
                        </div>
                        <div>
                          <h4 className="font-bold text-zinc-900 group-hover:text-emerald-600 transition-colors">{ret.supplier_name}</h4>
                          <p className="text-xs text-zinc-400 mt-1">
                            {ret.payment_type === 'cash' ? 'نقدي' : 'آجل'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center justify-between">
                        <span className="text-zinc-500 text-xs font-bold">إجمالي المرتجع</span>
                        <span className="font-black text-emerald-600 text-lg">
                          {formatNumber(ret.total_amount)} ج.م
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredReturns.length === 0 && !loading && (
                  <div className="col-span-full py-12 text-center text-zinc-500 italic">لا توجد مرتجعات مشتريات حالياً</div>
                )}
                <div className="col-span-full">
                  <PaginationControls page={page} limit={limit} total={totalRecords} onPageChange={setPage} onLimitChange={setLimit} />
                </div>
              </div>
            )}

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-zinc-100">
              {filteredReturns.length === 0 ? (
                <div className="px-6 py-12 text-center text-zinc-400 italic">لا توجد مرتجعات مشتريات حالياً</div>
              ) : (
                filteredReturns.map((ret) => (
                  <div 
                    key={ret.id} 
                    onClick={() => handleEdit(ret)}
                    className="p-4 space-y-3 hover:bg-zinc-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-red-50 px-2 py-1 rounded text-red-700 font-bold">{ret.return_number}</span>
                        {ret.entry_number && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingViewDoc({ type: 'journal', idOrNumber: ret.entry_number! });
                              setCurrentPage('journal_entries');
                            }}
                            className="font-mono text-[9px] bg-emerald-50 px-2 py-1 rounded text-emerald-700 font-bold border border-emerald-100/50"
                          >
                            {ret.entry_number}
                          </button>
                        )}
                      </div>
                      <span className="text-xs text-zinc-500 flex items-center gap-1">
                        <Calendar size={12} />
                        {formatDate(ret.date)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-650 flex items-center justify-center">
                          <User size={14} />
                        </div>
                        <span className="font-bold text-zinc-900">{ret.supplier_name}</span>
                      </div>
                      <span className="font-bold text-red-650">{formatNumber(ret.total_amount)} ج.م</span>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => {
                          setActivityLogDocumentId(ret.id);
                          setIsActivityLogOpen(true);
                        }}
                        className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all"
                        title="سجل النشاط"
                      >
                        <History size={16} />
                      </button>
                      <button 
                        onClick={() => handleViewReturn(ret.id)}
                        className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"
                        title="عرض"
                      >
                        <Eye size={16} />
                      </button>
                      <button 
                        onClick={() => handleEdit(ret)}
                        className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                        title="تعديل"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(ret.id)}
                        className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        title="حذف"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      ) : (
        <div ref={editModalRef} className="bg-white rounded-3xl border border-zinc-200 shadow-md overflow-hidden animate-in slide-in-from-bottom-4 duration-300 flex flex-col min-h-[80vh] relative">
          {/* Form Header */}
          <div className="flex items-center justify-between p-2 md:p-3 border-b border-zinc-200 bg-zinc-50/50 backdrop-blur-md sticky top-0 z-[70] flex-row-reverse">
            <div className="flex items-center gap-2 flex-wrap">
              <button 
                type="button"
                onClick={closeModal}
                className="flex items-center gap-1 px-2 py-0.5 hover:bg-white rounded-xl transition-all text-zinc-650 text-[11px] font-black border border-transparent hover:border-zinc-200"
              >
                {dir === 'rtl' ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
                <span>{language === 'ar' ? 'العودة للقائمة' : 'Return to List'}</span>
              </button>
              {editingReturn && (
                <>
                  <button 
                    type="button"
                    onClick={async () => {
                      const newNum = await generateReturnNumber(returnData.date);
                      setReturnNumber(newNum);
                      setEditingReturn(null);
                      showNotification(language === 'ar' ? 'تم نسخ المرتجع كجديد' : 'Return copied as new template', 'success');
                    }} 
                    className="flex items-center gap-1 px-2 py-0.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-xl transition-all font-bold text-[11px] whitespace-nowrap border border-emerald-200 shadow-sm"
                  >
                    <Copy size={11} />
                    <span>{language === 'ar' ? 'نسخ' : 'Copy'}</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      if (editingReturn?.id) {
                        printDocument('purchase_returns', editingReturn.id);
                      } else if (editModalRef.current || returnRef.current) {
                        printElement(editModalRef.current || returnRef.current, 'مردود مشتريات');
                      } else {
                        window.print();
                      }
                    }} 
                    className="flex items-center gap-1 px-2 py-0.5 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all font-bold text-[11px] whitespace-nowrap border border-blue-200 shadow-sm"
                    title={language === 'ar' ? 'طباعة' : 'Print'}
                  >
                    <Printer size={11} />
                    <span>{language === 'ar' ? 'طباعة' : 'Print'}</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      if (editingReturn?.id) {
                        printDocument('purchase_returns', editingReturn.id);
                      } else if (editModalRef.current || returnRef.current) {
                        exportToPDFUtil(editModalRef.current || returnRef.current!, { filename: `Purchase_Return_${editingReturn.return_number}`, reportTitle: `مردود مشتريات ${editingReturn.return_number}` });
                      }
                    }} 
                    className="flex items-center gap-1 px-2 py-0.5 text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-all font-bold text-[11px] whitespace-nowrap border border-rose-200 shadow-sm"
                    title={language === 'ar' ? 'تصدير PDF' : 'Export PDF'}
                  >
                    <FileText size={11} />
                    <span>PDF</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      const sup = suppliers.find(s => s.id === (editingReturn?.supplier_id || returnData.supplier_id));
                      const rawItems = (editingReturn?.items && editingReturn.items.length > 0) ? editingReturn.items : items;
                      const calcSubtotal = editingReturn?.subtotal ?? rawItems.reduce((s: number, i: any) => s + (Number(i.quantity || 0) * Number(i.unit_price || i.cost_price || 0)), 0);
                      const calcVat = editingReturn?.vat_amount ?? rawItems.reduce((s: number, i: any) => s + Number(i.tax || i.vat_amount || 0), 0);
                      const calcTotal = editingReturn?.total_amount ?? (calcSubtotal + calcVat);

                      exportSingleDocumentToExcel({
                        filename: `Purchase_Return_${editingReturn?.return_number || returnNumber || 'Doc'}`,
                        sheetName: 'مردود مشتريات',
                        companyName: company?.name || localStorage.getItem('company_name') || 'نظام ERP السحابي',
                        companyAddress: company?.address || localStorage.getItem('company_address') || '',
                        companyPhone: company?.phone || localStorage.getItem('company_phone') || '',
                        companyEmail: company?.email || localStorage.getItem('company_email') || '',
                        companyTaxNumber: company?.tax_number || localStorage.getItem('company_tax') || '',
                        docTitle: 'مردود مشتريات',
                        docNumber: editingReturn?.return_number || returnNumber || 'جديد',
                        docDate: editingReturn?.date || returnData.date || new Date().toISOString().slice(0, 10),
                        partyTitle: 'المورد',
                        partyName: sup?.name || editingReturn?.supplier_name || 'مورد عام',
                        partyAddress: sup?.address || '',
                        partyPhone: (sup as any)?.phone || (sup as any)?.mobile || '',
                        partyTaxNumber: (sup as any)?.tax_number || (sup as any)?.vat_number || '',

                        notes: editingReturn?.notes || returnData.notes || description || '',
                        columns: [
                          { label: 'م', key: 'index' },
                          { label: 'اسم الصنف', key: 'product_name' },
                          { label: 'الكمية المرتجعة', key: 'quantity' },
                          { label: 'سعر التكلفة', key: 'unit_price' },
                          { label: 'الضريبة (14%)', key: 'tax' },
                          { label: 'الإجمالي', key: 'total' }
                        ],
                        items: rawItems.map((item: any) => ({
                          product_name: item.product_name || '-',
                          quantity: item.quantity || 0,
                          unit_price: item.unit_price || item.cost_price || 0,
                          tax: item.tax || item.vat_amount || 0,
                          total: item.total || 0
                        })),
                        summaryRows: [
                          { label: 'الإجمالي قبل الضريبة:', value: calcSubtotal },
                          { label: 'ضريبة القيمة المضافة (14%):', value: calcVat },
                          { label: 'الصافي النهائي:', value: calcTotal }
                        ]
                      });

                    }} 
                    className="flex items-center gap-1 px-2 py-0.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-all font-bold text-[11px] whitespace-nowrap border border-emerald-200 shadow-sm"
                    title={language === 'ar' ? 'تصدير Excel' : 'Export Excel'}
                  >
                    <FileSpreadsheet size={11} />
                    <span>Excel</span>
                  </button>

                </>
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
                form="purchase-return-form"
                onClick={handleSubmit}
                className="w-20 py-1 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all flex items-center gap-1 justify-center active:scale-95 shadow-sm text-[11px] whitespace-nowrap font-sans"
              >
                <Save size={12} />
                <span>{language === 'ar' ? 'حفظ' : 'Save'}</span>
              </button>
            </div>
          </div>

          {/* Left side (end in RTL) Document Info: Title, Return No, Linked Journal */}
          <div className="p-4 md:p-6 border-b border-zinc-100 bg-white flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex flex-col gap-1 items-start">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="text-sm md:text-base font-black text-zinc-900 tracking-tight leading-none font-sans">
                    {editingReturn ? (language === 'ar' ? 'تعديل مرتجع مشتريات' : 'Edit Purchase Return') : (language === 'ar' ? 'إنشاء مرتجع مشتريات جديد' : 'Create New Purchase Return')}
                  </h3>
                  <span className="text-[11px] font-mono font-black text-zinc-800 bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded-lg select-all shadow-sm">
                    {returnNumber}
                  </span>
                </div>

                {editingReturn?.entry_number ? (
                  <div className="flex items-center gap-1 text-emerald-750 text-[10px] font-bold font-mono leading-none mt-0.5">
                    <span className="text-emerald-500 font-sans font-bold">{language === 'ar' ? 'القيد المرتبط:' : 'Linked JE:'}</span>
                    <span className="bg-emerald-50 px-1 py-0.5 rounded border border-emerald-100/50 font-black">{editingReturn.entry_number}</span>
                  </div>
                ) : (
                  <div className="text-[9px] font-bold text-zinc-400 mt-0.5">
                    {language === 'ar' ? 'القيد المرتبط: لا يوجد قيد مرتبط بعد' : 'Linked JE: No journal entry linked yet'}
                  </div>
                )}
              </div>
            </div>

            {editingReturn && (
              <div className="flex items-center gap-2 bg-zinc-100 p-1 rounded-xl">
                <button 
                  type="button"
                  onClick={handlePrevReturn}
                  className="flex items-center gap-1 px-3 py-1 hover:bg-white rounded-lg transition-all text-zinc-650 disabled:opacity-30 text-xs font-black"
                  disabled={purchaseReturns.findIndex(r => r.id === editingReturn.id) === 0}
                >
                  {dir === 'rtl' ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                  {language === 'ar' ? 'السابق' : 'Prev'}
                </button>
                <button 
                  type="button"
                  onClick={handleNextReturn}
                  className="flex items-center gap-1 px-3 py-1 hover:bg-white rounded-lg transition-all text-zinc-650 disabled:opacity-30 text-xs font-black"
                  disabled={purchaseReturns.findIndex(r => r.id === editingReturn.id) === purchaseReturns.length - 1}
                >
                  {language === 'ar' ? 'التالي' : 'Next'}
                  {dir === 'rtl' ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
                </button>
              </div>
            )}
          </div>

          
          <div className="flex-1 overflow-y-auto flex flex-col h-full relative">
            <AnimatePresence>
              {showAiInput && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-zinc-50 border-b border-zinc-150 p-4 sticky top-[73px] z-[80] shadow-md flex flex-col gap-3"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 text-indigo-600 font-bold">
                      <Plus size={20} className="animate-pulse" />
                      <span className="text-sm font-black">{language === 'ar' ? 'الإنشاء الذكي بالذكاء الاصطناعي' : 'Smart AI Creation'}</span>
                    </div>
                    <button onClick={() => setShowAiInput(false)} className="p-2 text-zinc-400 hover:text-zinc-650 rounded-lg hover:bg-zinc-100 transition-all">
                      <X size={20} />
                    </button>
                  </div>
                  <SmartAIInput 
                    onDataExtracted={applyAiData}
                    transactionType="purchase_return"
                  />
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
              <Plus size={12} className="animate-bounce mb-1" />
              <span>{language === 'ar' ? 'الإنشاء الذكي بالذكاء الاصطناعي' : 'Smart AI Creation'}</span>
            </button>

            <form id="purchase-return-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 pb-32">
              {/* Upper Layout: Combined Totals Summary and Metadata Form into a single card */}
              <section className="bg-white p-3 rounded-2xl border border-zinc-200 shadow-sm grid grid-cols-1 lg:grid-cols-4 gap-4 items-stretch">
                
                {/* Right: Metadata Panel Column */}
                <div className="lg:col-span-3 space-y-3 relative flex flex-col justify-between">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {/* Date */}
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1 px-1 uppercase">{language === 'ar' ? 'التاريخ' : 'Date'}</label>
                      <input
                        required
                        type="date"
                        className="w-full px-3 py-1.5 rounded-xl bg-zinc-50 border border-zinc-200 focus:ring-1 focus:ring-emerald-500 outline-none font-bold text-zinc-800 text-xs"
                        value={returnData.date}
                        onChange={(e) => setReturnData({...returnData, date: e.target.value})}
                      />
                    </div>

                    {/* Supplier */}
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1 px-1 uppercase">{language === 'ar' ? 'المورد' : 'Supplier'}</label>
                      <select 
                        required
                        className="w-full px-3 py-1.5 rounded-xl bg-zinc-50 border border-zinc-200 focus:ring-1 focus:ring-emerald-500 outline-none font-bold text-zinc-800 text-xs cursor-pointer"
                        value={returnData.supplier_id}
                        onChange={(e) => {
                          if (e.target.value === 'new_supplier') {
                            setIsSupplierModalOpen(true);
                          } else {
                            setReturnData({...returnData, supplier_id: e.target.value});
                          }
                        }}
                      >
                        <option value="">{language === 'ar' ? 'اختر مورد...' : 'Select Supplier...'}</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        <option value="new_supplier" className="font-bold text-emerald-600 italic">+ {language === 'ar' ? 'إضافة مورد جديد' : 'Add Supplier'}</option>
                      </select>
                    </div>

                    {/* Warehouse */}
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1 px-1 uppercase">{language === 'ar' ? 'المخزن' : 'Warehouse'}</label>
                      <select 
                        required
                        className="w-full px-3 py-1.5 rounded-xl bg-zinc-50 border border-zinc-200 focus:ring-1 focus:ring-emerald-500 outline-none font-bold text-zinc-800 text-xs cursor-pointer"
                        value={returnData.warehouse_id}
                        onChange={(e) => setReturnData({...returnData, warehouse_id: e.target.value})}
                      >
                        <option value="">{language === 'ar' ? 'اختر المخزن' : 'Select Warehouse'}</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </div>

                    {/* Return Number */}
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1 px-1 uppercase">{language === 'ar' ? 'رقم المرتجع' : 'Return No.'}</label>
                      <input 
                        readOnly
                        type="text"
                        className="w-full px-3 py-1.5 bg-zinc-150 border border-zinc-200 rounded-xl font-bold text-zinc-700 text-xs outline-none"
                        value={returnNumber}
                      />
                    </div>

                    {/* Payment Type */}
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1 px-1 uppercase">{language === 'ar' ? 'طريقة الدفع' : 'Payment Type'}</label>
                      <select 
                        className="w-full px-3 py-1.5 rounded-xl bg-zinc-50 border border-zinc-200 focus:ring-1 focus:ring-emerald-500 outline-none font-bold text-zinc-800 text-xs cursor-pointer"
                        value={returnData.payment_type}
                        onChange={(e) => setReturnData({...returnData, payment_type: e.target.value as 'cash' | 'credit'})}
                      >
                        <option value="credit">{language === 'ar' ? 'آجل' : 'Credit'}</option>
                        <option value="cash">{language === 'ar' ? 'نقدي' : 'Cash'}</option>
                      </select>
                    </div>

                    {/* Payment Method */}
                    {returnData.payment_type === 'cash' ? (
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-400 mb-1 px-1 uppercase">{language === 'ar' ? 'طريقة استرداد المبلغ' : 'Refund Method'}</label>
                        <select 
                          required
                          className="w-full px-3 py-1.5 rounded-xl border border-zinc-200 bg-zinc-50 focus:ring-1 focus:ring-emerald-500 outline-none font-bold text-zinc-800 text-xs cursor-pointer"
                          value={returnData.payment_method_id}
                          onChange={(e) => {
                            if (e.target.value === 'new_payment_method') {
                              setIsPaymentMethodModalOpen(true);
                            } else {
                              setReturnData({...returnData, payment_method_id: e.target.value});
                            }
                          }}
                        >
                          <option value="">{language === 'ar' ? 'اختر الطريقة...' : 'Select Method...'}</option>
                          {paymentMethods.map(pm => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
                          <option value="new_payment_method" className="font-bold text-emerald-600 italic">+ {language === 'ar' ? 'إضافة طريقة' : 'Add Method'}</option>
                        </select>
                      </div>
                    ) : null}

                    {/* Currency & Exchange Rate */}
                    {isMultiCurrencyEnabled && (
                      <>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 mb-1 px-1 uppercase flex items-center gap-1">
                            <Coins size={12} className="text-amber-500" />
                            {language === 'ar' ? 'عملة المعاملة' : 'Transaction Currency'}
                          </label>
                          <select 
                            className="w-full px-3 py-1.5 rounded-xl border border-zinc-200 bg-zinc-50 focus:ring-1 focus:ring-emerald-500 outline-none font-bold text-zinc-800 text-xs cursor-pointer"
                            value={selectedCurrencyId}
                            onChange={(e) => handleCurrencyChange(e.target.value)}
                          >
                            {(() => {
                              const baseCode = (company?.settings?.currency || (company as any)?.currency || 'egp').toLowerCase();
                              const baseCurrInList = companyCurrencies.find(c => c.code.toLowerCase() === baseCode);
                              const baseCurrencyName = baseCurrInList 
                                ? (language === 'ar' ? baseCurrInList.name_ar : baseCurrInList.name_en) 
                                : (language === 'ar' ? 'العملة الأساسية' : 'Base Currency');
                              return (
                                <option value="">
                                  {`${baseCurrencyName} (${(company?.settings?.currency || (company as any)?.currency || 'EGP').toUpperCase()})`}
                                </option>
                              );
                            })()}
                            {companyCurrencies.filter(c => (c.is_active || c.id === selectedCurrencyId) && c.code.toLowerCase() !== (company?.settings?.currency || (company as any)?.currency || 'egp').toLowerCase()).map(curr => (
                              <option key={curr.id} value={curr.id}>
                                {language === 'ar' ? `${curr.name_ar} (${curr.code})` : `${curr.name_en} (${curr.code})`}
                              </option>
                            ))}
                          </select>
                        </div>

                        {(() => {
                          const selectedCurr = companyCurrencies.find(c => c.id === selectedCurrencyId);
                          const baseCurrency = company?.settings?.currency || 'EGP';
                          const isForeign = selectedCurr && selectedCurr.code.toLowerCase() !== baseCurrency.toLowerCase();
                          
                          if (!isForeign) return null;

                          return (
                            <div>
                              <label className="block text-[10px] font-bold text-zinc-400 mb-1 px-1 uppercase">
                                {language === 'ar' ? 'سعر الصرف' : 'Exchange Rate'}
                              </label>
                              <input
                                required
                                type="number"
                                step="any"
                                min={0.0001}
                                className="w-full px-3 py-1.5 rounded-xl border border-zinc-200 bg-zinc-50 focus:ring-1 focus:ring-emerald-500 outline-none font-bold text-zinc-850 text-xs"
                                value={exchangeRate}
                                onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1)}
                              />
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>

                  {/* Operation, Department, Cost Center apply to all row */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2 pt-2 border-t border-zinc-100">
                    {/* Operation */}
                    <div>
                      <label className="block text-[9px] font-bold text-zinc-400 mb-0 px-0.5">{language === 'ar' ? 'رقم عملية عام' : 'Global Operation'}</label>
                      <div className="flex items-center gap-1">
                        <div className="relative flex-1">
                          <input 
                            type="text" 
                            placeholder={language === 'ar' ? 'ابحث عن عملية...' : 'Search operation...'}
                            className="w-full px-2 py-1 rounded-lg bg-zinc-50 border border-zinc-200 focus:ring-1 focus:ring-emerald-500 outline-none font-bold text-zinc-800 text-[11px]"
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
                            >
                              <X size={10} />
                            </button>
                          )}
                        </div>
                        {selectedOperationId && (
                          <button
                            type="button"
                            onClick={() => applyOperationToAllItems()}
                            className="p-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded text-emerald-600 transition-colors flex-shrink-0"
                            title={language === 'ar' ? 'تطبيق على كافة الأصناف' : 'Apply to all items'}
                          >
                            <CheckCheck size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Department */}
                    <div>
                      <label className="block text-[9px] font-bold text-zinc-400 mb-0 px-0.5">{language === 'ar' ? 'الإدارة' : 'Department'}</label>
                      <div className="flex items-center gap-1">
                        <div className="relative flex-1">
                          <input 
                            type="text" 
                            placeholder={language === 'ar' ? 'ابحث عن إدارة...' : 'Search department...'}
                            className="w-full px-2 py-1 rounded-lg bg-zinc-50 border border-zinc-200 focus:ring-1 focus:ring-emerald-500 outline-none font-bold text-zinc-800 text-[11px]"
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
                            >
                              <X size={10} />
                            </button>
                          )}
                        </div>
                        {selectedDepartmentId && (
                          <button
                            type="button"
                            onClick={() => applyDepartmentToAllItems()}
                            className="p-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded text-emerald-600 transition-colors flex-shrink-0"
                            title={language === 'ar' ? 'تطبيق على كافة الأصناف' : 'Apply to all items'}
                          >
                            <CheckCheck size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Cost Center */}
                    <div>
                      <label className="block text-[9px] font-bold text-zinc-400 mb-0 px-0.5">{language === 'ar' ? 'مركز التكلفة' : 'Cost Center'}</label>
                      <div className="flex items-center gap-1">
                        <div className="relative flex-1">
                          <input 
                            type="text" 
                            placeholder={language === 'ar' ? 'ابحث عن مركز...' : 'Search cost center...'}
                            className="w-full px-2 py-1 rounded-lg bg-zinc-50 border border-zinc-200 focus:ring-1 focus:ring-emerald-500 outline-none font-bold text-zinc-800 text-[11px]"
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
                            >
                              <X size={10} />
                            </button>
                          )}
                        </div>
                        {selectedCostCenterId && (
                          <button
                            type="button"
                            onClick={() => applyCostCenterToAllItems()}
                            className="p-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded text-emerald-600 transition-colors flex-shrink-0"
                            title={language === 'ar' ? 'تطبيق على كافة الأصناف' : 'Apply to all items'}
                          >
                            <CheckCheck size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Subject / Description */}
                  <div className="pt-2 border-t border-zinc-100 mt-2">
                    <label className="block text-[9px] font-bold text-zinc-400 mb-0 px-0.5">{language === 'ar' ? 'موضوع المرتجع' : 'Return Subject'}</label>
                    <input
                      type="text"
                      className="w-full px-3 py-1 rounded-lg bg-zinc-50 border border-zinc-200 focus:ring-1 focus:ring-emerald-500 outline-none font-bold text-zinc-800 text-[11px] placeholder:text-zinc-300 font-sans"
                      placeholder={language === 'ar' ? 'أدخل وصفاً عاماً يظهر في أعلى المرتجع...' : 'Enter a general description...'}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                </div>

                {/* Left: Summary Column */}
                <div className="lg:col-span-1 flex flex-col justify-center space-y-1.5 p-1 lg:border-s lg:border-zinc-200 lg:ps-4">
                  <div className="flex items-center gap-1.5 mb-1 text-emerald-650">
                    <Layers className="w-4 h-4" />
                    <h2 className="font-semibold text-zinc-900 text-xs">{language === 'ar' ? 'ملخص المرتجع' : 'Return Summary'}</h2>
                  </div>

                  <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-100 space-y-1.5">
                    <div className="flex justify-between items-center text-zinc-650 text-xs">
                      <span className="font-medium">{language === 'ar' ? 'الإجمالي قبل الخصم' : 'Subtotal'}</span>
                      <span className="font-bold">
                        {formatMoney(items.reduce((sum, i) => sum + (Number(i.total) || 0), 0))}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-emerald-650 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">{language === 'ar' ? 'الخصم' : 'Discount'}</span>
                        <input 
                          type="number" 
                          className="w-16 bg-white border border-zinc-200 rounded-lg px-2 py-0.5 text-center font-bold text-emerald-605 focus:ring-1 focus:ring-emerald-500 outline-none text-xs"
                          value={discount}
                          onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <span className="font-bold">-{formatMoney(discount)}</span>
                    </div>
                    {isVatEnabled && (() => {
                      const calculatedVatAmount = items.reduce((sum, i) => {
                        const qty = Number(i.quantity) || 0;
                        const price = Number(i.unit_price) || 0;
                        const rate = Number(i.vat_rate) || 0;
                        const vAmount = (i.vat_amount !== undefined && i.vat_amount !== null && Number(i.vat_amount) > 0)
                          ? Number(i.vat_amount)
                          : (qty * price * (rate / 100));
                        return sum + vAmount;
                      }, 0);
                      return (
                        <div className="flex justify-between items-center text-zinc-650 text-xs pt-1 border-t border-dashed border-zinc-200">
                          <span className="font-medium">{language === 'ar' ? 'ضريبة القيمة المضافة' : 'VAT'}</span>
                          <span className="font-bold">
                            +{formatMoney(calculatedVatAmount)}
                          </span>
                        </div>
                      );
                    })()}
                    <div className="flex justify-between items-center text-emerald-650 text-xs pt-1.5 border-t border-zinc-200">
                      <span className="font-black text-sm">{language === 'ar' ? 'الصافي النهائي' : 'Net Total'}</span>
                      <div className="flex flex-col items-end">
                        <span className="font-black text-lg tracking-tighter">
                          {formatMoney(
                            items.reduce((sum, i) => sum + (Number(i.total) || 0), 0) + 
                            (isVatEnabled ? items.reduce((sum, i) => {
                              const qty = Number(i.quantity) || 0;
                              const price = Number(i.unit_price) || 0;
                              const rate = Number(i.vat_rate) || 0;
                              return sum + ((i.vat_amount !== undefined && i.vat_amount !== null && Number(i.vat_amount) > 0) ? Number(i.vat_amount) : (qty * price * (rate / 100)));
                            }, 0) : 0) - 
                            discount
                          )} {currentInvoiceCurrencyCode}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Items Section */}
              <section className="bg-white p-3 rounded-2xl border border-zinc-200 shadow-sm space-y-2">
                <div className="flex flex-row items-center justify-between gap-1.5 mb-1">
                  <div className="flex items-center gap-1.5 text-emerald-600">
                    <Package className="w-4 h-4" />
                    <h2 className="font-semibold text-zinc-900 text-xs">{language === 'ar' ? 'الأصناف المرتجعة' : 'Returned Items'}</h2>
                  </div>

                  <div className="flex gap-1.5">
                    {/* Barcode scanner buttons */}
                    {(barcodeSettings.enable_camera_scanner || barcodeSettings.enable_hid_scanner) && (
                      <>
                        <button
                          type="button"
                          onClick={() => { setBarcodeContinuousMode(false); setShowBarcodeScanner(true); }}
                          className="px-3 py-1 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition-all flex items-center gap-1 shadow-sm text-xs cursor-pointer"
                        >
                          <span>📷</span>
                          <span>{language === 'ar' ? 'باركود' : 'Scan'}</span>
                        </button>
                        {barcodeSettings.enable_continuous_mode && (
                          <button
                            type="button"
                            onClick={() => { setBarcodeContinuousMode(true); setShowBarcodeScanner(true); }}
                            className="px-3 py-1 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-all flex items-center gap-1 shadow-sm text-xs cursor-pointer"
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
                      className="px-3 py-1 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-all flex items-center gap-1 shadow-sm text-xs"
                    >
                      <Plus size={12} />
                      إضافة صف جديد
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-zinc-200 overflow-hidden">
                  <table className="w-full text-sm text-right border-collapse table-fixed min-w-[1150px]">
                    <thead>
                      <tr className="bg-zinc-100 border-b border-zinc-200 text-zinc-700 text-xs font-bold">
                        <th className="p-2 border-r border-zinc-200 text-right w-80 min-w-[320px]">اسم الصنف</th>
                        <th className="p-2 border-r border-zinc-200 text-center w-12">صورة</th>
                        <th className="p-2 border-r border-zinc-200 text-center w-24">باركود</th>
                        <th className="p-2 border-r border-zinc-200 text-center w-28">رقم عملية</th>
                        <th className="p-2 border-r border-zinc-200 text-center w-28">الإدارة</th>
                        <th className="p-2 border-r border-zinc-200 text-center w-28">مركز التكلفة</th>
                        <th className="p-2 border-r border-zinc-200 text-center w-16">الكمية</th>
                        <th className="p-2 border-r border-zinc-200 text-center w-24">السعر</th>
                        <th className="p-2 border-r border-zinc-200 text-center w-14">ض ق م %</th>
                        <th className="p-2 border-r border-zinc-200 text-center w-24">{language === 'ar' ? 'مبلغ الضريبة' : 'VAT Amount'}</th>
                        <th className="p-2 border-r border-zinc-200 text-center w-24">الإجمالي</th>
                        <th className="p-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {items.map((item, index) => (
                        <tr key={index} className="group hover:bg-zinc-50 transition-colors">
                          <td className="p-0.5 border-b border-r border-zinc-200 w-80 min-w-[320px]">
                            <div className="relative">
                              <select 
                                className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-white rounded px-2 py-1 outline-none font-bold text-zinc-800 appearance-none transition-all text-xs"
                                value={item.product_id}
                                onChange={(e) => {
                                  if (e.target.value === 'new_product') {
                                    setIsProductModalOpen(true);
                                  } else {
                                    updateItem(index, 'product_id', e.target.value);
                                  }
                                }}
                              >
                                <option value="">اختر الصنف...</option>
                                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                <option value="new_product" className="font-bold text-emerald-600 italic">+ إضافة صنف</option>
                              </select>
                              <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-2' : 'right-2'} top-2 w-3.5 h-3.5 text-zinc-400 pointer-events-none`} />
                            </div>
                          </td>
                          <td className="p-0.5 border-b border-r border-zinc-200 w-12 text-center">
                            <div className="flex justify-center items-center">
                              {item.image_url || item.product_image_url ? (
                                <div className="relative group w-8 h-8">
                                  <img src={item.image_url || item.product_image_url} alt="" className="w-full h-full object-cover rounded shadow-sm" referrerPolicy="no-referrer" />
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
                                className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-white rounded px-2 py-1 text-center font-bold text-xs text-zinc-800 outline-none transition-all font-mono"
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
                          
                          {/* Operation */}
                          <td className="p-0.5 border-b border-r border-zinc-200 w-28 text-center">
                            <div className="flex items-center gap-1 w-full relative">
                              <div className="relative flex-1">
                                <input 
                                  type="text" 
                                  placeholder={language === 'ar' ? 'ابحث...' : 'Search...'}
                                  className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-white rounded px-2 py-1 text-right font-bold text-xs text-zinc-800 outline-none transition-all"
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

                          {/* Department */}
                          <td className="p-0.5 border-b border-r border-zinc-200 w-28 text-center">
                            <div className="flex items-center gap-1 w-full relative">
                              <div className="relative flex-1">
                                <input 
                                  type="text" 
                                  placeholder={language === 'ar' ? 'ابحث...' : 'Search...'}
                                  className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-white rounded px-2 py-1 text-right font-bold text-xs text-zinc-800 outline-none transition-all"
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
                                  >
                                    <X size={10} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Cost Center */}
                          <td className="p-0.5 border-b border-r border-zinc-200 w-28 text-center">
                            <div className="flex items-center gap-1 w-full relative">
                              <div className="relative flex-1">
                                <input 
                                  type="text" 
                                  placeholder={language === 'ar' ? 'ابحث...' : 'Search...'}
                                  className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-white rounded px-2 py-1 text-right font-bold text-xs text-zinc-800 outline-none transition-all"
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
                              className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-white rounded px-2 py-1 text-center font-black text-zinc-900 outline-none transition-all text-xs"
                              value={item.quantity !== undefined && item.quantity !== null ? Number(item.quantity) : ''}
                              onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                            />
                          </td>
                          <td className="p-0.5 border-b border-r border-zinc-200 w-24">
                            <input 
                              type="text" 
                              className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-white rounded px-2 py-1 text-center font-bold text-zinc-800 outline-none transition-all text-xs font-mono"
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
                              <td className="p-0.5 border-b border-r border-zinc-200 w-14">
                                <div className="flex items-center justify-center gap-0.5">
                                  <input 
                                    type="number" 
                                    min={0}
                                    max={100}
                                    className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-white rounded px-1 py-0.5 text-center font-black text-zinc-900 outline-none transition-all text-xs"
                                    value={item.vat_rate !== undefined && item.vat_rate !== null ? Number(item.vat_rate) : 0}
                                    onChange={(e) => updateItem(index, 'vat_rate', parseFloat(e.target.value) || 0)}
                                  />
                                  <span className="text-sm text-zinc-900 font-black">%</span>
                                </div>
                              </td>
                              <td className="p-0.5 border-b border-r border-zinc-200 w-24 text-center font-bold text-amber-700 text-xs">
                                {formatMoney(
                                  (item.vat_amount !== undefined && item.vat_amount !== null && Number(item.vat_amount) > 0)
                                    ? Number(item.vat_amount)
                                    : ((Number(item.quantity) || 0) * (Number(item.unit_price) || 0) * ((Number(item.vat_rate) || 0) / 100))
                                )}
                              </td>
                          <td className="p-0.5 border-b border-r border-zinc-200 w-24 text-center font-bold text-emerald-600 text-xs">
                            {formatMoney(item.total)}
                          </td>
                          <td className="p-0.5 border-b border-zinc-200 w-10 text-center">
                            <button 
                              type="button"
                              onClick={() => removeItem(index)}
                              className="p-1 text-zinc-300 hover:text-red-505 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {items.length === 0 && (
                        <tr>
                          <td colSpan={12} className="px-3 py-6 text-center text-zinc-400 italic text-xs">
                            لا توجد أصناف حالياً
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

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
                            <tr className="bg-zinc-100 border-b border-zinc-200 text-zinc-650 font-bold text-[10px] sticky top-0 z-10">
                              <th className="p-2 text-right">رقم العملية</th>
                              <th className="p-2 text-right">العميل</th>
                              <th className="p-2 text-right">التفاصيل</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100">
                            {filtered.map(op => (
                              <tr 
                                key={op.id} 
                                onClick={() => {
                                  if (activeSearch.index === -1) {
                                    setSelectedOperationId(op.id);
                                    if (op.department_id) setSelectedDepartmentId(op.department_id);
                                    if (op.cost_center_id) setSelectedCostCenterId(op.cost_center_id);
                                  } else {
                                    updateItem(activeSearch.index, 'operation_id', op.id);
                                  }
                                  setActiveSearch(null);
                                }}
                                className="hover:bg-emerald-50 cursor-pointer transition-colors"
                              >
                                <td className="p-2 font-bold text-zinc-900">{op.operation_number || 'N/A'}</td>
                                <td className="p-2 text-zinc-600 font-bold">{op.customer_name || '-'}</td>
                                <td className="p-2 text-zinc-500 truncate max-w-[120px]">{op.description || '-'}</td>
                              </tr>
                            ))}
                            {filtered.length === 0 && (
                              <tr>
                                <td colSpan={3} className="p-4 text-center text-zinc-400 italic">لا توجد نتائج</td>
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
                            <tr className="bg-zinc-100 border-b border-zinc-200 text-zinc-650 font-bold text-[10px] sticky top-0 z-10">
                              <th className="p-2 text-right">الكود</th>
                              <th className="p-2 text-right">الاسم</th>
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
                              </tr>
                            ))}
                            {filtered.length === 0 && (
                              <tr>
                                <td colSpan={2} className="p-4 text-center text-zinc-400 italic">لا توجد نتائج</td>
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
                            <tr className="bg-zinc-100 border-b border-zinc-200 text-zinc-650 font-bold text-[10px] sticky top-0 z-10">
                              <th className="p-2 text-right">الكود</th>
                              <th className="p-2 text-right">الاسم</th>
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
                              </tr>
                            ))}
                            {filtered.length === 0 && (
                              <tr>
                                <td colSpan={2} className="p-4 text-center text-zinc-400 italic">لا توجد نتائج</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      );
                    })()}
                  </div>
                </>
              )}

              {/* Inline Bottom Panel for Activity Log and Journal Entry */}
              {showSidePanel && (
                <div className="mt-6 border border-zinc-200 rounded-2xl overflow-hidden bg-white shadow-sm flex flex-col w-full">
                  <div 
                    onClick={() => setIsPanelExpanded(!isPanelExpanded)}
                    className="p-3 border-b border-zinc-150 flex items-center justify-between bg-zinc-55 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3">
                      <button 
                        type="button"
                        className="w-7 h-7 rounded-full bg-slate-200/70 flex items-center justify-center transition-all shadow-sm"
                      >
                        {isPanelExpanded ? <ChevronDown size={16} className="text-slate-650" /> : <ChevronUp size={16} className="text-slate-655" />}
                      </button>
                      <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                        <History size={16} className="text-emerald-600 animate-pulse" />
                        <span>{language === 'ar' ? 'سجل التعديلات والقيد' : 'Activity Log & Journal'}</span>
                      </h3>
                    </div>
                    <button 
                      type="button" 
                      onClick={(e) => { e.stopPropagation(); setShowSidePanel(false); }} 
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-all"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isPanelExpanded ? 'max-h-[1200px] border-t border-zinc-200' : 'max-h-0'}`}>
                    {(() => {
                      const activeCurrency = companyCurrencies.find(c => c.id === (editingReturn?.currency_id || selectedCurrencyId));
                      const currencyCode = activeCurrency ? activeCurrency.code : (company?.settings?.currency || (company as any)?.currency || 'EGP');
                      const exchangeRateVal = editingReturn ? (editingReturn.exchange_rate || 1) : (Number(exchangeRate) || 1);
                      
                      return (
                        <TransactionSidePanel 
                          documentId={editingReturn?.id || ''} 
                          category="purchase_returns" 
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
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-55"
                  >
                    <History size={14} />
                    <span>{language === 'ar' ? 'عرض سجل التعديلات والقيد' : 'Show Activity Log & Journal'}</span>
                  </button>
                </div>
              )}

              {/* Form Footer */}
              <div className="p-4 md:p-6 border-t border-slate-100 bg-white/80 backdrop-blur-md sticky bottom-0 z-[70] flex items-center justify-between gap-4 mt-auto">
                <button 
                  type="button"
                  onClick={closeModal}
                  className="flex-1 max-w-[200px] py-4 rounded-2xl bg-zinc-100 text-zinc-650 font-black hover:bg-zinc-200 transition-all flex items-center justify-center gap-3 active:scale-95"
                >
                  <RotateCcw size={20} />
                  {t('common.cancel')}
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting || items.length === 0 || returnData.supplier_id === ''}
                  className="flex-1 py-4 rounded-2xl bg-emerald-600 text-white font-black hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save size={20} />
                  )}
                  {editingReturn ? t('common.save') : (language === 'ar' ? 'حفظ المرتجع' : 'Save Return')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Return Modal */}
      {viewReturn && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center md:p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white w-full max-w-6xl md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 min-h-screen md:min-h-0 my-auto flex flex-col md:max-h-[90vh] border border-zinc-200">
            <div className="p-6 border-b border-zinc-105 flex items-center justify-between bg-zinc-55 sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-zinc-900">تفاصيل مرتجع المشتريات: {viewReturn.return_number}</h3>
                <button 
                  onClick={() => {
                    setActivityLogDocumentId(viewReturn.id);
                    setIsActivityLogOpen(true);
                  }}
                  className="p-2 text-zinc-505 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all"
                  title="سجل النشاط"
                >
                  <History size={20} />
                </button>
              </div>
              <button onClick={() => setViewReturn(null)} className="text-zinc-400 hover:text-zinc-650 p-2 hover:bg-zinc-100 rounded-full transition-all">
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row h-full">
              {/* Side Panel for Activity Log and Journal Entry */}
              <div className="hidden lg:block w-80 border-r border-slate-100 bg-slate-50/30">
                <InlineActivityLog category="purchase_returns" documentId={viewReturn.id} />
              </div>

              {/* Printable container Isolated */}
              <div ref={returnRef} id="purchase-return-capture-area" className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 bg-white" style={{ backgroundColor: '#ffffff', color: '#18181b' }}>
                <CompanyInvoiceHeader 
                  company={company} 
                  documentNumber={viewReturn.return_number}
                  documentDate={formatDate(viewReturn.date)}
                  title="مرتجع مشتريات"
                />

                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1" style={{ color: '#71717a' }}>المورد</p>
                    <p className="text-lg font-bold text-zinc-900" style={{ color: '#18181b' }}>{viewReturn.supplier_name}</p>
                    {(() => {
                      const supp = suppliers.find((s: any) => s.id === viewReturn.supplier_id || s.name === viewReturn.supplier_name);
                      const suppTax = (viewReturn as any).supplier_tax_number || (viewReturn as any).tax_number || (viewReturn as any).partyTaxNumber || supp?.tax_number || (supp as any)?.vat_number;
                      if (!suppTax) return null;
                      return (
                        <p className="text-xs text-slate-600 font-bold mt-1">
                          {language === 'ar' ? 'الرقم الضريبي:' : 'Tax Number:'} <span className="text-slate-900 font-bold font-mono">{suppTax}</span>
                        </p>
                      );
                    })()}
                    {viewReturn.warehouse_id && (
                      <p className="text-xs text-slate-505 font-medium mt-1">
                        {language === 'ar' ? 'المخزن:' : 'Warehouse:'} <span className="text-emerald-600 font-bold">{warehouses.find((w: any) => w.id?.toString() === viewReturn.warehouse_id?.toString())?.name || viewReturn.warehouse_id}</span>
                      </p>
                    )}
                    {viewReturn.entry_number && (
                      <p className="text-xs text-slate-505 font-medium mt-1">
                        {language === 'ar' ? 'رقم القيد:' : 'Journal Entry:'} <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewReturn(null);
                            setPendingViewDoc({ type: 'journal', idOrNumber: viewReturn.entry_number! });
                            setCurrentPage('journal_entries');
                          }}
                          className="text-emerald-650 hover:text-emerald-700 hover:underline font-mono font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100/50"
                        >
                          {viewReturn.entry_number}
                        </button>
                      </p>
                    )}
                    {viewReturn.currency_id && (
                      <p className="text-xs text-slate-505 font-medium mt-1">
                        {language === 'ar' ? 'العملة:' : 'Currency:'}{' '}
                        <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100/50 font-mono">
                          {companyCurrencies.find(c => c.id === viewReturn.currency_id)?.code || viewReturn.currency_id}
                        </span>
                        {viewReturn.exchange_rate && Number(viewReturn.exchange_rate) !== 1 && (
                          <span className="text-zinc-505 text-[10px] ml-2 mr-2 font-bold bg-zinc-50 px-2 py-0.5 rounded border border-zinc-200">
                            {language === 'ar' ? 'سعر الصرف:' : 'Exchange Rate:'} {viewReturn.exchange_rate}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1" style={{ color: '#71717a' }}>التاريخ</p>
                    <p className="text-lg font-bold text-zinc-900" style={{ color: '#18181b' }}>{formatDate(viewReturn.date)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1" style={{ color: '#71717a' }}>نوع المرتجع</p>
                    <p className="text-lg font-bold text-zinc-900" style={{ color: '#18181b' }}>{viewReturn.payment_type === 'cash' ? 'نقدي' : 'آجل'}</p>
                  </div>
                  {viewReturn.payment_type === 'cash' && (
                    <div className="text-left">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1" style={{ color: '#71717a' }}>طريقة الدفع</p>
                      <p className="text-lg font-bold text-zinc-900" style={{ color: '#18181b' }}>{viewReturn.payment_method_name}</p>
                    </div>
                  )}
                </div>

                {viewReturn.description && (
                  <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">الوصف</p>
                    <p className="text-zinc-700 whitespace-pre-wrap">{viewReturn.description}</p>
                  </div>
                )}

                <div className="border border-zinc-100 rounded-2xl overflow-hidden" style={{ borderColor: '#f4f4f5' }}>
                  <table className="w-full text-right text-sm border-collapse">
                    <thead className="bg-zinc-50 text-zinc-500 uppercase text-[10px] font-bold tracking-wider" style={{ backgroundColor: '#fafafa' }}>
                      <tr>
                        <th className="px-4 py-3 w-16 text-center" style={{ color: '#71717a' }}>صورة</th>
                        <th className="px-4 py-3" style={{ color: '#71717a' }}>الصنف</th>
                        <th className="px-4 py-3 text-center" style={{ color: '#71717a' }}>العملية</th>
                        <th className="px-4 py-3 text-center" style={{ color: '#71717a' }}>الإدارة</th>
                        <th className="px-4 py-3 text-center" style={{ color: '#71717a' }}>مركز التكلفة</th>
                        <th className="px-4 py-3 text-center" style={{ color: '#71717a' }}>الكمية</th>
                        <th className="px-4 py-3 hidden md:table-cell" style={{ color: '#71717a' }}>السعر</th>
                        <th className="px-4 py-3" style={{ color: '#71717a' }}>الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50" style={{ borderColor: '#fafafa' }}>
                      {viewReturn.items?.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td className="px-4 py-4 text-center">
                            {item.product_image_url || item.image_url ? (
                              <img 
                                src={item.product_image_url || item.image_url} 
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
                          <td className="px-4 py-4 font-bold text-zinc-900" style={{ color: '#18181b' }}>{item.product_name}</td>
                          <td className="px-4 py-4 text-center text-zinc-500 font-mono text-xs">{operations.find(o => o.id === item.operation_id)?.operation_number || '-'}</td>
                          <td className="px-4 py-4 text-center text-zinc-500 text-xs">{departments.find(d => d.id === item.department_id)?.name || '-'}</td>
                          <td className="px-4 py-4 text-center text-zinc-500 text-xs">{costCenters.find(c => c.id === item.cost_center_id)?.name || '-'}</td>
                          <td className="px-4 py-4 text-center text-zinc-550" style={{ color: '#71717a' }}>{item.quantity}</td>
                          <td className="px-4 py-4 text-zinc-505 hidden md:table-cell" style={{ color: '#71717a' }}>{formatNumber(item.unit_price || item.price)}</td>
                          <td className="px-4 py-4 font-bold text-zinc-900" style={{ color: '#18181b' }}>{formatNumber(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50/50 font-bold border-t border-slate-100">
                      {(() => {
                        const currencyCode = viewReturn.currency_id ? (companyCurrencies.find(c => c.id === viewReturn.currency_id)?.code || '') : (company?.settings?.currency || '');
                        return (
                          <>
                            <tr>
                              <td colSpan={7} className={`px-6 py-2 ${dir === 'rtl' ? 'text-left' : 'text-right'} text-slate-400 font-bold text-[10px] uppercase tracking-wider`}>الإجمالي قبل الخصم</td>
                              <td className="px-6 py-2 text-slate-900 text-base">{formatMoney(viewReturn.subtotal || viewReturn.items?.reduce((sum: number, i: any) => sum + (Number(i.total) || 0), 0) || 0)} {currencyCode}</td>
                            </tr>
                            {Number(viewReturn.discount_amount || viewReturn.discount || 0) > 0 && (
                              <tr>
                                <td colSpan={7} className={`px-6 py-2 ${dir === 'rtl' ? 'text-left' : 'text-right'} text-red-400 font-bold text-[10px] uppercase tracking-wider`}>الخصم</td>
                                <td className="px-6 py-2 text-red-650 text-base">-{formatMoney(viewReturn.discount_amount || viewReturn.discount)} {currencyCode}</td>
                              </tr>
                            )}
                            {(Number(viewReturn.tax_amount || viewReturn.tax || 0) > 0 || (viewReturn.items || []).some((i: any) => Number(i.vat_amount || 0) > 0)) && (
                              <tr>
                                <td colSpan={7} className={`px-6 py-2 ${dir === 'rtl' ? 'text-left' : 'text-right'} text-zinc-650 font-bold text-[10px] uppercase tracking-wider`}>ضريبة القيمة المضافة</td>
                                <td className="px-6 py-2 text-zinc-700 text-base">+{formatMoney(viewReturn.tax_amount || viewReturn.tax || viewReturn.items?.reduce((sum: number, i: any) => sum + (Number(i.vat_amount) || 0), 0))} {currencyCode}</td>
                              </tr>
                            )}
                            <tr className="bg-slate-900 text-white font-bold">
                              <td colSpan={7} className={`px-6 py-4 ${dir === 'rtl' ? 'text-left' : 'text-right'} font-black text-lg uppercase tracking-tight`}>الصافي الإجمالي</td>
                              <td className="px-6 py-4 text-2xl font-black text-emerald-400">{formatNumber(viewReturn.total_amount)} {currencyCode}</td>
                            </tr>
                          </>
                        );
                      })()}
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal footer / actions (outside returnRef print container) */}
            <div className="p-4 md:p-6 border-t border-zinc-150 flex items-center justify-between bg-zinc-50/50">
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    if (viewReturn) {
                      printDocument('purchase_returns', viewReturn.id);
                    }
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-white text-zinc-700 border border-zinc-200 rounded-2xl font-bold hover:bg-zinc-50 transition-all active:scale-95 shadow-sm text-xs"
                >
                  <Printer size={18} />
                  {language === 'ar' ? 'طباعة ونموذج' : 'Print & Template'}
                </button>
                <button 
                  onClick={() => {
                    if (viewReturn) {
                      printDocument('purchase_returns', viewReturn.id);
                    }
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-white text-zinc-700 border border-zinc-200 rounded-2xl font-bold hover:bg-zinc-50 transition-all active:scale-95 shadow-sm text-xs"
                >
                  <Download size={18} />
                  تصدير بالنموذج
                </button>
              </div>
              <button 
                onClick={() => setViewReturn(null)}
                className="px-8 py-3 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all active:scale-95 shadow-lg shadow-zinc-200 text-xs"
              >
                {language === 'ar' ? 'إغلاق' : 'Close'}
              </button>
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
              <button onClick={() => setIsSupplierModalOpen(false)} className="text-zinc-400 hover:text-zinc-650 p-2 hover:bg-zinc-100 rounded-xl transition-all"><X size={24} /></button>
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              <form onSubmit={handleSupplierSubmit} className="p-4 md:p-8 space-y-5 flex-1 overflow-y-auto pb-32 md:pb-8">
                <div className="space-y-5">
                  <div>
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
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">رقم الهاتف</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <input
                        required
                        type="tel"
                        pattern="[0-9]{11,}"
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-left"
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
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-left"
                        value={supplierFormData.email}
                        onChange={(e) => setSupplierFormData({ ...supplierFormData, email: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">العنوان</label>
                    <textarea
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
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
                          className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          value={supplierFormData.opening_balance}
                          onChange={(e) => setSupplierFormData({ ...supplierFormData, opening_balance: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-zinc-705 mb-1 uppercase tracking-tighter">تاريخ الرصيد</label>
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
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-705 mb-1 uppercase tracking-tighter">الحساب المحاسبي</label>
                    <select
                      required
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={supplierFormData.account_id}
                      onChange={(e) => setSupplierFormData({ ...supplierFormData, account_id: e.target.value })}
                    >
                      <option value="">اختر الحساب...</option>
                      {accounts.filter(a => a.account_usage === "accounts_payable" || a.account_usage === "supplier").map(account => (
                        <option key={account.id} value={account.id}>
                          {account.code} - {account.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {supplierFormData.opening_balance !== 0 && (
                    <div className="animate-in slide-in-from-top-2 duration-200">
                      <label className="block text-sm font-bold text-zinc-705 mb-1 uppercase tracking-tighter">حساب مقابل رصيد أول المدة</label>
                      <select
                        required
                        className="w-full px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={supplierFormData.counter_account_id}
                        onChange={(e) => setSupplierFormData({ ...supplierFormData, counter_account_id: e.target.value })}
                      >
                        <option value="">اختر الحساب المقابل...</option>
                        {accounts.filter(a => ["opening_balance", "capital", "equity", "retained_earnings", "other"].includes(a.account_usage || "")).map(account => (
                          <option key={account.id} value={account.id}>
                            {account.code} - {account.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-emerald-650 mt-1 font-medium font-sans">يستخدم هذا الحساب لإنشاء قيد رصيد أول المدة (مثلاً: رأس المال أو الأرباح المرحلة)</p>
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
                    className="px-8 py-4 bg-zinc-100 text-zinc-650 rounded-2xl font-bold hover:bg-zinc-200 transition-all active:scale-95"
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
          <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-2xl md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-4 md:p-6 border-b border-zinc-50 flex items-center justify-between bg-white z-10">
              <h3 className="text-lg md:text-xl font-bold text-zinc-900">إضافة صنف جديد</h3>
              <button onClick={() => setIsProductModalOpen(false)} className="text-zinc-400 hover:text-zinc-650 p-2 hover:bg-zinc-100 rounded-xl transition-all"><X size={24} /></button>
            </div>
            <form onSubmit={handleProductSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="p-4 md:p-6 space-y-4 flex-1 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-zinc-705 mb-1 uppercase tracking-tighter">اسم الصنف</label>
                    <input
                      required
                      type="text"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={productFormData.name}
                      onChange={(e) => setProductFormData({ ...productFormData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-705 mb-1 uppercase tracking-tighter">الكود (SKU)</label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-550 outline-none transition-all"
                      value={productFormData.code}
                      onChange={(e) => setProductFormData({ ...productFormData, code: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-705 mb-1 uppercase tracking-tighter">التصنيف</label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-550 outline-none transition-all"
                      value={productFormData.category}
                      onChange={(e) => setProductFormData({ ...productFormData, category: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-705 mb-1 uppercase tracking-tighter">الوحدة</label>
                    <select
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-550 outline-none transition-all cursor-pointer"
                      value={productFormData.unit}
                      onChange={(e) => setProductFormData({ ...productFormData, unit: e.target.value })}
                    >
                      <option value="قطعة">قطعة</option>
                      <option value="كيلو">كيلو</option>
                      <option value="متر">متر</option>
                      <option value="لتر">لتر</option>
                      <option value="علبة">علبة</option>
                      <option value="كرتونة">كرتونة</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-705 mb-1 uppercase tracking-tighter">سعر الشراء</label>
                    <input
                      required
                      type="number"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={productFormData.cost_price}
                      onChange={(e) => setProductFormData({ ...productFormData, cost_price: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-705 mb-1 uppercase tracking-tighter">سعر البيع</label>
                    <input
                      required
                      type="number"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={productFormData.sale_price}
                      onChange={(e) => setProductFormData({ ...productFormData, sale_price: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-705 mb-1 uppercase tracking-tighter">الكمية الحالية</label>
                    <input
                      type="number"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={productFormData.stock}
                      onChange={(e) => setProductFormData({ ...productFormData, stock: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-705 mb-1 uppercase tracking-tighter">حد الطلب</label>
                    <input
                      type="number"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={productFormData.min_stock}
                      onChange={(e) => setProductFormData({ ...productFormData, min_stock: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
              <div className="p-4 md:p-6 border-t border-zinc-50 bg-zinc-50/50 flex gap-3 sticky bottom-0">
                <button 
                  type="submit"
                  className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                >
                  حفظ الصنف
                </button>
                <button 
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-8 py-4 bg-zinc-200 text-zinc-700 rounded-2xl font-bold hover:bg-zinc-300 transition-all active:scale-95"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Payment Method Modal */}
      {isPaymentMethodModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full h-full md:h-auto md:max-w-md md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-4 md:p-6 border-b border-zinc-50 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg md:text-xl font-bold text-zinc-900">إضافة طريقة دفع جديدة</h3>
              <button onClick={() => setIsPaymentMethodModalOpen(false)} className="text-zinc-400 hover:text-zinc-650 p-2 hover:bg-zinc-100 rounded-xl transition-all"><X size={24} /></button>
            </div>
            <form onSubmit={handlePaymentMethodSubmit} className="p-4 md:p-6 space-y-4 flex-1 overflow-y-auto pb-32 md:pb-6">
              <div>
                <label className="block text-sm font-bold text-zinc-705 mb-1 uppercase tracking-tighter">اسم الطريقة (خزينة/بنك)</label>
                <input
                  required
                  type="text"
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-555 outline-none transition-all"
                  value={paymentMethodFormData.name}
                  onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-705 mb-1 uppercase tracking-tighter">النوع</label>
                <select
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-555 outline-none transition-all cursor-pointer"
                  value={paymentMethodFormData.type}
                  onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, type: e.target.value as 'cash' | 'bank' })}
                >
                  <option value="cash">خزينة نقدي</option>
                  <option value="bank">حساب بنكي</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-705 mb-1 uppercase tracking-tighter">رقم الحساب (اختياري)</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-555 outline-none transition-all"
                  value={paymentMethodFormData.account_number}
                  onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, account_number: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-705 mb-1 uppercase tracking-tighter">رصيد أول</label>
                <input
                  type="number"
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-555 outline-none transition-all"
                  value={paymentMethodFormData.opening_balance}
                  onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, opening_balance: Number(e.target.value) })}
                />
              </div>
              <div className="pt-4 pb-8 md:pb-0">
                <button 
                  type="submit"
                  className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-650 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                >
                  حفظ طريقة الدفع
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-zinc-900 mb-4">تأكيد الحذف</h3>
            <p className="text-zinc-505 mb-6">هل أنت متأكد من رغبتك في حذف هذا المرتجع؟ لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setReturnToDelete(null);
                }}
                className="flex-1 py-3 bg-zinc-100 text-zinc-650 rounded-xl font-bold hover:bg-zinc-200 transition-all"
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

      {/* Offscreen PDF printable container Isolated */}
      {pdfReturn && (
        <div className="absolute left-[-9999px] top-[-9999px] w-[1024px] bg-white text-right" style={{ direction: 'rtl' }}>
          <div ref={pdfReturnRef} id="purchase-return-pdf-capture" className="p-8 space-y-8 bg-white" style={{ backgroundColor: '#ffffff', color: '#18181b' }}>
            <CompanyInvoiceHeader 
              company={company} 
              documentNumber={pdfReturn.return_number}
              documentDate={formatDate(pdfReturn.date)}
              title="مرتجع مشتريات"
            />

            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1" style={{ color: '#71717a' }}>المورد</p>
                <p className="text-lg font-bold text-zinc-900" style={{ color: '#18181b' }}>{pdfReturn.supplier_name}</p>
                {pdfReturn.warehouse_id && (
                  <p className="text-xs text-slate-505 font-medium mt-1">
                    {language === 'ar' ? 'المخزن:' : 'Warehouse:'} <span className="text-emerald-600 font-bold">{warehouses.find((w: any) => w.id?.toString() === pdfReturn.warehouse_id?.toString())?.name || pdfReturn.warehouse_id}</span>
                  </p>
                )}
                {pdfReturn.entry_number && (
                  <p className="text-xs text-slate-505 font-medium mt-1">
                    {language === 'ar' ? 'رقم القيد:' : 'Journal Entry:'} <span className="text-emerald-700 font-mono font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100/50">{pdfReturn.entry_number}</span>
                  </p>
                )}
                {pdfReturn.currency_id && (
                  <p className="text-xs text-slate-505 font-medium mt-1">
                    {language === 'ar' ? 'العملة:' : 'Currency:'}{' '}
                    <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100/50 font-mono">
                      {companyCurrencies.find(c => c.id === pdfReturn.currency_id)?.code || pdfReturn.currency_id}
                    </span>
                    {pdfReturn.exchange_rate && Number(pdfReturn.exchange_rate) !== 1 && (
                      <span className="text-zinc-505 text-[10px] ml-2 mr-2 font-bold bg-zinc-50 px-2 py-0.5 rounded border border-zinc-200">
                        {language === 'ar' ? 'سعر الصرف:' : 'Exchange Rate:'} {pdfReturn.exchange_rate}
                      </span>
                    )}
                  </p>
                )}
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1" style={{ color: '#71717a' }}>التاريخ</p>
                <p className="text-lg font-bold text-zinc-900" style={{ color: '#18181b' }}>{formatDate(pdfReturn.date)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1" style={{ color: '#71717a' }}>نوع المرتجع</p>
                <p className="text-lg font-bold text-zinc-900" style={{ color: '#18181b' }}>{pdfReturn.payment_type === 'cash' ? 'نقدي' : 'آجل'}</p>
              </div>
              {pdfReturn.payment_type === 'cash' && (
                <div className="text-left">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1" style={{ color: '#71717a' }}>طريقة الدفع</p>
                  <p className="text-lg font-bold text-zinc-900" style={{ color: '#18181b' }}>{pdfReturn.payment_method_name}</p>
                </div>
              )}
            </div>

            {pdfReturn.description && (
              <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">الوصف</p>
                <p className="text-zinc-700 whitespace-pre-wrap">{pdfReturn.description}</p>
              </div>
            )}

            <div className="border border-zinc-100 rounded-2xl overflow-hidden" style={{ borderColor: '#f4f4f5' }}>
              <table className="w-full text-right text-sm border-collapse">
                <thead className="bg-zinc-55 text-zinc-500 uppercase text-[10px] font-bold tracking-wider" style={{ backgroundColor: '#fafafa' }}>
                  <tr>
                    <th className="px-4 py-3 w-16 text-center" style={{ color: '#71717a' }}>صورة</th>
                    <th className="px-4 py-3" style={{ color: '#71717a' }}>الصنف</th>
                    <th className="px-4 py-3 text-center" style={{ color: '#71717a' }}>العملية</th>
                    <th className="px-4 py-3 text-center" style={{ color: '#71717a' }}>الإدارة</th>
                    <th className="px-4 py-3 text-center" style={{ color: '#71717a' }}>مركز التكلفة</th>
                    <th className="px-4 py-3 text-center" style={{ color: '#71717a' }}>الكمية</th>
                    <th className="px-4 py-3 text-right" style={{ color: '#71717a' }}>السعر</th>
                    <th className="px-4 py-3" style={{ color: '#71717a' }}>الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50" style={{ borderColor: '#fafafa' }}>
                  {pdfReturn.items?.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td className="px-4 py-4 text-center">
                        {item.product_image_url || item.image_url ? (
                          <img 
                            src={item.product_image_url || item.image_url} 
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
                      <td className="px-4 py-4 font-bold text-zinc-900" style={{ color: '#18181b' }}>{item.product_name}</td>
                      <td className="px-4 py-4 text-center text-zinc-550 font-mono text-xs">{operations.find(o => o.id === item.operation_id)?.operation_number || '-'}</td>
                      <td className="px-4 py-4 text-center text-zinc-550 text-xs">{departments.find(d => d.id === item.department_id)?.name || '-'}</td>
                      <td className="px-4 py-4 text-center text-zinc-550 text-xs">{costCenters.find(c => c.id === item.cost_center_id)?.name || '-'}</td>
                      <td className="px-4 py-4 text-center text-zinc-550" style={{ color: '#71717a' }}>{item.quantity}</td>
                      <td className="px-4 py-4 text-zinc-505 text-right" style={{ color: '#71717a' }}>{formatNumber(item.unit_price || item.price)}</td>
                      <td className="px-4 py-4 font-bold text-zinc-900 text-right" style={{ color: '#18181b' }}>{formatNumber(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50/50 font-bold border-t border-slate-100">
                  {(() => {
                    const currencyCode = pdfReturn.currency_id ? (companyCurrencies.find(c => c.id === pdfReturn.currency_id)?.code || '') : (company?.settings?.currency || '');
                    return (
                      <>
                        <tr>
                          <td colSpan={7} className={`px-6 py-2 ${dir === 'rtl' ? 'text-left' : 'text-right'} text-slate-400 font-bold text-[10px] uppercase tracking-wider`}>الإجمالي قبل الخصم</td>
                          <td className="px-6 py-2 text-slate-900 text-base">{formatMoney(pdfReturn.subtotal || pdfReturn.items?.reduce((sum: number, i: any) => sum + (Number(i.total) || 0), 0) || 0)} {currencyCode}</td>
                        </tr>
                        {Number(pdfReturn.discount_amount || pdfReturn.discount || 0) > 0 && (
                          <tr>
                            <td colSpan={7} className={`px-6 py-2 ${dir === 'rtl' ? 'text-left' : 'text-right'} text-red-400 font-bold text-[10px] uppercase tracking-wider`}>الخصم</td>
                            <td className="px-6 py-2 text-red-650 text-base">-{formatMoney(pdfReturn.discount_amount || pdfReturn.discount)} {currencyCode}</td>
                          </tr>
                        )}
                        {Number(pdfReturn.tax_amount || 0) > 0 && (
                          <tr>
                            <td colSpan={7} className={`px-6 py-2 ${dir === 'rtl' ? 'text-left' : 'text-right'} text-zinc-650 font-bold text-[10px] uppercase tracking-wider`}>ضريبة القيمة المضافة</td>
                            <td className="px-6 py-2 text-zinc-700 text-base">+{formatMoney(pdfReturn.tax_amount)} {currencyCode}</td>
                          </tr>
                        )}
                        <tr className="bg-slate-900 text-white font-bold">
                          <td colSpan={7} className={`px-6 py-4 ${dir === 'rtl' ? 'text-left' : 'text-right'} font-black text-lg uppercase tracking-tight`}>الصافي الإجمالي</td>
                          <td className="px-6 py-4 text-2xl font-black text-emerald-400">{formatNumber(pdfReturn.total_amount)} {currencyCode}</td>
                        </tr>
                      </>
                    );
                  })()}
                </tfoot>
              </table>
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
        category="purchase_returns"
        documentId={activityLogDocumentId}
      />

      {/* Barcode Scanner Modal */}
      {showBarcodeScanner && (
        <BarcodeScanner
          products={products}
          continuousMode={barcodeContinuousMode}
          settings={barcodeSettings}
          language={language}
          onProductFound={(product) => addItemByBarcode(product)}
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
