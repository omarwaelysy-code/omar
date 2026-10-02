import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, SlidersHorizontal, Calendar, RotateCcw, Eye, ExternalLink, 
  RefreshCw, ChevronDown, CheckSquare, Square, X, Layers, FileText, 
  DollarSign, ArrowDownLeft, ArrowUpRight, Check, Users, Building2,
  Filter, CheckCircle2, Clock, AlertCircle, Equal, Hash
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { dbService } from '../services/dbService';
import { formatMoney, formatDate } from '../utils/formatUtils';
import { ExportButtons } from '../components/ExportButtons';
import { exportToExcel } from '../utils/excelUtils';
import { exportToPDF as exportToPDFUtil, printElement } from '../utils/pdfUtils';

export interface UnifiedMovement {
  id: string;
  doc_id: string;
  doc_number: string;
  doc_type: string;
  doc_type_label_ar: string;
  doc_type_label_en: string;
  date: string;
  party_type: 'customer' | 'supplier' | 'account' | 'other';
  party_id?: string;
  party_name: string;
  debit: number;
  credit: number;
  amount: number;
  remaining_amount: number;
  currency: string;
  foreign_amount?: number;
  exchange_rate?: number;
  payment_status: 'paid' | 'unpaid' | 'partial' | 'pending' | 'na';
  payment_type?: string;
  entry_number?: string;
  notes?: string;
  nav_page: string;
  badge_color: string;
  raw_data?: any;
}

export const TransactionsSearch: React.FC = () => {
  const { t, dir, language } = useLanguage();
  const { user } = useAuth();
  const { openTab, closeTab, setCurrentPage, setPendingViewDoc } = useNavigation();
  const isAr = language === 'ar';

  const tableRef = useRef<HTMLDivElement>(null);

  // Raw data from DB
  const [loading, setLoading] = useState(true);
  const [refreshIndex, setRefreshIndex] = useState(0);

  const [invoices, setInvoices] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [salesOrders, setSalesOrders] = useState<any[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<any[]>([]);
  const [purchaseReturns, setPurchaseReturns] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [journalEntries, setJournalEntries] = useState<any[]>([]);
  const [receivedCheques, setReceivedCheques] = useState<any[]>([]);
  const [issuedCheques, setIssuedCheques] = useState<any[]>([]);
  const [customerDiscounts, setCustomerDiscounts] = useState<any[]>([]);
  const [supplierDiscounts, setSupplierDiscounts] = useState<any[]>([]);

  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);

  // Filters State
  const [filterSearchType, setFilterSearchType] = useState<string>('number');
  const [filterDocNumbers, setFilterDocNumbers] = useState<string>('');
  const [searchExactMatch, setSearchExactMatch] = useState<boolean>(false); // يساوى exact match
  const [filterFromDate, setFilterFromDate] = useState<string>('');
  const [filterToDate, setFilterToDate] = useState<string>('');
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [filterCurrencies, setFilterCurrencies] = useState<string[]>([]);

  // Additional Filters
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);

  const [filterMinAmount, setFilterMinAmount] = useState<string>('');
  const [filterMaxAmount, setFilterMaxAmount] = useState<string>('');
  const [filterExactAmount, setFilterExactAmount] = useState<string>(''); // المبلغ يساوى
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<string>('all');
  const [filterPaymentType, setFilterPaymentType] = useState<string>('all');
  const [filterJeStatus, setFilterJeStatus] = useState<string>('all');

  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);

  // Load data
  useEffect(() => {
    if (!user?.company_id) return;
    setLoading(true);

    const companyId = user.company_id;

    Promise.all([
      dbService.list<any>('invoices', { company_id: companyId }).catch(() => []),
      dbService.list<any>('returns', { company_id: companyId }).catch(() => []),
      dbService.list<any>('sales_orders', { company_id: companyId }).catch(() => []),
      dbService.list<any>('purchase_invoices', { company_id: companyId }).catch(() => []),
      dbService.list<any>('purchase_returns', { company_id: companyId }).catch(() => []),
      dbService.list<any>('purchase_orders', { company_id: companyId }).catch(() => []),
      dbService.list<any>('receipt_vouchers', { company_id: companyId }).catch(() => []),
      dbService.list<any>('payment_vouchers', { company_id: companyId }).catch(() => []),
      dbService.list<any>('journal_entries', { company_id: companyId }).catch(() => []),
      dbService.list<any>('received_cheques', { company_id: companyId }).catch(() => []),
      dbService.list<any>('issued_cheques', { company_id: companyId }).catch(() => []),
      dbService.list<any>('customer_discounts', { company_id: companyId }).catch(() => []),
      dbService.list<any>('supplier_discounts', { company_id: companyId }).catch(() => []),
      dbService.list<any>('customers', { company_id: companyId }).catch(() => []),
      dbService.list<any>('suppliers', { company_id: companyId }).catch(() => []),
      dbService.list<any>('currencies', { company_id: companyId }).catch(() => []),
      dbService.get<any>('companies', companyId).catch(() => null),
    ]).then(([
      invData, retData, soData, piData, prData, poData, rcData, pvData,
      jeData, rcChqData, isChqData, cdData, sdData, custData, suppData, currData, compData
    ]) => {
      setInvoices(invData || []);
      setReturns(retData || []);
      setSalesOrders(soData || []);
      setPurchaseInvoices(piData || []);
      setPurchaseReturns(prData || []);
      setPurchaseOrders(poData || []);
      setReceipts(rcData || []);
      setPayments(pvData || []);
      setJournalEntries(jeData || []);
      setReceivedCheques(rcChqData || []);
      setIssuedCheques(isChqData || []);
      setCustomerDiscounts(cdData || []);
      setSupplierDiscounts(sdData || []);
      setCustomers(custData || []);
      setSuppliers(suppData || []);
      setCurrencies(currData || []);
      if (compData) setCompany(compData);
      setLoading(false);
    }).catch(err => {
      console.error('Error fetching transactions for search engine:', err);
      setLoading(false);
    });
  }, [user?.company_id, refreshIndex]);

  const systemCurrency = useMemo(() => {
    return (company?.settings?.currency || company?.currency || 'EGP').toUpperCase();
  }, [company]);

  const customerMap = useMemo(() => {
    const map = new Map<string, any>();
    customers.forEach(c => map.set(c.id, c));
    return map;
  }, [customers]);

  const supplierMap = useMemo(() => {
    const map = new Map<string, any>();
    suppliers.forEach(s => map.set(s.id, s));
    return map;
  }, [suppliers]);

  // Master List of Movement Types
  const movementTypeOptions = useMemo(() => [
    { key: 'invoices', labelAr: 'فواتير مبيعات', labelEn: 'Sales Invoices', badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { key: 'returns', labelAr: 'مردودات مبيعات', labelEn: 'Sales Returns', badgeColor: 'bg-rose-50 text-rose-700 border-rose-200' },
    { key: 'sales_orders', labelAr: 'أوامر بيع', labelEn: 'Sales Orders', badgeColor: 'bg-teal-50 text-teal-700 border-teal-200' },
    { key: 'purchase_invoices', labelAr: 'فواتير مشتريات', labelEn: 'Purchase Invoices', badgeColor: 'bg-blue-50 text-blue-700 border-blue-200' },
    { key: 'purchase_returns', labelAr: 'مردودات مشتريات', labelEn: 'Purchase Returns', badgeColor: 'bg-orange-50 text-orange-700 border-orange-200' },
    { key: 'purchase_orders', labelAr: 'أوامر شراء', labelEn: 'Purchase Orders', badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
    { key: 'receipts', labelAr: 'سندات قبض', labelEn: 'Receipt Vouchers', badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    { key: 'payments', labelAr: 'سندات صرف', labelEn: 'Payment Vouchers', badgeColor: 'bg-amber-50 text-amber-700 border-amber-200' },
    { key: 'journal_entries', labelAr: 'قيود يومية', labelEn: 'Journal Entries', badgeColor: 'bg-purple-50 text-purple-700 border-purple-200' },
    { key: 'cheques', labelAr: 'شيكات بنكية', labelEn: 'Bank Cheques', badgeColor: 'bg-sky-50 text-sky-700 border-sky-200' },
    { key: 'discounts', labelAr: 'إشعارات وخصومات', labelEn: 'Discounts & Notes', badgeColor: 'bg-zinc-100 text-zinc-700 border-zinc-200' },
  ], []);

  // Available Currencies
  const availableCurrencies = useMemo(() => {
    const set = new Set<string>();
    set.add(systemCurrency);
    currencies.forEach(c => {
      if (c.code) set.add(c.code.toUpperCase());
    });
    return Array.from(set);
  }, [systemCurrency, currencies]);

  // Normalize all transactions into unified list
  const allMovements = useMemo<UnifiedMovement[]>(() => {
    const list: UnifiedMovement[] = [];

    // 1. Invoices
    invoices.forEach(inv => {
      const remaining = Number(inv.remaining_amount ?? (Number(inv.total_amount || 0) - Number(inv.paid_amount || 0)));
      const total = Number(inv.total_amount || 0);
      const paymentStatus: UnifiedMovement['payment_status'] = 
        remaining <= 0.01 ? 'paid' : remaining < total ? 'partial' : 'unpaid';

      list.push({
        id: `inv-${inv.id}`,
        doc_id: inv.id,
        doc_number: inv.invoice_number || `INV-${inv.id.slice(0, 6)}`,
        doc_type: 'invoices',
        doc_type_label_ar: 'فاتورة مبيعات',
        doc_type_label_en: 'Sales Invoice',
        date: inv.date || '',
        party_type: 'customer',
        party_id: inv.customer_id,
        party_name: inv.customer_name || customerMap.get(inv.customer_id)?.name || '-',
        debit: total,
        credit: 0,
        amount: total,
        remaining_amount: Math.max(0, remaining),
        currency: (inv.currency || systemCurrency).toUpperCase(),
        foreign_amount: Number(inv.foreign_amount) || undefined,
        exchange_rate: Number(inv.exchange_rate) || 1,
        payment_status: paymentStatus,
        payment_type: inv.payment_type || 'credit',
        entry_number: inv.entry_number,
        notes: inv.description || inv.notes || '',
        nav_page: 'invoices',
        badge_color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        raw_data: inv,
      });
    });

    // 2. Returns
    returns.forEach(ret => {
      const total = Number(ret.total_amount || 0);
      list.push({
        id: `ret-${ret.id}`,
        doc_id: ret.id,
        doc_number: ret.return_number || `RET-${ret.id.slice(0, 6)}`,
        doc_type: 'returns',
        doc_type_label_ar: 'مردود مبيعات',
        doc_type_label_en: 'Sales Return',
        date: ret.date || '',
        party_type: 'customer',
        party_id: ret.customer_id,
        party_name: ret.customer_name || customerMap.get(ret.customer_id)?.name || '-',
        debit: 0,
        credit: total,
        amount: total,
        remaining_amount: 0,
        currency: (ret.currency || systemCurrency).toUpperCase(),
        payment_status: 'paid',
        payment_type: ret.payment_type || 'credit',
        entry_number: ret.entry_number,
        notes: ret.description || ret.notes || '',
        nav_page: 'returns',
        badge_color: 'bg-rose-50 text-rose-700 border-rose-200',
        raw_data: ret,
      });
    });

    // 3. Sales Orders
    salesOrders.forEach(so => {
      const total = Number(so.total_amount || 0);
      list.push({
        id: `so-${so.id}`,
        doc_id: so.id,
        doc_number: so.order_number || so.number || `SO-${so.id.slice(0, 6)}`,
        doc_type: 'sales_orders',
        doc_type_label_ar: 'أمر بيع',
        doc_type_label_en: 'Sales Order',
        date: so.date || so.order_date || '',
        party_type: 'customer',
        party_id: so.customer_id,
        party_name: so.customer_name || customerMap.get(so.customer_id)?.name || '-',
        debit: total,
        credit: 0,
        amount: total,
        remaining_amount: total,
        currency: (so.currency || systemCurrency).toUpperCase(),
        payment_status: 'pending',
        payment_type: 'credit',
        entry_number: undefined,
        notes: so.notes || so.description || '',
        nav_page: 'sales_orders',
        badge_color: 'bg-teal-50 text-teal-700 border-teal-200',
        raw_data: so,
      });
    });

    // 4. Purchase Invoices
    purchaseInvoices.forEach(pi => {
      const remaining = Number(pi.remaining_amount ?? (Number(pi.total_amount || 0) - Number(pi.paid_amount || 0)));
      const total = Number(pi.total_amount || 0);
      const paymentStatus: UnifiedMovement['payment_status'] = 
        remaining <= 0.01 ? 'paid' : remaining < total ? 'partial' : 'unpaid';

      list.push({
        id: `pi-${pi.id}`,
        doc_id: pi.id,
        doc_number: pi.invoice_number || `PINV-${pi.id.slice(0, 6)}`,
        doc_type: 'purchase_invoices',
        doc_type_label_ar: 'فاتورة مشتريات',
        doc_type_label_en: 'Purchase Invoice',
        date: pi.date || '',
        party_type: 'supplier',
        party_id: pi.supplier_id,
        party_name: pi.supplier_name || supplierMap.get(pi.supplier_id)?.name || '-',
        debit: 0,
        credit: total,
        amount: total,
        remaining_amount: Math.max(0, remaining),
        currency: (pi.currency || systemCurrency).toUpperCase(),
        foreign_amount: Number(pi.foreign_amount) || undefined,
        exchange_rate: Number(pi.exchange_rate) || 1,
        payment_status: paymentStatus,
        payment_type: pi.payment_type || 'credit',
        entry_number: pi.entry_number,
        notes: pi.description || pi.notes || '',
        nav_page: 'purchase_invoices',
        badge_color: 'bg-blue-50 text-blue-700 border-blue-200',
        raw_data: pi,
      });
    });

    // 5. Purchase Returns
    purchaseReturns.forEach(pr => {
      const total = Number(pr.total_amount || 0);
      list.push({
        id: `pr-${pr.id}`,
        doc_id: pr.id,
        doc_number: pr.return_number || `PRET-${pr.id.slice(0, 6)}`,
        doc_type: 'purchase_returns',
        doc_type_label_ar: 'مردود مشتريات',
        doc_type_label_en: 'Purchase Return',
        date: pr.date || '',
        party_type: 'supplier',
        party_id: pr.supplier_id,
        party_name: pr.supplier_name || supplierMap.get(pr.supplier_id)?.name || '-',
        debit: total,
        credit: 0,
        amount: total,
        remaining_amount: 0,
        currency: (pr.currency || systemCurrency).toUpperCase(),
        payment_status: 'paid',
        payment_type: pr.payment_type || 'credit',
        entry_number: pr.entry_number,
        notes: pr.description || pr.notes || '',
        nav_page: 'purchase_returns',
        badge_color: 'bg-orange-50 text-orange-700 border-orange-200',
        raw_data: pr,
      });
    });

    // 6. Purchase Orders
    purchaseOrders.forEach(po => {
      const total = Number(po.total_amount || 0);
      list.push({
        id: `po-${po.id}`,
        doc_id: po.id,
        doc_number: po.order_number || po.number || `PO-${po.id.slice(0, 6)}`,
        doc_type: 'purchase_orders',
        doc_type_label_ar: 'أمر شراء',
        doc_type_label_en: 'Purchase Order',
        date: po.date || po.order_date || '',
        party_type: 'supplier',
        party_id: po.supplier_id,
        party_name: po.supplier_name || supplierMap.get(po.supplier_id)?.name || '-',
        debit: 0,
        credit: total,
        amount: total,
        remaining_amount: total,
        currency: (po.currency || systemCurrency).toUpperCase(),
        payment_status: 'pending',
        payment_type: 'credit',
        entry_number: undefined,
        notes: po.notes || po.description || '',
        nav_page: 'purchase_orders',
        badge_color: 'bg-cyan-50 text-cyan-700 border-cyan-200',
        raw_data: po,
      });
    });

    // 7. Receipts
    receipts.forEach(rc => {
      const amount = Number(rc.amount || 0);
      list.push({
        id: `rc-${rc.id}`,
        doc_id: rc.id,
        doc_number: rc.voucher_number || rc.number || `RC-${rc.id.slice(0, 6)}`,
        doc_type: 'receipts',
        doc_type_label_ar: 'سند قبض',
        doc_type_label_en: 'Receipt Voucher',
        date: rc.date || '',
        party_type: 'customer',
        party_id: rc.customer_id,
        party_name: rc.customer_name || rc.received_from || customerMap.get(rc.customer_id)?.name || '-',
        debit: 0,
        credit: amount,
        amount: amount,
        remaining_amount: 0,
        currency: (rc.currency || systemCurrency).toUpperCase(),
        payment_status: 'paid',
        payment_type: rc.payment_method || 'cash',
        entry_number: rc.entry_number,
        notes: rc.description || rc.notes || '',
        nav_page: 'receipts',
        badge_color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        raw_data: rc,
      });
    });

    // 8. Payment Vouchers
    payments.forEach(pv => {
      const amount = Number(pv.amount || 0);
      list.push({
        id: `pv-${pv.id}`,
        doc_id: pv.id,
        doc_number: pv.voucher_number || pv.number || `PV-${pv.id.slice(0, 6)}`,
        doc_type: 'payments',
        doc_type_label_ar: 'سند صرف',
        doc_type_label_en: 'Payment Voucher',
        date: pv.date || '',
        party_type: 'supplier',
        party_id: pv.supplier_id,
        party_name: pv.supplier_name || pv.paid_to || supplierMap.get(pv.supplier_id)?.name || '-',
        debit: amount,
        credit: 0,
        amount: amount,
        remaining_amount: 0,
        currency: (pv.currency || systemCurrency).toUpperCase(),
        payment_status: 'paid',
        payment_type: pv.payment_method || 'cash',
        entry_number: pv.entry_number,
        notes: pv.description || pv.notes || '',
        nav_page: 'payment_vouchers',
        badge_color: 'bg-amber-50 text-amber-700 border-amber-200',
        raw_data: pv,
      });
    });

    // 9. Journal Entries
    journalEntries.forEach(je => {
      const totalDebit = (je.items || []).reduce((sum: number, it: any) => sum + (Number(it.debit) || 0), 0);
      list.push({
        id: `je-${je.id}`,
        doc_id: je.id,
        doc_number: je.entry_number || `JE-${je.id.slice(0, 6)}`,
        doc_type: 'journal_entries',
        doc_type_label_ar: 'قيد يومية',
        doc_type_label_en: 'Journal Entry',
        date: je.date || '',
        party_type: 'account',
        party_name: je.description || (isAr ? 'قيد محاسبي' : 'Journal Entry'),
        debit: totalDebit,
        credit: totalDebit,
        amount: totalDebit,
        remaining_amount: 0,
        currency: systemCurrency,
        payment_status: 'paid',
        payment_type: 'general',
        entry_number: je.entry_number,
        notes: je.description || je.notes || '',
        nav_page: 'journal_entries',
        badge_color: 'bg-purple-50 text-purple-700 border-purple-200',
        raw_data: je,
      });
    });

    // 10. Cheques
    [...receivedCheques, ...issuedCheques].forEach(chq => {
      const amount = Number(chq.amount || 0);
      const isReceived = chq.type === 'received' || chq.recipient_type === 'customer';
      list.push({
        id: `chq-${chq.id}`,
        doc_id: chq.id,
        doc_number: chq.cheque_number || `CHQ-${chq.id.slice(0, 6)}`,
        doc_type: 'cheques',
        doc_type_label_ar: isReceived ? 'شيك وارد' : 'شيك صادر',
        doc_type_label_en: isReceived ? 'Received Cheque' : 'Issued Cheque',
        date: chq.due_date || chq.date || '',
        party_type: isReceived ? 'customer' : 'supplier',
        party_name: chq.payee || chq.drawer || chq.customer_name || chq.supplier_name || '-',
        debit: isReceived ? 0 : amount,
        credit: isReceived ? amount : 0,
        amount: amount,
        remaining_amount: 0,
        currency: (chq.currency || systemCurrency).toUpperCase(),
        payment_status: chq.status === 'cleared' || chq.status === 'paid' ? 'paid' : 'pending',
        payment_type: 'cheque',
        entry_number: chq.entry_number,
        notes: chq.notes || chq.bank_name || '',
        nav_page: isReceived ? 'received_cheques' : 'issued_cheques',
        badge_color: 'bg-sky-50 text-sky-700 border-sky-200',
        raw_data: chq,
      });
    });

    // 11. Discounts
    [...customerDiscounts, ...supplierDiscounts].forEach(disc => {
      const amount = Number(disc.amount || 0);
      const isCustomer = disc.type === 'customer' || disc.customer_id;
      list.push({
        id: `disc-${disc.id}`,
        doc_id: disc.id,
        doc_number: disc.discount_number || disc.number || `DISC-${disc.id.slice(0, 6)}`,
        doc_type: 'discounts',
        doc_type_label_ar: isCustomer ? 'إشعار/خصم عميل' : 'إشعار/خصم مورد',
        doc_type_label_en: isCustomer ? 'Customer Discount' : 'Supplier Discount',
        date: disc.date || '',
        party_type: isCustomer ? 'customer' : 'supplier',
        party_id: disc.customer_id || disc.supplier_id,
        party_name: disc.customer_name || disc.supplier_name || '-',
        debit: isCustomer ? 0 : amount,
        credit: isCustomer ? amount : 0,
        amount: amount,
        remaining_amount: 0,
        currency: (disc.currency || systemCurrency).toUpperCase(),
        payment_status: 'paid',
        payment_type: 'discount',
        entry_number: disc.entry_number,
        notes: disc.reason || disc.notes || '',
        nav_page: isCustomer ? 'customer_discounts' : 'supplier_discounts',
        badge_color: 'bg-zinc-100 text-zinc-700 border-zinc-200',
        raw_data: disc,
      });
    });

    return list.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }, [
    invoices, returns, salesOrders, purchaseInvoices, purchaseReturns, purchaseOrders,
    receipts, payments, journalEntries, receivedCheques, issuedCheques, customerDiscounts,
    supplierDiscounts, customerMap, supplierMap, systemCurrency, isAr
  ]);

  // Bulk input parsed tokens
  const parsedBulkSearchTokens = useMemo(() => {
    if (!filterDocNumbers.trim()) return [];
    return filterDocNumbers
      .split(/[\n,;\s]+/)
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
  }, [filterDocNumbers]);

  // Filtered movements
  const filteredMovements = useMemo(() => {
    return allMovements.filter(m => {
      // 1. Bulk Search Filter
      if (parsedBulkSearchTokens.length > 0) {
        let matchFieldVal = '';
        if (filterSearchType === 'number') matchFieldVal = m.doc_number.toLowerCase();
        else if (filterSearchType === 'foreign_amount') matchFieldVal = (m.foreign_amount?.toString() || '');
        else if (filterSearchType === 'currency') matchFieldVal = m.currency.toLowerCase();
        else if (filterSearchType === 'je_number') matchFieldVal = (m.entry_number || '').toLowerCase();
        else if (filterSearchType === 'date') matchFieldVal = m.date;
        else if (filterSearchType === 'original_amount') matchFieldVal = m.amount.toString();
        else if (filterSearchType === 'open_amount') matchFieldVal = m.remaining_amount.toString();
        else if (filterSearchType === 'notes') matchFieldVal = (m.notes || '').toLowerCase();

        const matchesBulk = parsedBulkSearchTokens.some(token => {
          if (searchExactMatch) {
            // Exact match (يساوى)
            if (filterSearchType === 'original_amount' || filterSearchType === 'open_amount' || filterSearchType === 'foreign_amount') {
              const numToken = Number(token);
              const numVal = Number(matchFieldVal);
              return !isNaN(numToken) && !isNaN(numVal) && Math.abs(numToken - numVal) < 0.01;
            }
            return matchFieldVal.trim() === token.trim();
          } else {
            // Partial match (يحتوى على)
            return matchFieldVal.includes(token);
          }
        });
        if (!matchesBulk) return false;
      }

      // 2. Date Range
      if (filterFromDate && m.date < filterFromDate) return false;
      if (filterToDate && m.date > filterToDate) return false;

      // 3. Movement / Document Type
      if (filterTypes.length > 0 && !filterTypes.includes(m.doc_type)) return false;

      // 4. Currency
      if (filterCurrencies.length > 0 && !filterCurrencies.includes(m.currency)) return false;

      // 5. Customers Multi-select
      if (selectedCustomerIds.length > 0) {
        if (m.party_type !== 'customer' || !m.party_id || !selectedCustomerIds.includes(m.party_id)) {
          return false;
        }
      }

      // 6. Suppliers Multi-select
      if (selectedSupplierIds.length > 0) {
        if (m.party_type !== 'supplier' || !m.party_id || !selectedSupplierIds.includes(m.party_id)) {
          return false;
        }
      }

      // 7. Amount Range / Exact Amount
      if (filterExactAmount) {
        const exactNum = Number(filterExactAmount);
        if (!isNaN(exactNum) && Math.abs(m.amount - exactNum) >= 0.01) return false;
      } else {
        if (filterMinAmount && m.amount < Number(filterMinAmount)) return false;
        if (filterMaxAmount && m.amount > Number(filterMaxAmount)) return false;
      }

      // 8. Payment Status
      if (filterPaymentStatus !== 'all') {
        if (m.payment_status !== filterPaymentStatus) return false;
      }

      // 9. Payment Type
      if (filterPaymentType !== 'all') {
        if (m.payment_type !== filterPaymentType) return false;
      }

      // 10. Journal Entry Status
      if (filterJeStatus === 'has_je' && !m.entry_number) return false;
      if (filterJeStatus === 'no_je' && m.entry_number) return false;

      return true;
    });
  }, [
    allMovements, parsedBulkSearchTokens, filterSearchType, searchExactMatch, filterFromDate, filterToDate,
    filterTypes, filterCurrencies, selectedCustomerIds, selectedSupplierIds,
    filterMinAmount, filterMaxAmount, filterExactAmount, filterPaymentStatus, filterPaymentType, filterJeStatus
  ]);

  // Statistics calculation
  const summaryStats = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    let totalRemaining = 0;
    filteredMovements.forEach(m => {
      totalDebit += m.debit;
      totalCredit += m.credit;
      totalRemaining += m.remaining_amount;
    });
    return {
      count: filteredMovements.length,
      totalDebit,
      totalCredit,
      netDifference: totalDebit - totalCredit,
      totalRemaining,
    };
  }, [filteredMovements]);

  // Reset all filters
  const handleResetFilters = () => {
    setFilterSearchType('number');
    setFilterDocNumbers('');
    setSearchExactMatch(false);
    setFilterFromDate('');
    setFilterToDate('');
    setFilterTypes([]);
    setFilterCurrencies([]);
    setSelectedCustomerIds([]);
    setSelectedSupplierIds([]);
    setFilterMinAmount('');
    setFilterMaxAmount('');
    setFilterExactAmount('');
    setFilterPaymentStatus('all');
    setFilterPaymentType('all');
    setFilterJeStatus('all');
    setSelectedRowIds([]);
  };

  // Toggle helpers (robust, zero double-click issues)
  const toggleDocType = (typeKey: string) => {
    setFilterTypes(prev => {
      if (prev.includes(typeKey)) return prev.filter(k => k !== typeKey);
      return [...prev, typeKey];
    });
  };

  const toggleAllDocTypes = () => {
    if (filterTypes.length === movementTypeOptions.length) {
      setFilterTypes([]);
    } else {
      setFilterTypes(movementTypeOptions.map(o => o.key));
    }
  };

  const toggleCurrency = (curr: string) => {
    setFilterCurrencies(prev => {
      if (prev.includes(curr)) return prev.filter(c => c !== curr);
      return [...prev, curr];
    });
  };

  const toggleCustomer = (id: string) => {
    setSelectedCustomerIds(prev => {
      if (prev.includes(id)) return prev.filter(c => c !== id);
      return [...prev, id];
    });
  };

  const toggleSupplier = (id: string) => {
    setSelectedSupplierIds(prev => {
      if (prev.includes(id)) return prev.filter(s => s !== id);
      return [...prev, id];
    });
  };

  // Click on Document Number to open document directly!
  const handleOpenDocument = (m: UnifiedMovement) => {
    if (m.doc_type === 'invoices') {
      setPendingViewDoc({ type: 'invoice', idOrNumber: m.doc_number || m.doc_id });
      openTab('invoices');
    } else if (m.doc_type === 'purchase_invoices') {
      setPendingViewDoc({ type: 'purchase_invoice', idOrNumber: m.doc_number || m.doc_id });
      openTab('purchase_invoices');
    } else if (m.doc_type === 'returns') {
      setPendingViewDoc({ type: 'return', idOrNumber: m.doc_number || m.doc_id });
      openTab('returns');
    } else if (m.doc_type === 'journal_entries') {
      setPendingViewDoc({ type: 'journal', idOrNumber: m.entry_number || m.doc_number });
      openTab('journal_entries');
    } else {
      openTab(m.nav_page);
    }
  };

  // Click on Journal Entry Number to open JE directly!
  const handleOpenJournalEntry = (entryNumber: string) => {
    setPendingViewDoc({ type: 'journal', idOrNumber: entryNumber });
    openTab('journal_entries');
  };

  // Export handlers
  const handleExportExcel = (onlySelected: boolean = false) => {
    const listToExport = onlySelected
      ? filteredMovements.filter(m => selectedRowIds.includes(m.id))
      : filteredMovements;

    const data = listToExport.map(m => ({
      'رقم المستند': m.doc_number,
      'نوع المستند': isAr ? m.doc_type_label_ar : m.doc_type_label_en,
      'التاريخ': formatDate(m.date),
      'الطرف / العميل / المورد': m.party_name,
      'مدين': m.debit,
      'دائن': m.credit,
      'المبلغ الأصلي': m.amount,
      'المتبقي': m.remaining_amount,
      'العملة': m.currency,
      'حالة الدفع': m.payment_status,
      'طريقة الدفع': m.payment_type || '-',
      'رقم القيد': m.entry_number || '-',
      'الملاحظات': m.notes || '-',
    }));

    exportToExcel(data, { filename: 'Movements_Search_Report', sheetName: 'الحركات' });
  };

  const handleExportPDF = () => {
    if (!tableRef.current) return;
    exportToPDFUtil(tableRef.current, {
      filename: 'Movements_Search_Report',
      reportTitle: isAr ? 'تقرير محرك بحث الحركات والمستندات' : 'Movements Search Engine Report',
    });
  };

  const handlePrint = () => {
    if (!tableRef.current) return;
    printElement(tableRef.current, isAr ? 'محرك بحث الحركات' : 'Movements Search');
  };

  return (
    <div className="space-y-2 animate-in fade-in duration-300 font-sans" dir={dir}>
      {/* 1. Header Bar: Compact, Title & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-3.5 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
            <Search size={15} />
          </div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-base font-bold tracking-tight text-slate-900">
              {isAr ? 'محرك بحث الحركات' : 'Movements Search Engine'}
            </h2>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              {isAr ? 'البحث والتقصي الشامل في كافة الحركات المالية والمستندات' : 'Comprehensive movement inquiry'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setRefreshIndex(i => i + 1)}
            disabled={loading}
            className="flex items-center gap-1 px-2.5 py-1 bg-white text-slate-600 border border-slate-200 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all active:scale-95 shadow-2xs"
            title={isAr ? 'تحديث البيانات' : 'Refresh Data'}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-emerald-600' : ''} />
            <span className="hidden sm:inline">{isAr ? 'تحديث' : 'Refresh'}</span>
          </button>

          <ExportButtons 
            onExportExcel={() => handleExportExcel(false)}
            onExportPDF={handleExportPDF}
            onPrint={handlePrint}
            onExportExcelSelected={() => handleExportExcel(true)}
            onExportPDFSelected={handleExportPDF}
            selectedCount={selectedRowIds.length}
            size="sm"
          />

          <button
            type="button"
            onClick={() => {
              closeTab('transactions_search');
              setCurrentPage('dashboard');
            }}
            className="w-7 h-7 flex items-center justify-center bg-white text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 transition-all shadow-2xs active:scale-95 shrink-0"
            title={isAr ? 'إغلاق الشاشة' : 'Close Page'}
          >
            <X size={14} className="stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* 2. Compact Search Filter Panel (مُعاد ترتيبه لتوفير أقصى مساحة رأسية) */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-3 space-y-2.5">
        {/* Row 1: The 4 Core Filters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5" dir={dir}>
          {/* Box 1: البحث المتعدد (Multi-Search) */}
          <div className="bg-slate-50/70 p-2 rounded-xl border border-slate-200/70 flex flex-col justify-between space-y-1">
            <div className="flex items-center justify-between gap-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
                {isAr ? 'البحث المتعدد' : 'Multi Search'}
              </label>
              <div className="flex items-center gap-1">
                {/* Search Type Selector */}
                <select
                  className="text-[10px] font-bold text-emerald-700 bg-white border border-slate-200 rounded-md py-0.5 px-1 outline-none cursor-pointer"
                  value={filterSearchType}
                  onChange={(e) => setFilterSearchType(e.target.value)}
                >
                  <option value="number">{isAr ? 'رقم المستند' : 'Doc No'}</option>
                  <option value="original_amount">{isAr ? 'المبلغ الأصلي' : 'Amount'}</option>
                  <option value="open_amount">{isAr ? 'المبلغ المتبقي' : 'Remaining'}</option>
                  <option value="foreign_amount">{isAr ? 'مبلغ بالعملة' : 'Foreign Amt'}</option>
                  <option value="currency">{isAr ? 'رمز العملة' : 'Currency'}</option>
                  <option value="je_number">{isAr ? 'رقم القيد' : 'JE No'}</option>
                  <option value="date">{isAr ? 'التاريخ' : 'Date'}</option>
                  <option value="notes">{isAr ? 'البيان/الوصف' : 'Notes'}</option>
                </select>

                {/* Exact Match Toggle (يساوى) */}
                <button
                  type="button"
                  onClick={() => setSearchExactMatch(!searchExactMatch)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-all ${
                    searchExactMatch 
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs' 
                      : 'bg-white text-slate-500 border-slate-200 hover:text-slate-800'
                  }`}
                  title={isAr ? 'المطابقة التامة (= يساوى)' : 'Exact Match (=)'}
                >
                  {isAr ? '= يساوى' : '= Exact'}
                </button>
              </div>
            </div>

            <textarea
              rows={2}
              className="w-full p-1.5 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none text-[11px] font-mono resize-none shadow-2xs"
              placeholder={
                filterSearchType === 'number' ? "INV-2026-06-000005\nINV-2026-06-000003" :
                filterSearchType === 'original_amount' ? "1500\n3400.50" :
                filterSearchType === 'open_amount' ? "500\n1000" :
                filterSearchType === 'currency' ? "USD\nEUR\nSAR" :
                filterSearchType === 'je_number' ? "JV-2026-0001" :
                (isAr ? 'اكتب أو الصق أرقام متعددة...' : 'Paste numbers...')
              }
              value={filterDocNumbers}
              onChange={(e) => setFilterDocNumbers(e.target.value)}
            />
          </div>

          {/* Box 2: النطاق التاريخي (Date Range - Compact Inline) */}
          <div className="bg-slate-50/70 p-2 rounded-xl border border-slate-200/70 flex flex-col justify-between space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {isAr ? 'النطاق التاريخي' : 'Date Range'}
              </label>
              <div className="flex items-center gap-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date().toISOString().slice(0, 10);
                    setFilterFromDate(today);
                    setFilterToDate(today);
                  }}
                  className="px-1 py-0.2 rounded bg-white border border-slate-200 text-slate-600 font-bold hover:bg-slate-100"
                >
                  {isAr ? 'اليوم' : 'Today'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
                    setFilterFromDate(firstDay);
                    setFilterToDate(now.toISOString().slice(0, 10));
                  }}
                  className="px-1 py-0.2 rounded bg-white border border-slate-200 text-slate-600 font-bold hover:bg-slate-100"
                >
                  {isAr ? 'الشهر' : 'Month'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const firstDay = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
                    setFilterFromDate(firstDay);
                    setFilterToDate(now.toISOString().slice(0, 10));
                  }}
                  className="px-1 py-0.2 rounded bg-white border border-slate-200 text-slate-600 font-bold hover:bg-slate-100"
                >
                  {isAr ? 'العام' : 'Year'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilterFromDate('');
                    setFilterToDate('');
                  }}
                  className="px-1 py-0.2 rounded bg-white border border-slate-200 text-slate-400 font-bold hover:text-slate-600"
                >
                  {isAr ? 'الكل' : 'All'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 pt-0.5">
              <div>
                <span className="block text-[9px] text-slate-400 font-medium mb-0.5">{isAr ? 'من تاريخ' : 'From'}</span>
                <input
                  type="date"
                  className="w-full p-1 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-emerald-500 shadow-2xs font-mono"
                  value={filterFromDate}
                  onChange={(e) => setFilterFromDate(e.target.value)}
                />
              </div>
              <div>
                <span className="block text-[9px] text-slate-400 font-medium mb-0.5">{isAr ? 'إلى تاريخ' : 'To'}</span>
                <input
                  type="date"
                  className="w-full p-1 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-emerald-500 shadow-2xs font-mono"
                  value={filterToDate}
                  onChange={(e) => setFilterToDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Box 3: نوع المستند (Doc Types - Compact 2-col Checklist) */}
          <div className="bg-slate-50/70 p-2 rounded-xl border border-slate-200/70 flex flex-col justify-between space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {isAr ? 'نوع المستند' : 'Doc Types'}
              </label>
              <button
                type="button"
                onClick={toggleAllDocTypes}
                className="text-[10px] font-bold text-emerald-600 hover:underline"
              >
                {filterTypes.length === movementTypeOptions.length ? (isAr ? 'إلغاء الكل' : 'Deselect') : (isAr ? 'تحديد الكل' : 'Select All')}
              </button>
            </div>

            <div className="h-16 overflow-y-auto grid grid-cols-2 gap-1 p-1 bg-white border border-slate-200 rounded-lg custom-scrollbar">
              {movementTypeOptions.map(opt => {
                const checked = filterTypes.includes(opt.key);
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => toggleDocType(opt.key)}
                    className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded text-start transition-all cursor-pointer select-none text-[10.5px] ${
                      checked 
                        ? 'bg-emerald-50 font-bold text-emerald-800 border border-emerald-200' 
                        : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border ${
                      checked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                    }`}>
                      {checked && <Check size={10} className="stroke-[3]" />}
                    </div>
                    <span className="truncate">{isAr ? opt.labelAr : opt.labelEn}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Box 4: العملة (Currency - Compact Pills) */}
          <div className="bg-slate-50/70 p-2 rounded-xl border border-slate-200/70 flex flex-col justify-between space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {isAr ? 'العملة' : 'Currency'}
              </label>
              {filterCurrencies.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterCurrencies([])}
                  className="text-[10px] font-bold text-slate-400 hover:text-slate-600"
                >
                  {isAr ? 'مسح' : 'Clear'}
                </button>
              )}
            </div>

            <div className="h-16 overflow-y-auto flex flex-wrap gap-1 p-1 bg-white border border-slate-200 rounded-lg custom-scrollbar content-start">
              <button
                type="button"
                onClick={() => setFilterCurrencies([])}
                className={`px-2 py-0.5 rounded text-[10.5px] font-bold border transition-all cursor-pointer ${
                  filterCurrencies.length === 0
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {isAr ? 'الكل' : 'All'}
              </button>

              {availableCurrencies.map(curr => {
                const isSelected = filterCurrencies.includes(curr);
                return (
                  <button
                    key={curr}
                    type="button"
                    onClick={() => toggleCurrency(curr)}
                    className={`px-2 py-0.5 rounded text-[10.5px] font-mono font-bold border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {curr}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Row 2: Secondary Filters (Customers, Suppliers, Amounts, Payment Status, Reset) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 text-xs pt-1 border-t border-slate-100 items-end">
          {/* Customer Multi-Select */}
          <div className="space-y-0.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-slate-500">
                {isAr ? 'تصفية العملاء' : 'Customers'}
              </label>
              {selectedCustomerIds.length > 0 && (
                <span className="text-[9px] px-1 py-0.2 bg-emerald-100 text-emerald-800 rounded-md font-bold">
                  {selectedCustomerIds.length}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsCustomerModalOpen(true)}
              className="w-full flex items-center justify-between p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg font-bold text-slate-700 text-xs transition-all text-start"
            >
              <div className="flex items-center gap-1.5 truncate">
                <Users size={13} className="text-emerald-600 shrink-0" />
                <span className="truncate">
                  {selectedCustomerIds.length === 0
                    ? (isAr ? 'جميع العملاء' : 'All Customers')
                    : selectedCustomerIds.length === 1
                    ? customerMap.get(selectedCustomerIds[0])?.name || (isAr ? 'عميل محدد' : '1 Selected')
                    : `${selectedCustomerIds.length} ${isAr ? 'عملاء محددين' : 'Selected'}`}
                </span>
              </div>
              <ChevronDown size={13} className="text-slate-400 shrink-0" />
            </button>
          </div>

          {/* Supplier Multi-Select */}
          <div className="space-y-0.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-slate-500">
                {isAr ? 'تصفية الموردين' : 'Suppliers'}
              </label>
              {selectedSupplierIds.length > 0 && (
                <span className="text-[9px] px-1 py-0.2 bg-blue-100 text-blue-800 rounded-md font-bold">
                  {selectedSupplierIds.length}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsSupplierModalOpen(true)}
              className="w-full flex items-center justify-between p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg font-bold text-slate-700 text-xs transition-all text-start"
            >
              <div className="flex items-center gap-1.5 truncate">
                <Building2 size={13} className="text-blue-600 shrink-0" />
                <span className="truncate">
                  {selectedSupplierIds.length === 0
                    ? (isAr ? 'جميع الموردين' : 'All Suppliers')
                    : selectedSupplierIds.length === 1
                    ? supplierMap.get(selectedSupplierIds[0])?.name || (isAr ? 'مورد محدد' : '1 Selected')
                    : `${selectedSupplierIds.length} ${isAr ? 'موردين محددين' : 'Selected'}`}
                </span>
              </div>
              <ChevronDown size={13} className="text-slate-400 shrink-0" />
            </button>
          </div>

          {/* Amount: Exact or Range */}
          <div className="space-y-0.5 lg:col-span-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-slate-500">
                {isAr ? 'المبلغ' : 'Amount'}
              </label>
              <div className="flex items-center gap-1 text-[9px]">
                <span className="text-slate-400">{isAr ? '(أو محدد يساوى)' : '(or exact)'}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <input
                type="number"
                placeholder={isAr ? 'يساوى =' : '= Exact'}
                className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                value={filterExactAmount}
                onChange={(e) => {
                  setFilterExactAmount(e.target.value);
                  if (e.target.value) {
                    setFilterMinAmount('');
                    setFilterMaxAmount('');
                  }
                }}
              />
              <input
                type="number"
                placeholder={isAr ? 'من مبلغ' : 'Min'}
                disabled={Boolean(filterExactAmount)}
                className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-emerald-500 font-mono disabled:opacity-40"
                value={filterMinAmount}
                onChange={(e) => setFilterMinAmount(e.target.value)}
              />
              <input
                type="number"
                placeholder={isAr ? 'إلى مبلغ' : 'Max'}
                disabled={Boolean(filterExactAmount)}
                className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-emerald-500 font-mono disabled:opacity-40"
                value={filterMaxAmount}
                onChange={(e) => setFilterMaxAmount(e.target.value)}
              />
            </div>
          </div>

          {/* Payment Status */}
          <div className="space-y-0.5">
            <label className="text-[10px] font-bold text-slate-500 block">
              {isAr ? 'حالة السداد' : 'Payment Status'}
            </label>
            <select
              value={filterPaymentStatus}
              onChange={(e) => setFilterPaymentStatus(e.target.value)}
              className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none cursor-pointer"
            >
              <option value="all">{isAr ? 'كافة الحالات' : 'All'}</option>
              <option value="paid">{isAr ? 'مدفوع بالكامل' : 'Paid'}</option>
              <option value="partial">{isAr ? 'مدفوع جزئياً' : 'Partial'}</option>
              <option value="unpaid">{isAr ? 'غير مدفوع' : 'Unpaid'}</option>
            </select>
          </div>

          {/* Reset Filters Button */}
          <div className="flex items-center justify-between sm:justify-end gap-2 pb-0.5">
            <button
              type="button"
              onClick={handleResetFilters}
              className="w-full p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-bold border border-rose-200 flex items-center justify-center gap-1 transition-all active:scale-95 shadow-2xs"
            >
              <RotateCcw size={12} />
              <span>{isAr ? 'إعادة تعيين المرشحات' : 'Reset Filters'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Summary Toolbar Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-1.5 bg-white border border-slate-200/90 rounded-xl shadow-2xs text-xs">
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 font-bold text-xs">
          <div className="flex items-center gap-1">
            <span className="text-slate-400 text-[11px] font-medium">{isAr ? 'النتائج:' : 'Found:'}</span>
            <span className="text-slate-900 font-mono text-sm">{summaryStats.count}</span>
          </div>
          <span className="text-slate-200 hidden sm:inline">|</span>

          <div className="flex items-center gap-1">
            <span className="text-slate-400 text-[11px] font-medium">{isAr ? 'المدين:' : 'Debit:'}</span>
            <span className="text-emerald-700 font-mono text-xs sm:text-sm">{formatMoney(summaryStats.totalDebit)} {systemCurrency}</span>
          </div>
          <span className="text-slate-200 hidden sm:inline">|</span>

          <div className="flex items-center gap-1">
            <span className="text-slate-400 text-[11px] font-medium">{isAr ? 'الدائن:' : 'Credit:'}</span>
            <span className="text-rose-600 font-mono text-xs sm:text-sm">{formatMoney(summaryStats.totalCredit)} {systemCurrency}</span>
          </div>
          <span className="text-slate-200 hidden sm:inline">|</span>

          <div className="flex items-center gap-1">
            <span className="text-slate-400 text-[11px] font-medium">{isAr ? 'صافي الرصيد:' : 'Net:'}</span>
            <span className={`font-mono text-xs sm:text-sm ${summaryStats.netDifference >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>
              {formatMoney(Math.abs(summaryStats.netDifference))} {summaryStats.netDifference >= 0 ? (isAr ? 'مدين' : 'Dr') : (isAr ? 'دائن' : 'Cr')}
            </span>
          </div>
          <span className="text-slate-200 hidden sm:inline">|</span>

          <div className="flex items-center gap-1">
            <span className="text-slate-400 text-[11px] font-medium">{isAr ? 'المتبقي:' : 'Remaining:'}</span>
            <span className="text-amber-700 font-mono text-xs sm:text-sm">{formatMoney(summaryStats.totalRemaining)} {systemCurrency}</span>
          </div>
        </div>

        {selectedRowIds.length > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-800 animate-in fade-in">
            <span>{isAr ? `المحدد (${selectedRowIds.length})` : `Selected (${selectedRowIds.length})`}</span>
            <button 
              type="button" 
              onClick={() => setSelectedRowIds([])}
              className="text-slate-400 hover:text-slate-600 text-[10px]"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* 4. Table Results View with Clickable Links */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div ref={tableRef} className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-xs text-start border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider text-[10.5px]">
                <th className="p-2.5 w-8 text-center">
                  <input
                    type="checkbox"
                    checked={filteredMovements.length > 0 && selectedRowIds.length === filteredMovements.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedRowIds(filteredMovements.map(m => m.id));
                      else setSelectedRowIds([]);
                    }}
                    className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </th>
                <th className={`p-2.5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{isAr ? 'رقم المستند (انقر للفتح)' : 'Doc No (Click to Open)'}</th>
                <th className={`p-2.5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{isAr ? 'نوع الحركة' : 'Type'}</th>
                <th className={`p-2.5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{isAr ? 'التاريخ' : 'Date'}</th>
                <th className={`p-2.5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{isAr ? 'الطرف / العميل / المورد' : 'Party / Entity'}</th>
                <th className={`p-2.5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{isAr ? 'المبلغ الأصلي' : 'Amount'}</th>
                <th className={`p-2.5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{isAr ? 'المتبقي' : 'Remaining'}</th>
                <th className={`p-2.5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{isAr ? 'العملة' : 'Currency'}</th>
                <th className={`p-2.5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{isAr ? 'حالة الدفع' : 'Status'}</th>
                <th className={`p-2.5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{isAr ? 'رقم القيد (انقر للفتح)' : 'JE No (Click to Open)'}</th>
                <th className={`p-2.5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{isAr ? 'ملاحظات / وصف' : 'Notes'}</th>
                <th className="p-2.5 text-center w-16">{isAr ? 'إجراء' : 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={12} className="p-10 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw size={22} className="animate-spin text-emerald-600" />
                      <span className="font-bold text-xs">{isAr ? 'جاري فحص وجلب حركات النظام...' : 'Loading movements...'}</span>
                    </div>
                  </td>
                </tr>
              ) : filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-10 text-center text-slate-400 italic">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Search size={24} className="text-slate-300" />
                      <p className="font-bold text-slate-600 text-xs">{isAr ? 'لا توجد حركات تطابق معايير البحث' : 'No movements match your criteria'}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredMovements.map(m => {
                  const isSelected = selectedRowIds.includes(m.id);
                  return (
                    <tr
                      key={m.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-emerald-50/40' : ''
                      }`}
                    >
                      <td className="p-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedRowIds(prev => [...prev, m.id]);
                            else setSelectedRowIds(prev => prev.filter(x => x !== m.id));
                          }}
                          className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </td>

                      {/* Clickable Document Number to open the document */}
                      <td className="p-2.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenDocument(m)}
                          className="font-mono font-bold text-emerald-600 hover:text-emerald-800 hover:underline inline-flex items-center gap-1 group text-xs text-start cursor-pointer"
                          title={isAr ? `انقر لفتح مستند ${m.doc_number}` : `Click to open ${m.doc_number}`}
                        >
                          <span>{m.doc_number}</span>
                          <ExternalLink size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </td>

                      <td className="p-2.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-1.5 py-0.2 rounded-md border text-[10.5px] font-bold ${m.badge_color}`}>
                          {isAr ? m.doc_type_label_ar : m.doc_type_label_en}
                        </span>
                      </td>

                      <td className="p-2.5 whitespace-nowrap text-slate-600 text-[11px]">
                        {formatDate(m.date)}
                      </td>

                      <td className="p-2.5 font-bold text-slate-900 max-w-[180px] truncate" title={m.party_name}>
                        {m.party_name}
                      </td>

                      <td className="p-2.5 font-mono font-bold text-slate-800 whitespace-nowrap">
                        {formatMoney(m.amount)}
                      </td>

                      <td className="p-2.5 font-mono font-bold whitespace-nowrap text-amber-700">
                        {m.remaining_amount > 0 ? formatMoney(m.remaining_amount) : '-'}
                      </td>

                      <td className="p-2.5 font-mono text-slate-500 text-[10.5px] whitespace-nowrap">
                        {m.currency}
                      </td>

                      <td className="p-2.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-1.5 py-0.2 rounded-full text-[9.5px] font-bold ${
                          m.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                          m.payment_status === 'partial' ? 'bg-amber-100 text-amber-800' :
                          m.payment_status === 'unpaid' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {m.payment_status === 'paid' ? (isAr ? 'مدفوع' : 'Paid') :
                           m.payment_status === 'partial' ? (isAr ? 'جزئي' : 'Partial') :
                           m.payment_status === 'unpaid' ? (isAr ? 'غير مدفوع' : 'Unpaid') : (isAr ? 'معلق' : 'Pending')}
                        </span>
                      </td>

                      {/* Clickable Journal Entry Number to open the Journal Entry */}
                      <td className="p-2.5 font-mono whitespace-nowrap">
                        {m.entry_number ? (
                          <button
                            type="button"
                            onClick={() => handleOpenJournalEntry(m.entry_number!)}
                            className="text-blue-600 hover:text-blue-800 hover:underline font-bold inline-flex items-center gap-1 group cursor-pointer"
                            title={isAr ? `انقر لفتح القيد رقم ${m.entry_number}` : `Click to open JE ${m.entry_number}`}
                          >
                            <span>{m.entry_number}</span>
                            <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      <td className="p-2.5 text-slate-500 max-w-[200px] truncate text-[10.5px]" title={m.notes}>
                        {m.notes || '-'}
                      </td>

                      <td className="p-2.5 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenDocument(m)}
                          className="p-1 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-all cursor-pointer"
                          title={isAr ? `فتح ${m.doc_number}` : `Open ${m.doc_number}`}
                        >
                          <ExternalLink size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Multi-Select Modal with Solid Toggles */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md p-4 space-y-3 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Users size={16} className="text-emerald-600" />
                <span>{isAr ? 'تصفية العملاء (اختيار متعدد)' : 'Select Customers'}</span>
              </h3>
              <button 
                type="button" 
                onClick={() => setIsCustomerModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="relative">
              <Search size={14} className={`absolute top-3 text-slate-400 ${dir === 'rtl' ? 'right-3' : 'left-3'}`} />
              <input
                type="text"
                placeholder={isAr ? 'ابحث باسم أو كود العميل...' : 'Search customer...'}
                value={customerSearchQuery}
                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                className={`w-full py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-emerald-500 ${
                  dir === 'rtl' ? 'pr-9 pl-3' : 'pl-9 pr-3'
                }`}
              />
            </div>

            <div className="flex items-center justify-between text-xs px-1">
              <button
                type="button"
                onClick={() => setSelectedCustomerIds(customers.map(c => c.id))}
                className="text-emerald-600 font-bold hover:underline cursor-pointer"
              >
                {isAr ? 'تحديد الكل' : 'Select All'}
              </button>
              <button
                type="button"
                onClick={() => setSelectedCustomerIds([])}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {isAr ? 'إلغاء التحديد' : 'Deselect All'}
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1 p-1 custom-scrollbar text-xs">
              {customers
                .filter(c => 
                  !customerSearchQuery.trim() || 
                  c.name?.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                  c.code?.toLowerCase().includes(customerSearchQuery.toLowerCase())
                )
                .map(cust => {
                  const checked = selectedCustomerIds.includes(cust.id);
                  return (
                    <button
                      key={cust.id}
                      type="button"
                      onClick={() => toggleCustomer(cust.id)}
                      className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-start transition-all cursor-pointer ${
                        checked ? 'bg-emerald-50 text-emerald-900 font-bold border border-emerald-200' : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                        checked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                      }`}>
                        {checked && <Check size={11} className="stroke-[3]" />}
                      </div>
                      <span className="truncate flex-1">{cust.name}</span>
                      {cust.code && <span className="font-mono text-[10px] text-slate-400">{cust.code}</span>}
                    </button>
                  );
                })}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(false)}
                className="px-4 py-1.5 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 transition-all shadow-2xs cursor-pointer"
              >
                {isAr ? 'تم التطبيق' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Multi-Select Modal with Solid Toggles */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md p-4 space-y-3 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Building2 size={16} className="text-blue-600" />
                <span>{isAr ? 'تصفية الموردين (اختيار متعدد)' : 'Select Suppliers'}</span>
              </h3>
              <button 
                type="button" 
                onClick={() => setIsSupplierModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="relative">
              <Search size={14} className={`absolute top-3 text-slate-400 ${dir === 'rtl' ? 'right-3' : 'left-3'}`} />
              <input
                type="text"
                placeholder={isAr ? 'ابحث باسم أو كود المورد...' : 'Search supplier...'}
                value={supplierSearchQuery}
                onChange={(e) => setSupplierSearchQuery(e.target.value)}
                className={`w-full py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-blue-500 ${
                  dir === 'rtl' ? 'pr-9 pl-3' : 'pl-9 pr-3'
                }`}
              />
            </div>

            <div className="flex items-center justify-between text-xs px-1">
              <button
                type="button"
                onClick={() => setSelectedSupplierIds(suppliers.map(s => s.id))}
                className="text-blue-600 font-bold hover:underline cursor-pointer"
              >
                {isAr ? 'تحديد الكل' : 'Select All'}
              </button>
              <button
                type="button"
                onClick={() => setSelectedSupplierIds([])}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {isAr ? 'إلغاء التحديد' : 'Deselect All'}
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1 p-1 custom-scrollbar text-xs">
              {suppliers
                .filter(s => 
                  !supplierSearchQuery.trim() || 
                  s.name?.toLowerCase().includes(supplierSearchQuery.toLowerCase()) ||
                  s.code?.toLowerCase().includes(supplierSearchQuery.toLowerCase())
                )
                .map(supp => {
                  const checked = selectedSupplierIds.includes(supp.id);
                  return (
                    <button
                      key={supp.id}
                      type="button"
                      onClick={() => toggleSupplier(supp.id)}
                      className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-start transition-all cursor-pointer ${
                        checked ? 'bg-blue-50 text-blue-900 font-bold border border-blue-200' : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                        checked ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'
                      }`}>
                        {checked && <Check size={11} className="stroke-[3]" />}
                      </div>
                      <span className="truncate flex-1">{supp.name}</span>
                      {supp.code && <span className="font-mono text-[10px] text-slate-400">{supp.code}</span>}
                    </button>
                  );
                })}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsSupplierModalOpen(false)}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 transition-all shadow-2xs cursor-pointer"
              >
                {isAr ? 'تم التطبيق' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
