import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigation } from '../contexts/NavigationContext';
import { dbService, apiRequest } from '../services/dbService';
import { PostingService } from '../services/PostingService';
import { formatNumber, formatMoney } from '../utils/formatUtils';
import { Customer, Supplier, Product, Warehouse, PaymentMethod, Account, Operation, Department, CostCenter } from '../types';
import { 
  FileSpreadsheet, UploadCloud, Download, CheckCircle2, AlertTriangle, 
  Trash2, Edit3, ChevronDown, ChevronUp, FileText, ArrowUpFromLine, 
  ArrowDownToLine, RotateCcw, Hash, Calendar, Layers, ShieldCheck, 
  X, Check, RefreshCw, Eye, Sparkles, ExternalLink, Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Safely parses Excel dates including serial numbers (e.g. 46288), Date objects, and string formats (YYYY-MM-DD or DD/MM/YYYY)
 */
function formatExcelDate(val: any, fallbackDate: string): string {
  if (val === null || val === undefined || val === '') return fallbackDate;
  
  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, '0');
      const d = String(val.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return fallbackDate;
  }

  const str = String(val).trim();
  if (!str) return fallbackDate;

  // Check if numeric serial (Excel serial date e.g. 25000 to 90000)
  const num = Number(str);
  if (!isNaN(num) && num > 25000 && num < 90000) {
    const d = new Date(Math.round((num - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dt = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${dt}`;
    }
  }

  // Check DD/MM/YYYY or DD-MM-YYYY
  const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    const year = dmy[3];
    return `${year}-${month}-${day}`;
  }

  // Check YYYY-MM-DD or YYYY/MM/DD
  const ymd = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymd) {
    const year = ymd[1];
    const month = ymd[2].padStart(2, '0');
    const day = ymd[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Fallback try standard JS Date
  const d = new Date(str);
  if (!isNaN(d.getTime()) && d.getFullYear() >= 2000 && d.getFullYear() <= 2100) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dt = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dt}`;
  }

  return fallbackDate;
}

export interface DocumentImportProps {
  type: 'sales' | 'purchases';
}

interface ParsedItem {
  id: string;
  rowIndex: number;
  product_id: string;
  product_code: string;
  product_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  withholding_tax_rate: number;
  withholding_tax_amount: number;
  total: number;
  description?: string;
  is_service?: boolean;
  stock_error?: boolean;
  available_stock?: number;
  stock_warning?: string;
  account_error?: boolean;
  account_warning?: string;
  operation_id?: string | null;
  operation_number?: string;
  department_id?: string | null;
  department_name?: string;
  cost_center_id?: string | null;
  cost_center_name?: string;
}

interface ParsedDocument {
  ref: string;
  doc_type: string;
  date: string;
  party_id: string;
  party_name: string;
  party_code?: string;
  warehouse_id?: string | null;
  warehouse_name?: string;
  payment_type: 'cash' | 'credit';
  payment_method_id?: string;
  notes?: string;
  items: ParsedItem[];
  // Calculated totals
  gross_total: number;
  discount_amount: number;
  subtotal: number;
  tax_amount: number;
  withholding_tax_amount: number;
  total_amount: number;
  // Execution status
  status?: 'pending' | 'saved' | 'failed';
  created_document_id?: string;
  created_document_number?: string;
  created_journal_id?: string;
  created_journal_number?: string;
  error_message?: string;
  is_all_services?: boolean;
  has_stock_error?: boolean;
  stock_error_message?: string;
  has_account_error?: boolean;
  account_error_message?: string;
  has_warehouse_error?: boolean;
  warehouse_error_message?: string;
  is_modified?: boolean;
}

interface ValidationError {
  rowNumber: number;
  ref: string;
  field: string;
  message: string;
}

/**
 * Resiliently updates an existing journal entry or creates a new one if not found or invalid.
 * Strictly preserves the existing journal entry number (entry_number) during document updates/edits.
 */
async function saveOrUpdateJournalEntry(
  journalData: any,
  referenceId: string,
  preferredJournalId?: string,
  preferredJournalNumber?: string,
  companyId?: string
): Promise<{ id: string; entry_number: string }> {
  // Determine preserved journal entry number
  const preservedNumber = preferredJournalNumber || journalData?.entry_number || (dbService as any)._recentDeletedJEs?.[referenceId]?.entry_number;

  // 1. Check if a journal entry already exists for this document reference in the database
  let targetEntryId = preferredJournalId;
  let existingNumber = preservedNumber;

  if (companyId && referenceId) {
    try {
      const existing = await dbService.getJournalEntryByReference(referenceId, companyId);
      if (existing?.id) {
        targetEntryId = existing.id;
        existingNumber = existing.entry_number || existingNumber;
      }
    } catch (lookupErr) {
      console.warn(`[DocumentImport] Journal entry lookup by reference failed:`, lookupErr);
    }
  }

  // 2. If targetEntryId is known (either existing in DB or preferred), try updating it
  if (targetEntryId) {
    try {
      await apiRequest(`/journal_entries/${targetEntryId}`, 'PUT', {
        ...journalData,
        entry_number: existingNumber || preservedNumber || undefined,
        reference_id: referenceId,
        company_id: companyId
      });
      return { id: targetEntryId, entry_number: existingNumber || preservedNumber || '' };
    } catch (e: any) {
      console.warn(`[DocumentImport] Target journal entry ${targetEntryId} PUT failed, falling back:`, e);
      if (targetEntryId !== preferredJournalId && preferredJournalId) {
        try {
          await apiRequest(`/journal_entries/${preferredJournalId}`, 'PUT', {
            ...journalData,
            entry_number: preservedNumber || undefined,
            reference_id: referenceId,
            company_id: companyId
          });
          return { id: preferredJournalId, entry_number: preservedNumber || '' };
        } catch (fallbackErr) {
          console.warn(`[DocumentImport] Preferred journal entry ${preferredJournalId} PUT also failed:`, fallbackErr);
        }
      }
    }
  }

  // 3. Create fresh journal entry, strictly preserving the existing entry_number!
  const finalEntryNumber = existingNumber || preferredJournalNumber || journalData?.entry_number || (dbService as any)._recentDeletedJEs?.[referenceId]?.entry_number;
  const jeRes: any = await apiRequest('/journal_entries', 'POST', {
    ...journalData,
    entry_number: finalEntryNumber || undefined,
    reference_id: referenceId,
    company_id: companyId
  });
  return { id: jeRes.id, entry_number: jeRes.entry_number || finalEntryNumber || '' };
}

export const DocumentImport: React.FC<DocumentImportProps> = ({ type }) => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const { language, dir } = useLanguage();
  const { openTab, setPendingViewDoc } = useNavigation();

  const isAr = language === 'ar';
  const isSales = type === 'sales';
  const entityLabel = isSales ? (isAr ? 'العميل' : 'Customer') : (isAr ? 'المورد' : 'Supplier');
  const pageTitle = isSales 
    ? (isAr ? 'استيراد مستندات بيع من إكسيل' : 'Import Sales Documents from Excel')
    : (isAr ? 'استيراد مستندات شراء من إكسيل' : 'Import Purchase Documents from Excel');
  const sequenceModuleName = isSales ? 'sales_import_batches' : 'purchases_import_batches';

  // Master data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [isLoadingMasterData, setIsLoadingMasterData] = useState(true);

  // Batch header info
  const [batchDate, setBatchDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [batchNumber, setBatchNumber] = useState<string>('');
  const [isGeneratingBatchNumber, setIsGeneratingBatchNumber] = useState(true);

  // Upload & parse state
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [isParsing, setIsParsing] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [documents, setDocuments] = useState<ParsedDocument[]>([]);
  const [expandedRefs, setExpandedRefs] = useState<Record<string, boolean>>({});

  // Edit doc header modal state
  const [editingDoc, setEditingDoc] = useState<ParsedDocument | null>(null);
  const [editDocForm, setEditDocForm] = useState<{
    doc_type: string;
    date: string;
    party_id: string;
    warehouse_id: string;
    payment_type: 'cash' | 'credit';
    payment_method_id: string;
    notes: string;
    ref: string;
  }>({
    doc_type: '',
    date: '',
    party_id: '',
    warehouse_id: '',
    payment_type: 'credit',
    payment_method_id: '',
    notes: '',
    ref: ''
  });

  // Edit item modal state
  const [editingItem, setEditingItem] = useState<{ docRef: string; item: ParsedItem } | null>(null);

  // Add item modal state
  const [addingItemDocRef, setAddingItemDocRef] = useState<string | null>(null);
  const [addingItemWarehouseId, setAddingItemWarehouseId] = useState<string>('');
  const [newItemForm, setNewItemForm] = useState<{
    product_id: string;
    quantity: number;
    unit_price: number;
    discount_amount: number;
    vat_rate: number;
    withholding_tax_rate: number;
    operation_id: string;
    department_id: string;
    cost_center_id: string;
    description: string;
  }>({
    product_id: '',
    quantity: 1,
    unit_price: 0,
    discount_amount: 0,
    vat_rate: 14,
    withholding_tax_rate: 0,
    operation_id: '',
    department_id: '',
    cost_center_id: '',
    description: ''
  });

  // Save / Post state
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [saveProgress, setSaveProgress] = useState<{ current: number; total: number; statusText: string } | null>(null);
  const [isBatchSaved, setIsBatchSaved] = useState(false);

  // Tabs: 'import' or 'history'
  const [activeMainTab, setActiveMainTab] = useState<'import' | 'history'>('import');
  const [batchesHistory, setBatchesHistory] = useState<any[]>([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [selectedBatchDetails, setSelectedBatchDetails] = useState<any | null>(null);

  // Edit batch state
  const [editingBatch, setEditingBatch] = useState<any | null>(null);
  const [editBatchDate, setEditBatchDate] = useState<string>('');
  const [editBatchStatus, setEditBatchStatus] = useState<string>('posted');
  const [isUpdatingBatch, setIsUpdatingBatch] = useState(false);

  // Accounts audit toggle
  const [showAccountsAudit, setShowAccountsAudit] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Company Tax Settings
  const isVatEnabled = companySettings?.vat_enabled !== false;
  const isWhtEnabled = companySettings?.wht_enabled !== false && (isSales ? companySettings?.sales_wht_enabled !== false : companySettings?.purchase_wht_enabled !== false);

  // Load master data on mount
  useEffect(() => {
    const loadData = async () => {
      if (!user?.company_id) return;
      setIsLoadingMasterData(true);
      try {
        const [
          custs,
          supps,
          prods,
          whs,
          pms,
          accs,
          compRes,
          ops,
          depts,
          ccs
        ] = await Promise.all([
          dbService.list<Customer>('customers', { company_id: user.company_id }),
          dbService.list<Supplier>('suppliers', { company_id: user.company_id }),
          dbService.list<Product>('products', { company_id: user.company_id }),
          dbService.list<Warehouse>('warehouses', { company_id: user.company_id }),
          dbService.list<PaymentMethod>('payment_methods', { company_id: user.company_id }),
          dbService.list<Account>('accounts', { company_id: user.company_id }),
          dbService.get<any>('companies', user.company_id).catch(() => null),
          dbService.list<Operation>('operations', user.company_id).catch(() => []),
          dbService.list<Department>('departments', user.company_id).catch(() => []),
          dbService.list<CostCenter>('cost_centers', user.company_id).catch(() => [])
        ]);

        setCustomers(custs || []);
        setSuppliers(supps || []);
        setProducts(prods || []);
        setWarehouses(whs || []);
        setPaymentMethods(pms || []);
        setAccounts(accs || []);
        setCompanySettings(compRes?.settings || {});
        setOperations(ops || []);
        setDepartments(depts || []);
        setCostCenters(ccs || []);
      } catch (err: any) {
        console.error('Failed to load master data:', err);
        showNotification('فشل تحميل البيانات الأساسية للمطابقة: ' + err.message, 'error');
      } finally {
        setIsLoadingMasterData(false);
      }
    };

    loadData();
  }, [user?.company_id]);

  const fetchBatchesHistory = async () => {
    if (!user?.company_id) return;
    setIsLoadingBatches(true);
    try {
      const res: any = await apiRequest(`/document_import_batches?batch_type=${isSales ? 'sales' : 'purchases'}`);
      setBatchesHistory(Array.isArray(res) ? res : []);
    } catch (err: any) {
      console.error('Failed to load batches history:', err);
    } finally {
      setIsLoadingBatches(false);
    }
  };

  useEffect(() => {
    fetchBatchesHistory();
  }, [user?.company_id, isSales]);

  // Handler to save batch metadata edits
  const handleSaveBatchEdit = async () => {
    if (!editingBatch) return;
    setIsUpdatingBatch(true);
    try {
      await apiRequest(`/document_import_batches/${editingBatch.id}`, 'PUT', {
        batch_date: editBatchDate,
        status: editBatchStatus
      });
      showNotification(isAr ? 'تم حفظ تعديلات التشغيلة بنجاح' : 'Batch updated successfully', 'success');
      setEditingBatch(null);
      fetchBatchesHistory();
    } catch (err: any) {
      showNotification(err.message || (isAr ? 'فشل حفظ التعديلات' : 'Failed to update batch'), 'error');
    } finally {
      setIsUpdatingBatch(false);
    }
  };

  // Handler to load an entire batch into the workspace table for re-processing / inspection
  const handleLoadBatchIntoWorkspace = async (batch: any) => {
    if (!batch) return;
    setBatchNumber(batch.batch_number);
    if (batch.batch_date) {
      setBatchDate(String(batch.batch_date).slice(0, 10));
    }

    try {
      // Fetch full batch details with populated items from server
      let fullBatch = batch;
      try {
        const res: any = await apiRequest(`/document_import_batches/${batch.id}/full`);
        if (res && Array.isArray(res.details)) {
          fullBatch = res;
        }
      } catch (fErr) {
        console.warn('Could not fetch full batch, falling back to cached details:', fErr);
      }

      if (Array.isArray(fullBatch.details) && fullBatch.details.length > 0) {
        const docs: ParsedDocument[] = fullBatch.details.map((d: any, idx: number) => {
          const items: ParsedItem[] = Array.isArray(d.items) ? d.items : [];
          
          let gross = 0;
          let disc = 0;
          let netBefore = 0;
          let vat = 0;
          let wht = 0;
          let total = 0;

          items.forEach(it => {
            const qty = Number(it.quantity) || 1;
            const price = Number(it.unit_price) || 0;
            const itGross = qty * price;
            const itDisc = Number(it.discount_amount) || 0;
            const itSub = Number(it.subtotal) || Math.max(0, itGross - itDisc);
            const itVat = Number(it.vat_amount) || 0;
            const itWht = Number(it.withholding_tax_amount) || 0;
            const itTot = Number(it.total) || (itSub + itVat - itWht);

            gross += itGross;
            disc += itDisc;
            netBefore += itSub;
            vat += itVat;
            wht += itWht;
            total += itTot;
          });

          // Match party reliably from master data (zero guessing policy)
          const matchedParty = isSales 
            ? customers.find(c => 
                (d.party_id && c.id === d.party_id) || 
                (d.party_name && c.name?.trim().toLowerCase() === String(d.party_name).trim().toLowerCase()) || 
                (d.party_code && c.code?.toLowerCase() === String(d.party_code).toLowerCase())
              )
            : suppliers.find(s => 
                (d.party_id && s.id === d.party_id) || 
                (d.party_name && s.name?.trim().toLowerCase() === String(d.party_name).trim().toLowerCase()) || 
                (d.party_code && s.code?.toLowerCase() === String(d.party_code).toLowerCase())
              );

          const matchedWh = warehouses.find(w => 
            (d.warehouse_id && w.id === d.warehouse_id) || 
            (d.warehouse_name && w.name?.trim().toLowerCase() === String(d.warehouse_name).trim().toLowerCase())
          );

          return {
            ref: d.ref || `Ref-${idx + 1}`,
            doc_type: d.doc_type || (isSales ? 'فاتورة بيع' : 'فاتورة شراء'),
            date: d.date || fullBatch.batch_date || batchDate,
            party_id: matchedParty?.id || d.party_id || '',
            party_name: matchedParty?.name || d.party_name || '',
            party_code: matchedParty?.code || d.party_code || '',
            warehouse_id: matchedWh?.id || d.warehouse_id || null,
            warehouse_name: matchedWh?.name || d.warehouse_name || '',
            payment_type: d.payment_type || 'آجل',
            payment_method_id: d.payment_method_id || '',
            notes: d.notes || '',
            items,
            gross_total: items.length > 0 ? Number(gross.toFixed(2)) : (Number(d.gross_total) || Number(d.total_amount) || 0),
            discount_amount: Number(disc.toFixed(2)),
            discount_total: Number(disc.toFixed(2)),
            subtotal: items.length > 0 ? Number(netBefore.toFixed(2)) : (Number(d.subtotal) || Number(d.total_amount) || 0),
            net_before_tax: items.length > 0 ? Number(netBefore.toFixed(2)) : (Number(d.net_before_tax) || Number(d.total_amount) || 0),
            tax_amount: Number(vat.toFixed(2)),
            tax_total: Number(vat.toFixed(2)),
            withholding_tax_amount: Number(wht.toFixed(2)),
            withholding_tax_total: Number(wht.toFixed(2)),
            total_amount: items.length > 0 ? Number(total.toFixed(2)) : (Number(d.total_amount) || 0),
            created_document_id: d.created_document_id,
            created_document_number: d.created_document_number,
            created_journal_id: d.created_journal_id,
            created_journal_number: d.created_journal_number,
            status: d.status || 'saved',
            error_message: d.error_message
          };
        });

        // Expand all refs by default so items are immediately visible
        const newExpanded: Record<string, boolean> = {};
        docs.forEach(d => {
          newExpanded[d.ref] = true;
        });
        setExpandedRefs(newExpanded);

        const { updatedDocs, allErrors } = revalidateBatch(docs, products, companySettings, []);
        setDocuments(updatedDocs);
        setValidationErrors(allErrors);
        setIsBatchSaved(fullBatch.status === 'posted');
      }
    } catch (err: any) {
      console.error('Failed to load batch into workspace:', err);
    }

    setEditingBatch(null);
    setSelectedBatchDetails(null);
    setActiveMainTab('import');
    showNotification(
      isAr 
        ? `تم تحميل التشغيلة ${batch.batch_number} مع كافة بنودها وأصنافها بنجاح` 
        : `Loaded batch ${batch.batch_number} with all items`, 
      'info'
    );
  };

  // Generate permanent Batch Number on initial mount
  useEffect(() => {
    let isMounted = true;
    const fetchBatchSequence = async () => {
      if (!user?.company_id) return;
      setIsGeneratingBatchNumber(true);
      try {
        const next = await dbService.getNextSequence(sequenceModuleName, batchDate);
        if (isMounted) {
          setBatchNumber(next);
        }
      } catch (err: any) {
        console.error('Failed to fetch batch sequence:', err);
        const fallbackPrefix = isSales ? 'Batch-sal' : 'Batch-pur';
        const parts = batchDate.split('-');
        if (isMounted) {
          setBatchNumber(`${fallbackPrefix}-${parts[0] || '2026'}-${parts[1] || '09'}-00001`);
        }
      } finally {
        if (isMounted) setIsGeneratingBatchNumber(false);
      }
    };

    fetchBatchSequence();
    return () => {
      isMounted = false;
    };
  }, [user?.company_id, sequenceModuleName]);

  // Navigation to created document
  const handleNavigateToDocument = (doc: ParsedDocument) => {
    const docIdOrNum = doc.created_document_number || doc.created_document_id;
    if (!docIdOrNum) return;

    if (doc.doc_type === 'فاتورة بيع') {
      setPendingViewDoc({ type: 'invoice', idOrNumber: docIdOrNum });
      openTab('invoices', 'فواتير المبيعات');
    } else if (doc.doc_type === 'أمر بيع') {
      setPendingViewDoc({ type: 'sales_order', idOrNumber: docIdOrNum });
      openTab('sales_orders', 'أوامر البيع');
    } else if (doc.doc_type === 'مرتجع بيع') {
      setPendingViewDoc({ type: 'return', idOrNumber: docIdOrNum });
      openTab('returns', 'مرتجعات المبيعات');
    } else if (doc.doc_type === 'فاتورة شراء') {
      setPendingViewDoc({ type: 'purchase_invoice', idOrNumber: docIdOrNum });
      openTab('purchase_invoices', 'فواتير المشتريات');
    } else if (doc.doc_type === 'أمر شراء') {
      setPendingViewDoc({ type: 'purchase_order', idOrNumber: docIdOrNum });
      openTab('purchase_orders', 'أوامر الشراء');
    } else if (doc.doc_type === 'مرتجع شراء') {
      setPendingViewDoc({ type: 'purchase_return', idOrNumber: docIdOrNum });
      openTab('purchase_returns', 'مرتجعات المشتريات');
    }
  };

  // Navigation to created journal entry
  const handleNavigateToJournal = (doc: ParsedDocument) => {
    const journalIdOrNum = doc.created_journal_number || doc.created_journal_id;
    if (!journalIdOrNum) return;

    setPendingViewDoc({ type: 'journal', idOrNumber: journalIdOrNum });
    openTab('journal_entries', 'قيود اليومية');
  };

  // Recalculate document totals
  const recalculateDocTotals = (items: ParsedItem[]) => {
    let gross_total = 0;
    let discount_amount = 0;
    let subtotal = 0;
    let tax_amount = 0;
    let withholding_tax_amount = 0;
    let total_amount = 0;

    items.forEach(item => {
      gross_total += Number(item.quantity || 0) * Number(item.unit_price || 0);
      discount_amount += Number(item.discount_amount || 0);
      subtotal += Number(item.subtotal || 0);
      tax_amount += Number(item.vat_amount || 0);
      withholding_tax_amount += Number(item.withholding_tax_amount || 0);
      total_amount += Number(item.total || 0);
    });

    return {
      gross_total: Number(gross_total.toFixed(2)),
      discount_amount: Number(discount_amount.toFixed(2)),
      subtotal: Number(subtotal.toFixed(2)),
      tax_amount: Number(tax_amount.toFixed(2)),
      withholding_tax_amount: Number(withholding_tax_amount.toFixed(2)),
      total_amount: Number(total_amount.toFixed(2))
    };
  };

  // Audit items accounts for journal entries (sales, cost, inventory, vat, wht) - ZERO GUESSING POLICY
  const itemsAccountAudit = useMemo(() => {
    if (documents.length === 0) return [];
    
    const uniqueMap = new Map<string, ParsedItem>();
    documents.forEach(doc => {
      doc.items.forEach(item => {
        if (!uniqueMap.has(item.product_code)) {
          uniqueMap.set(item.product_code, item);
        }
      });
    });

    return Array.from(uniqueMap.values()).map(item => {
      const prod = products.find(p => p.id === item.product_id || (p.code && p.code.toLowerCase() === item.product_code.toLowerCase()));
      const isService = item.is_service || prod?.type === 'service' || prod?.is_service === true;

      // 1. Sales / Revenue Account (or Purchases for purchase imports)
      let salesName = '';
      let salesStatus: 'linked' | 'missing' | 'exempt' = 'missing';
      if (isSales) {
        if (prod?.revenue_account_id) {
          salesStatus = 'linked';
          salesName = prod.revenue_account_name || accounts.find(a => a.id === prod.revenue_account_id)?.name || 'حساب الإيراد';
        } else {
          salesStatus = 'missing';
          salesName = 'غير مسجل في بطاقة الصنف';
        }
      } else {
        const purAccId = prod?.cost_account_id || prod?.inventory_account_id;
        if (purAccId) {
          salesStatus = 'linked';
          salesName = prod?.cost_account_name || prod?.inventory_account_name || accounts.find(a => a.id === purAccId)?.name || 'حساب التكلفة/المخزون';
        } else {
          salesStatus = 'missing';
          salesName = 'غير مسجل في بطاقة الصنف';
        }
      }

      // 2. Cost Account
      let costName = '';
      let costStatus: 'linked' | 'missing' | 'exempt' = 'missing';
      if (isService) {
        costStatus = 'exempt';
        costName = 'خدمي (معفى)';
      } else {
        if (prod?.cost_account_id) {
          costStatus = 'linked';
          costName = prod.cost_account_name || accounts.find(a => a.id === prod.cost_account_id)?.name || 'حساب تكلفة المبيعات';
        } else {
          costStatus = 'missing';
          costName = 'غير مسجل في بطاقة الصنف';
        }
      }

      // 3. Inventory Account
      let invName = '';
      let invStatus: 'linked' | 'missing' | 'exempt' = 'missing';
      if (isService) {
        invStatus = 'exempt';
        invName = 'خدمي (معفى)';
      } else {
        if (prod?.inventory_account_id) {
          invStatus = 'linked';
          invName = prod.inventory_account_name || accounts.find(a => a.id === prod.inventory_account_id)?.name || 'حساب المخزون';
        } else {
          invStatus = 'missing';
          invName = 'غير مسجل في بطاقة الصنف';
        }
      }

      // 4. VAT Account
      let vatName = '';
      let vatStatus: 'linked' | 'missing' | 'exempt' = 'missing';
      const hasVatRate = isVatEnabled && (item.vat_rate > 0 || (isSales ? (prod?.vat_rate || 0) > 0 : (prod?.purchase_vat_rate || 0) > 0));
      if (!isVatEnabled || !hasVatRate) {
        vatStatus = 'exempt';
        vatName = !isVatEnabled ? 'معطلة بالشركة' : 'معفى (0%)';
      } else {
        const vatAccId = isSales ? (prod?.sales_vat_account_id || prod?.vat_account_id) : (prod?.purchase_vat_account_id || prod?.vat_account_id);
        if (vatAccId) {
          vatStatus = 'linked';
          vatName = (isSales ? (prod?.sales_vat_account_name || prod?.vat_account_name) : (prod?.purchase_vat_account_name || prod?.vat_account_name)) || accounts.find(a => a.id === vatAccId)?.name || 'حساب ضريبة القيمة المضافة';
        } else {
          vatStatus = 'missing';
          vatName = 'غير مسجل في بطاقة الصنف';
        }
      }

      // 5. WHT Account
      let whtName = '';
      let whtStatus: 'linked' | 'missing' | 'exempt' = 'missing';
      const hasWhtRate = isWhtEnabled && (item.withholding_tax_rate > 0 || (isSales ? (prod?.sales_withholding_tax_rate || 0) > 0 : (prod?.purchase_withholding_tax_rate || 0) > 0));
      if (!isWhtEnabled || !hasWhtRate) {
        whtStatus = 'exempt';
        whtName = !isWhtEnabled ? 'معطلة بالشركة' : 'معفى (0%)';
      } else {
        const whtAccId = isSales ? prod?.sales_withholding_tax_account_id : prod?.purchase_withholding_tax_account_id;
        if (whtAccId) {
          whtStatus = 'linked';
          whtName = (isSales ? prod?.sales_withholding_tax_account_name : prod?.purchase_withholding_tax_account_name) || accounts.find(a => a.id === whtAccId)?.name || 'حساب ضريبة الخصم';
        } else {
          whtStatus = 'missing';
          whtName = 'غير مسجل في بطاقة الصنف';
        }
      }

      return {
        product_code: item.product_code,
        product_name: item.product_name,
        is_service: isService,
        sales: { name: salesName, status: salesStatus },
        cost: { name: costName, status: costStatus },
        inventory: { name: invName, status: invStatus },
        vat: { name: vatName, status: vatStatus },
        wht: { name: whtName, status: whtStatus }
      };
    });
  }, [documents, products, accounts, isSales, isVatEnabled, isWhtEnabled]);

  // Summaries for Invoices, Orders, and Returns
  const computeSummaryForType = (typeKeywords: string[]) => {
    const filteredDocs = documents.filter(d => 
      typeKeywords.some(kw => d.doc_type.includes(kw))
    );

    let gross = 0;
    let discount = 0;
    let subtotal = 0;
    let vat = 0;
    let wht = 0;
    let net = 0;
    let totalItems = 0;

    filteredDocs.forEach(d => {
      gross += d.gross_total;
      discount += d.discount_amount;
      subtotal += d.subtotal;
      vat += d.tax_amount;
      wht += d.withholding_tax_amount;
      net += d.total_amount;
      totalItems += d.items.length;
    });

    return {
      count: filteredDocs.length,
      totalItems,
      gross: Number(gross.toFixed(2)),
      discount: Number(discount.toFixed(2)),
      subtotal: Number(subtotal.toFixed(2)),
      vat: Number(vat.toFixed(2)),
      wht: Number(wht.toFixed(2)),
      net: Number(net.toFixed(2))
    };
  };

  const invoicesSummary = useMemo(() => computeSummaryForType(['فاتورة']), [documents]);
  const ordersSummary = useMemo(() => computeSummaryForType(['أمر']), [documents]);
  const returnsSummary = useMemo(() => computeSummaryForType(['مرتجع']), [documents]);

  // Download comprehensive explanation template with realistic examples
  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    const sampleVatRate = isVatEnabled ? 14 : 0;
    const sampleWhtRate = isWhtEnabled ? 1 : 0;

    // Sheet 1: Explanation & Guidelines
    const guideRows = [
      ['دليل واستراتيجية استيراد مستندات ' + (isSales ? 'المبيعات' : 'المشتريات') + ' من الإكسيل'],
      ['يرجى قراءة الإرشادات التالية بدقة لتجنب أي أخطاء أثناء رفع الملف:'],
      [''],
      ['1. رقم المرجع (Ref):', 'يمثل رقم المرجع (مثال: Ref-000001) المعرف الموحد للمستند. في حالة احتواء الفاتورة على أكثر من صنف، يتم تكرار نفس رقم المرجع في جميع صفوف تلك الفاتورة.'],
      ['2. نوع المستند:', isSales ? 'يجب أن يكون أحد الأنواع الثلاثة التالية تماماً: (فاتورة بيع / أمر بيع / مرتجع بيع).' : 'يجب أن يكون أحد الأنواع الثلاثة التالية تماماً: (فاتورة شراء / أمر شراء / مرتجع شراء).'],
      ['3. التاريخ:', 'تاريخ المستند بصيغة (YYYY-MM-DD) مثل 2026-09-24.'],
      ['4. كود أو اسم ' + entityLabel + ':', 'يجب إدخال كود ' + entityLabel + ' أو اسمه المسجل في النظام بدقة للمطابقة التلقائية.'],
      ['5. كود الصنف أو الباركود:', 'يجب إدخال كود الصنف أو الباركود أو اسم الصنف المسجل بالنظام.'],
      ['6. اسم الصنف:', 'حقل اختياري للاسترشاد، يقوم النظام بجلب بيانات الصنف الأساسية تلقائياً من الكود.'],
      ['7. المخزن والأصناف الخدمية:', 'المخزن إلزامي للأصناف المخزنية فقط. في حال كان الصنف خدمة (Service) فلا يلزم تحديد مخزن ولا يؤثر ذلك على حركة الأرصدة.'],
      ['8. الكمية والسعر والخصم:', 'الكمية يجب أن تكون رقماً موجباً أكبر من صفر. السعر هو سعر الوحدة قبل الضريبة والخصم. الخصم قيمة نقدية على مستوى البند (أو 0).'],
      ['9. ضريبة القيمة المضافة %:', isVatEnabled ? 'النسبة المئوية لضريبة القيمة المضافة مثل 14 أو 0 (النظام مفعل له ض.ق.م).' : 'ضريبة القيمة المضافة معطلة في إعدادات الشركة الحالية (تكون 0%).'],
      ['10. ضريبة الخصم والإضافة %:', isWhtEnabled ? 'النسبة المئوية لضريبة الخصم والإضافة مثل 1 أو 0 (النظام مفعل له ض.خ.أ).' : 'ضريبة الخصم والإضافة معطلة في إعدادات الشركة الحالية (تكون 0%).'],
      ['11. طريقة الدفع:', 'إما (آجل) أو (نقدي). إذا كانت نقدي، يمكن تحديد اسم الخزينة / طريقة الدفع.'],
      ['12. تكرار بيانات المستند:', 'يجب تكرار بيانات الفاتورة (رقم المرجع، النوع، التاريخ، ' + entityLabel + ') في كل سطر يحتوي على صنف لنفس الفاتورة.'],
      ['13. رقم العملية / الإدارة / مركز التكلفة:', 'حقول اختيارية تماماً (غير إلزامية). يمكن إدخال رقم العملية، واسم أو كود الإدارة، واسم أو كود مركز التكلفة لربط البند تلقائياً.'],
      ['']
    ];

    const guideWs = XLSX.utils.aoa_to_sheet(guideRows);
    guideWs['!cols'] = [{ wch: 32 }, { wch: 90 }];
    XLSX.utils.book_append_sheet(wb, guideWs, 'دليل التعليمات');

    // Sheet 2: Data Template with examples
    const sampleParty = isSales 
      ? (customers[0]?.name || customers[0]?.code || 'عميل نقدي تجريبي')
      : (suppliers[0]?.name || suppliers[0]?.code || 'شركة التوريدات العامة');
    const sampleProd1 = products[0]?.code || 'PRD-001';
    const sampleProdName1 = products[0]?.name || 'صنف تجريبي رقم 1';
    const sampleProd2 = products[1]?.code || 'PRD-002';
    const sampleProdName2 = products[1]?.name || 'صنف تجريبي رقم 2';
    const sampleWarehouse = warehouses[0]?.name || warehouses[0]?.code || 'المخزن الرئيسي';
    const sampleOp = operations[0]?.operation_number || '';
    const sampleDept = departments[0]?.name || '';
    const sampleCC = costCenters[0]?.name || '';

    const headers = [
      'Ref',
      'نوع المستند',
      'التاريخ',
      'كود العميل / المورد',
      'كود الصنف / الباركود',
      'اسم الصنف',
      'المخزن',
      'الكمية',
      'السعر',
      'الخصم',
      'نسبة ضريبة القيمة المضافة %',
      'نسبة ضريبة الخصم والاضافة %',
      'طريقة الدفع',
      'ملاحظات',
      'رقم العملية',
      'الإدارة',
      'مركز التكلفة'
    ];

    const exampleRows = isSales ? [
      ['Ref-000001', 'فاتورة بيع', batchDate, sampleParty, sampleProd1, sampleProdName1, sampleWarehouse, 10, 150, 0, sampleVatRate, sampleWhtRate, 'آجل', 'فاتورة مبيعات بضاعة - صنف أول', sampleOp, sampleDept, sampleCC],
      ['Ref-000001', 'فاتورة بيع', batchDate, sampleParty, sampleProd2, sampleProdName2, sampleWarehouse, 5, 200, 20, sampleVatRate, sampleWhtRate, 'آجل', 'فاتورة مبيعات بضاعة - صنف ثانٍ لنفس الفاتورة', sampleOp, sampleDept, sampleCC],
      ['Ref-000002', 'أمر بيع', batchDate, sampleParty, sampleProd1, sampleProdName1, sampleWarehouse, 25, 145, 50, sampleVatRate, 0, 'آجل', 'أمر بيع معتمد للعميل', '', '', sampleCC],
      ['Ref-000003', 'مرتجع بيع', batchDate, sampleParty, sampleProd2, sampleProdName2, sampleWarehouse, 2, 200, 0, sampleVatRate, sampleWhtRate, 'نقدي', 'مرتجع مبيعات نقدي تالف', '', sampleDept, '']
    ] : [
      ['Ref-000001', 'فاتورة شراء', batchDate, sampleParty, sampleProd1, sampleProdName1, sampleWarehouse, 50, 120, 100, sampleVatRate, sampleWhtRate, 'آجل', 'فاتورة توريد خامات - بند أول', sampleOp, sampleDept, sampleCC],
      ['Ref-000001', 'فاتورة شراء', batchDate, sampleParty, sampleProd2, sampleProdName2, sampleWarehouse, 30, 180, 0, sampleVatRate, sampleWhtRate, 'آجل', 'فاتورة توريد خامات - بند ثانٍ', sampleOp, sampleDept, sampleCC],
      ['Ref-000002', 'أمر شراء', batchDate, sampleParty, sampleProd1, sampleProdName1, sampleWarehouse, 100, 115, 0, sampleVatRate, 0, 'آجل', 'أمر شراء معتمد للمورد', '', '', sampleCC],
      ['Ref-000003', 'مرتجع شراء', batchDate, sampleParty, sampleProd2, sampleProdName2, sampleWarehouse, 5, 180, 0, sampleVatRate, sampleWhtRate, 'آجل', 'مرتجع مشتريات لعدم مطابقة المواصفات', '', sampleDept, '']
    ];

    const dataWs = XLSX.utils.aoa_to_sheet([headers, ...exampleRows]);
    dataWs['!cols'] = [
      { wch: 15 }, // Ref
      { wch: 16 }, // Document Type
      { wch: 14 }, // Date
      { wch: 25 }, // Party
      { wch: 20 }, // Product Code
      { wch: 25 }, // Product Name
      { wch: 18 }, // Warehouse
      { wch: 10 }, // Qty
      { wch: 12 }, // Price
      { wch: 10 }, // Discount
      { wch: 16 }, // VAT %
      { wch: 16 }, // WHT %
      { wch: 14 }, // Payment Type
      { wch: 30 }, // Notes
      { wch: 18 }, // Operation Number
      { wch: 20 }, // Department
      { wch: 20 }  // Cost Center
    ];

    XLSX.utils.book_append_sheet(wb, dataWs, 'بيانات المستندات');

    const downloadFileName = isSales 
      ? `نموذج_استيراد_مستندات_البيع_${batchDate}.xlsx`
      : `نموذج_استيراد_مستندات_الشراء_${batchDate}.xlsx`;

    XLSX.writeFile(wb, downloadFileName);
    showNotification('تم تنزيل نموذج الإكسيل التجريبي بنجاح', 'success');
  };

  // Helper to inspect accounts and warehouse requirements for any product (Zero Guessing Policy)
  const getProductAccountsCheck = (prod: Product | undefined, targetVatRate: number, targetWhtRate: number) => {
    if (!prod) return null;
    const isService = prod.type === 'service' || prod.is_service === true;

    // 1. Sales / Purchases Account
    let salesAccName = '';
    let salesAccOk = false;
    if (isSales) {
      if (prod.revenue_account_id) {
        salesAccOk = true;
        salesAccName = prod.revenue_account_name || accounts.find(a => a.id === prod.revenue_account_id)?.name || 'حساب الإيراد';
      } else {
        salesAccName = 'غير مسجل بكارت الصنف';
      }
    } else {
      const purAccId = prod.cost_account_id || prod.inventory_account_id;
      if (purAccId) {
        salesAccOk = true;
        salesAccName = prod.cost_account_name || prod.inventory_account_name || accounts.find(a => a.id === purAccId)?.name || 'حساب التكلفة/المخزون';
      } else {
        salesAccName = 'غير مسجل بكارت الصنف';
      }
    }

    // 2. Cost Account
    let costAccName = '';
    let costAccOk = false;
    let costExempt = false;
    if (isService) {
      costExempt = true;
      costAccName = 'معفى (صنف خدمي)';
    } else {
      if (prod.cost_account_id) {
        costAccOk = true;
        costAccName = prod.cost_account_name || accounts.find(a => a.id === prod.cost_account_id)?.name || 'حساب تكلفة المبيعات';
      } else {
        costAccName = 'غير مسجل بكارت الصنف';
      }
    }

    // 3. Inventory Account
    let invAccName = '';
    let invAccOk = false;
    let invExempt = false;
    if (isService) {
      invExempt = true;
      invAccName = 'معفى (صنف خدمي)';
    } else {
      if (prod.inventory_account_id) {
        invAccOk = true;
        invAccName = prod.inventory_account_name || accounts.find(a => a.id === prod.inventory_account_id)?.name || 'حساب المخزون';
      } else {
        invAccName = 'غير مسجل بكارت الصنف';
      }
    }

    // 4. VAT Account
    let vatAccName = '';
    let vatAccOk = false;
    let vatExempt = false;
    if (!isVatEnabled || targetVatRate === 0) {
      vatExempt = true;
      vatAccName = !isVatEnabled ? 'الضريبة معطلة' : 'معفى (0%)';
    } else {
      const vatAccId = isSales 
        ? (prod.sales_vat_account_id || prod.vat_account_id || companySettings?.sales_vat_account_id || companySettings?.vat_account_id)
        : (prod.purchase_vat_account_id || prod.vat_account_id || companySettings?.purchase_vat_account_id || companySettings?.vat_account_id);
      if (vatAccId) {
        vatAccOk = true;
        vatAccName = (isSales ? (prod.sales_vat_account_name || prod.vat_account_name) : (prod.purchase_vat_account_name || prod.vat_account_name)) || accounts.find(a => a.id === vatAccId)?.name || 'حساب ض.ق.م';
      } else {
        vatAccName = 'غير مربوط بكارت الصنف أو الإعدادات';
      }
    }

    // 5. WHT Account
    let whtAccName = '';
    let whtAccOk = false;
    let whtExempt = false;
    if (!isWhtEnabled || targetWhtRate === 0) {
      whtExempt = true;
      whtAccName = !isWhtEnabled ? 'الخصم معطل' : 'معفى (0%)';
    } else {
      const whtAccId = isSales
        ? (prod.sales_withholding_tax_account_id || companySettings?.sales_withholding_tax_account_id)
        : (prod.purchase_withholding_tax_account_id || companySettings?.purchase_withholding_tax_account_id);
      if (whtAccId) {
        whtAccOk = true;
        whtAccName = (isSales ? prod.sales_withholding_tax_account_name : prod.purchase_withholding_tax_account_name) || accounts.find(a => a.id === whtAccId)?.name || 'حساب ض.خ.أ';
      } else {
        whtAccName = 'غير مربوط بكارت الصنف أو الإعدادات';
      }
    }

    const missingNames: string[] = [];
    if (!salesAccOk) missingNames.push(isSales ? 'حساب الإيراد' : 'حساب التكلفة');
    if (!costExempt && !costAccOk) missingNames.push('حساب تكلفة المبيعات');
    if (!invExempt && !invAccOk) missingNames.push('حساب المخزون');
    if (!vatExempt && !vatAccOk) missingNames.push('حساب ضريبة القيمة المضافة');
    if (!whtExempt && !whtAccOk) missingNames.push('حساب ضريبة الخصم');

    return {
      isService,
      sales: { ok: salesAccOk, name: salesAccName },
      cost: { ok: costAccOk || costExempt, exempt: costExempt, name: costAccName },
      inventory: { ok: invAccOk || invExempt, exempt: invExempt, name: invAccName },
      vat: { ok: vatAccOk || vatExempt, exempt: vatExempt, name: vatAccName },
      wht: { ok: whtAccOk || whtExempt, exempt: whtExempt, name: whtAccName },
      missingNames
    };
  };

  // Pre-validation helper: checks stock availability and mandatory GL accounts completeness (zero guessing policy)
  const revalidateBatch = (
    docs: ParsedDocument[],
    currentProducts: Product[],
    settings: any,
    baseErrors: ValidationError[]
  ): { updatedDocs: ParsedDocument[]; allErrors: ValidationError[] } => {
    const allowNegativeStock = settings?.allow_negative_stock === true || settings?.allow_negative_stock === 'true';

    // Remove old stock errors, warehouse errors, AND dynamic account errors to avoid stale duplicates
    const nonDynamicErrors = baseErrors.filter(e => 
      e.field !== 'رصيد المخزون' && 
      e.field !== 'المخزن' &&
      !e.field.startsWith('حساب') && 
      !e.field.includes('ضريبة')
    );
    const newStockErrors: ValidationError[] = [];
    const newAccountErrors: ValidationError[] = [];
    const newWarehouseErrors: ValidationError[] = [];

    // Track running stock per product across the batch
    const stockMap: Record<string, number> = {};
    currentProducts.forEach(p => {
      stockMap[p.id] = Number(p.stock ?? p.current_stock ?? 0);
    });

    const updatedDocs = docs.map(doc => {
      const isSalesOutflow = isSales && doc.doc_type === 'فاتورة بيع';
      const isPurchaseOutflow = !isSales && doc.doc_type === 'مرتجع شراء';
      const isOutflow = isSalesOutflow || isPurchaseOutflow;

      const isSalesInflow = isSales && doc.doc_type === 'مرتجع بيع';
      const isPurchaseInflow = !isSales && doc.doc_type === 'فاتورة شراء';
      const isInflow = isSalesInflow || isPurchaseInflow;

      let docHasStockError = false;
      let firstStockErrorMsg = '';

      let docHasAccountError = false;
      let firstAccountErrorMsg = '';

      // Check if document contains physical items (which strictly require a warehouse in the system)
      const hasPhysicalItems = doc.items.some(it => {
        const prod = currentProducts.find(p => p.id === it.product_id || (p.code && p.code.toLowerCase() === it.product_code.toLowerCase()));
        return !it.is_service && prod?.type !== 'service' && !prod?.is_service;
      });

      let docHasWarehouseError = false;
      let firstWarehouseErrorMsg = '';
      if (hasPhysicalItems && !doc.warehouse_id) {
        docHasWarehouseError = true;
        firstWarehouseErrorMsg = `المستند (${doc.ref}) يحتوي على أصناف مخزنية ولكن لم يتم تحديد مخزن للمستند`;
        newWarehouseErrors.push({
          rowNumber: doc.items[0]?.rowIndex || 1,
          ref: doc.ref,
          field: 'المخزن',
          message: `المستند "${doc.ref}" يحتوي على أصناف مخزنية ولكن لم يتم تحديد المخزن. يرجى تعديل بيانات المستند الأساسية وتحديد المخزن لحفظ الحركات المحاسبية والمخزنية.`
        });
      }

      // 1. Validate Party Account (for accounting documents: invoices and returns)
      if (doc.doc_type !== 'أمر بيع' && doc.doc_type !== 'أمر شراء') {
        let partyAccId = '';
        if (isSales) {
          const c = customers.find(x => 
            (doc.party_id && x.id === doc.party_id) || 
            (x.code && doc.party_code && x.code.toLowerCase() === doc.party_code.toLowerCase()) || 
            (x.name && doc.party_name && x.name.trim().toLowerCase() === doc.party_name.trim().toLowerCase())
          );
          partyAccId = c?.account_id || '';
          if (c) {
            doc.party_id = c.id;
            doc.party_name = c.name;
            if (c.code) doc.party_code = c.code;
          }
        } else {
          const s = suppliers.find(x => 
            (doc.party_id && x.id === doc.party_id) || 
            (x.code && doc.party_code && x.code.toLowerCase() === doc.party_code.toLowerCase()) || 
            (x.name && doc.party_name && x.name.trim().toLowerCase() === doc.party_name.trim().toLowerCase())
          );
          partyAccId = s?.account_id || '';
          if (s) {
            doc.party_id = s.id;
            doc.party_name = s.name;
            if (s.code) doc.party_code = s.code;
          }
        }

        if (!partyAccId) {
          docHasAccountError = true;
          firstAccountErrorMsg = `حساب ${entityLabel} غير مربوط في بطاقة "${doc.party_name}"`;
          newAccountErrors.push({
            rowNumber: doc.items[0]?.rowIndex || 1,
            ref: doc.ref,
            field: `حساب ${entityLabel}`,
            message: `حساب ${entityLabel} غير محدد في بطاقة "${doc.party_name}". يرجى ربط حساب ${entityLabel} في شجرة الحسابات أولاً لاستكمال الترحيل المحاسبي.`
          });
        }
      }

      // 2. Validate Items Stock & GL Accounts
      const updatedItems = doc.items.map(item => {
        const prod = currentProducts.find(p => p.id === item.product_id || (p.code && p.code.toLowerCase() === item.product_code.toLowerCase()));
        const isService = item.is_service || prod?.type === 'service' || prod?.is_service === true;

        let itemStockError = false;
        let itemStockWarning: string | undefined = undefined;
        let itemAvailable: number | undefined = undefined;

        let itemAccountError = false;
        let itemAccountWarning: string | undefined = undefined;

        // Stock verification (physical items only)
        if (!isService) {
          const available = stockMap[item.product_id] !== undefined
            ? stockMap[item.product_id]
            : Number(prod?.stock ?? prod?.current_stock ?? 0);

          if (isInflow) {
            stockMap[item.product_id] = available + item.quantity;
            itemAvailable = available;
          } else if (isOutflow) {
            if (!allowNegativeStock && item.quantity > available) {
              docHasStockError = true;
              if (!firstStockErrorMsg) {
                firstStockErrorMsg = `عجز في رصيد الصنف "${item.product_name}" (المتاح: ${formatNumber(Math.max(0, available))}، المطلوب: ${formatNumber(item.quantity)})`;
              }
              newStockErrors.push({
                rowNumber: item.rowIndex,
                ref: doc.ref,
                field: 'رصيد المخزون',
                message: `الكمية المطلوبة (${formatNumber(item.quantity)}) من الصنف "${item.product_name} (${item.product_code})" غير متوفرة في المخزن (الرصيد المتاح: ${formatNumber(Math.max(0, available))}). سياسة الشركة تمنع الصرف بالسالب.`
              });
              stockMap[item.product_id] = available - item.quantity;
              itemStockError = true;
              itemAvailable = Math.max(0, available);
              itemStockWarning = `الرصيد المتاح: ${formatNumber(Math.max(0, available))} (عجز: ${formatNumber(item.quantity - available)})`;
            } else {
              stockMap[item.product_id] = available - item.quantity;
              itemAvailable = available;
            }
          }
        }

        // Mandatory GL Accounts verification on Product Card (for financial documents: invoices & returns)
        if (doc.doc_type !== 'أمر بيع' && doc.doc_type !== 'أمر شراء' && prod) {
          const missingFields: string[] = [];

          if (isSales) {
            // Revenue / Sales Account
            if (!prod.revenue_account_id) {
              missingFields.push('حساب الإيراد/المبيعات');
              newAccountErrors.push({
                rowNumber: item.rowIndex,
                ref: doc.ref,
                field: 'حساب الإيراد',
                message: `حساب الإيراد/المبيعات غير محدد في بطاقة الصنف "${prod.name}" (${prod.code}). يمنع النظام توقع الحسابات تلقائياً.`
              });
            }

            // Sales VAT Account
            if (isVatEnabled && item.vat_rate > 0) {
              const vatAcc = prod.sales_vat_account_id || prod.vat_account_id;
              if (!vatAcc) {
                missingFields.push('حساب ضريبة المبيعات');
                newAccountErrors.push({
                  rowNumber: item.rowIndex,
                  ref: doc.ref,
                  field: 'حساب ضريبة المبيعات',
                  message: `حساب ضريبة القيمة المضافة (مبيعات) غير محدد في بطاقة الصنف "${prod.name}" (${prod.code}) بالرغم من خضوعه لضريبة ${item.vat_rate}%. يمنع النظام توقع الحسابات تلقائياً.`
                });
              }
            }

            // Sales WHT Account
            if (isWhtEnabled && item.withholding_tax_rate > 0) {
              const whtAcc = prod.sales_withholding_tax_account_id;
              if (!whtAcc) {
                missingFields.push('حساب خصم من العملاء');
                newAccountErrors.push({
                  rowNumber: item.rowIndex,
                  ref: doc.ref,
                  field: 'حساب خصم من العملاء',
                  message: `حساب ضرائب الخصم من العملاء (أ.ت.ص) غير محدد في بطاقة الصنف "${prod.name}" (${prod.code}) بالرغم من وجود خصم ${item.withholding_tax_rate}%. يمنع النظام توقع الحسابات تلقائياً.`
                });
              }
            }

            // Physical Sales Item: Cost & Inventory Accounts
            if (!isService) {
              if (!prod.cost_account_id) {
                missingFields.push('حساب تكلفة المبيعات');
                newAccountErrors.push({
                  rowNumber: item.rowIndex,
                  ref: doc.ref,
                  field: 'حساب تكلفة المبيعات',
                  message: `حساب تكلفة المبيعات غير محدد في بطاقة الصنف المخزني "${prod.name}" (${prod.code}).`
                });
              }
              if (!prod.inventory_account_id) {
                missingFields.push('حساب المخزون');
                newAccountErrors.push({
                  rowNumber: item.rowIndex,
                  ref: doc.ref,
                  field: 'حساب المخزون',
                  message: `حساب المخزون غير محدد في بطاقة الصنف المخزني "${prod.name}" (${prod.code}).`
                });
              }
            }
          } else {
            // Purchases
            if (!prod.cost_account_id && !prod.inventory_account_id) {
              missingFields.push('حساب التكلفة/المخزون');
              newAccountErrors.push({
                rowNumber: item.rowIndex,
                ref: doc.ref,
                field: 'حساب المشتريات/المخزون',
                message: `حساب التكلفة أو المخزون غير محدد في بطاقة الصنف "${prod.name}" (${prod.code}). يمنع النظام توقع الحسابات تلقائياً.`
              });
            }

            // Purchase VAT Account
            if (isVatEnabled && item.vat_rate > 0) {
              const vatAcc = prod.purchase_vat_account_id || prod.vat_account_id;
              if (!vatAcc) {
                missingFields.push('حساب ضريبة المشتريات');
                newAccountErrors.push({
                  rowNumber: item.rowIndex,
                  ref: doc.ref,
                  field: 'حساب ضريبة المشتريات',
                  message: `حساب ضريبة القيمة المضافة (مشتريات) غير محدد في بطاقة الصنف "${prod.name}" (${prod.code}) بالرغم من خضوعه لضريبة ${item.vat_rate}%. يمنع النظام توقع الحسابات تلقائياً.`
                });
              }
            }

            // Purchase WHT Account
            if (isWhtEnabled && item.withholding_tax_rate > 0) {
              const whtAcc = prod.purchase_withholding_tax_account_id;
              if (!whtAcc) {
                missingFields.push('حساب خصم على الموردين');
                newAccountErrors.push({
                  rowNumber: item.rowIndex,
                  ref: doc.ref,
                  field: 'حساب خصم على الموردين',
                  message: `حساب ضرائب الخصم على الموردين غير محدد في بطاقة الصنف "${prod.name}" (${prod.code}) بالرغم من وجود خصم ${item.withholding_tax_rate}%. يمنع النظام توقع الحسابات تلقائياً.`
                });
              }
            }

            // Physical Purchase Item: Inventory Account
            if (!isService && !prod.inventory_account_id) {
              missingFields.push('حساب المخزون');
              newAccountErrors.push({
                rowNumber: item.rowIndex,
                ref: doc.ref,
                field: 'حساب المخزون',
                message: `حساب المخزون غير محدد في بطاقة الصنف المخزني "${prod.name}" (${prod.code}).`
              });
            }
          }

          if (missingFields.length > 0) {
            itemAccountError = true;
            itemAccountWarning = `حسابات غير مكتملة في بطاقة الصنف: (${missingFields.join('، ')})`;
            docHasAccountError = true;
            if (!firstAccountErrorMsg) {
              firstAccountErrorMsg = `نقص حسابات في الصنف "${prod.name}": (${missingFields.join('، ')})`;
            }
          }
        }

        return {
          ...item,
          stock_error: itemStockError,
          available_stock: itemAvailable,
          stock_warning: itemStockWarning,
          account_error: itemAccountError,
          account_warning: itemAccountWarning
        };
      });

      return {
        ...doc,
        items: updatedItems,
        has_stock_error: docHasStockError,
        stock_error_message: firstStockErrorMsg || undefined,
        has_account_error: docHasAccountError,
        account_error_message: firstAccountErrorMsg || undefined,
        has_warehouse_error: docHasWarehouseError,
        warehouse_error_message: firstWarehouseErrorMsg || undefined
      };
    });

    return {
      updatedDocs,
      allErrors: [...nonDynamicErrors, ...newWarehouseErrors, ...newStockErrors, ...newAccountErrors]
    };
  };

  // Parse uploaded file
  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setFileName(file.name);
    setIsParsing(true);
    setValidationErrors([]);
    setDocuments([]);
    setIsBatchSaved(false);

    try {
      // Refresh products and companySettings to ensure 100% accurate up-to-date stock balances
      let currentProducts = products;
      let currentSettings = companySettings;
      try {
        if (user?.company_id) {
          const [freshProds, freshComp] = await Promise.all([
            dbService.list<Product>('products', { company_id: user.company_id }),
            dbService.get<any>('companies', user.company_id).catch(() => null)
          ]);
          if (freshProds && freshProds.length > 0) {
            setProducts(freshProds);
            currentProducts = freshProds;
          }
          if (freshComp?.settings) {
            setCompanySettings(freshComp.settings);
            currentSettings = freshComp.settings;
          }
        }
      } catch (e) {
        console.warn('Master data quick-refresh fallback:', e);
      }

      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
      
      // Look for data sheet
      let targetSheetName = wb.SheetNames[0];
      if (wb.SheetNames.includes('بيانات المستندات')) {
        targetSheetName = 'بيانات المستندات';
      } else if (wb.SheetNames.length > 1 && wb.SheetNames[0].includes('دليل')) {
        targetSheetName = wb.SheetNames[1];
      }

      const ws = wb.Sheets[targetSheetName];
      if (!ws) throw new Error('لم يتم العثور على ورقة عمل صالحة في ملف الإكسيل');

      const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (rawRows.length < 2) {
        throw new Error('ملف الإكسيل فارغ أو لا يحتوي على صفوف بيانات بعد الهيدر');
      }

      const errors: ValidationError[] = [];
      const groupedDocs: Record<string, {
        header: {
          ref: string;
          doc_type: string;
          date: string;
          party_id: string;
          party_name: string;
          party_code?: string;
          warehouse_id?: string | null;
          warehouse_name?: string;
          payment_type: 'cash' | 'credit';
          payment_method_id?: string;
          notes?: string;
        };
        items: ParsedItem[];
      }> = {};

      const validSalesTypes = ['فاتورة بيع', 'أمر بيع', 'مرتجع بيع'];
      const validPurchaseTypes = ['فاتورة شراء', 'أمر شراء', 'مرتجع شراء'];
      const expectedDocTypes = isSales ? validSalesTypes : validPurchaseTypes;

      const defaultWh = warehouses[0];

      // Dynamic header index discovery with collision prevention
      const headerRow: string[] = (rawRows[0] || []).map((h: any) => String(h || '').trim().toLowerCase());
      const usedCols = new Set<number>();

      const findColIdx = (exactMatches: string[], partialMatches: string[], fallback: number): number => {
        // 1. Check exact matches first across unused columns
        let found = headerRow.findIndex((h, idx) => !usedCols.has(idx) && exactMatches.some(e => h === e.toLowerCase()));
        if (found !== -1) {
          usedCols.add(found);
          return found;
        }
        // 2. Check partial matches across unused columns
        found = headerRow.findIndex((h, idx) => !usedCols.has(idx) && partialMatches.some(p => h.includes(p.toLowerCase())));
        if (found !== -1) {
          usedCols.add(found);
          return found;
        }
        // 3. Fallback if unused
        if (!usedCols.has(fallback) && fallback < headerRow.length) {
          usedCols.add(fallback);
          return fallback;
        }
        return fallback;
      };

      const refCol = findColIdx(['ref', 'رقم المرجع', 'مرجع', 'reference'], ['ref', 'مرجع'], 0);
      const docTypeCol = findColIdx(['نوع المستند', 'نوع مستند', 'نوع الفاتورة', 'نوع الحركة'], ['نوع المستند', 'نوع مستند', 'نوع الفاتورة', 'doc type'], 1);
      const dateCol = findColIdx(['التاريخ', 'تاريخ', 'تاريخ المستند', 'تاريخ الفاتورة'], ['تاريخ', 'التاريخ', 'date'], 2);
      const partyCol = findColIdx(
        ['كود العميل / المورد', 'كود العميل/المورد', 'كود العميل', 'اسم العميل', 'العميل', 'كود المورد', 'اسم المورد', 'المورد', 'الطرف', 'طرف'],
        ['عميل', 'مورد', 'الطرف', 'طرف', 'customer', 'supplier', 'party', 'client', 'vendor'],
        3
      );
      const prodCodeCol = findColIdx(
        ['كود الصنف / الباركود', 'كود الصنف/الباركود', 'كود الصنف', 'كود صنف', 'كود المنتج', 'كود منتج', 'باركود', 'barcode', 'item code', 'product code', 'sku'],
        ['كود الصنف', 'كود المنتج', 'باركود', 'barcode', 'item code', 'product code'],
        4
      );
      const prodNameCol = findColIdx(
        ['اسم الصنف', 'اسم صنف', 'اسم المنتج', 'اسم منتج', 'بيان الصنف', 'وصف الصنف', 'item name', 'product name', 'item_name', 'product_name'],
        ['اسم الصنف', 'اسم صنف', 'اسم المنتج', 'اسم منتج', 'بيان الصنف', 'وصف الصنف', 'item name', 'product name'],
        5
      );
      const whCol = findColIdx(['المخزن', 'المستودع', 'مخزن', 'مستودع'], ['المخزن', 'المستودع', 'مخزن', 'مستودع', 'warehouse', 'store'], 6);
      const qtyCol = findColIdx(['الكمية', 'كمية', 'qty', 'quantity'], ['الكمية', 'كمية', 'qty', 'quantity'], 7);
      const priceCol = findColIdx(['السعر', 'سعر', 'سعر الوحدة', 'price', 'unit price'], ['السعر', 'سعر', 'price'], 8);
      const discCol = findColIdx(['الخصم', 'خصم', 'discount'], ['الخصم', 'خصم', 'discount'], 9);
      const vatCol = findColIdx(
        ['نسبة ضريبة القيمة المضافة %', 'ضريبة القيمة المضافة', 'قيمة مضافة', 'ض.ق.م', 'vat', 'vat rate'],
        ['قيمة مضافة', 'ض.ق.م', 'vat'],
        10
      );
      const whtCol = findColIdx(
        ['نسبة ضريبة الخصم والاضافة %', 'ضريبة الخصم والاضافة', 'ضريبة الخصم والإضافة', 'خصم والاضافة', 'خصم وإضافة', 'ض.خ.أ', 'ض.خ', 'wht'],
        ['خصم والاضافة', 'خصم وإضافة', 'ض.خ', 'wht'],
        11
      );
      const payTypeCol = findColIdx(['طريقة الدفع', 'طريقة السداد', 'طريقة دفع', 'طريقة سداد'], ['طريقة الدفع', 'طريقة السداد', 'دفع', 'سداد'], 12);
      const notesCol = findColIdx(['ملاحظات', 'ملاحظة', 'بيان', 'notes', 'remarks'], ['ملاحظات', 'ملاحظة', 'notes'], 13);
      const opCol = findColIdx(['رقم العملية', 'العملية', 'operation'], ['رقم العملية', 'العملية', 'operation'], 14);
      const deptCol = findColIdx(['الإدارة', 'الادارة', 'إدارة', 'ادارة', 'department'], ['الإدارة', 'الادارة', 'إدارة', 'ادارة', 'department'], 15);
      const ccCol = findColIdx(['مركز التكلفة', 'مركز تكلفة', 'cost center', 'cost_center'], ['مركز التكلفة', 'مركز تكلفة', 'cost center'], 16);

      // Parse data rows (row index 0 is header)
      for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        const rowNumber = i + 1; // 1-based index in Excel

        // Ignore empty lines
        if (!row || row.every(cell => cell === '' || cell === null || cell === undefined)) {
          continue;
        }

        const rawRef = String(row[refCol] || '').trim();
        const rawDocType = String(row[docTypeCol] || '').trim();
        const rawDate = row[dateCol];
        const rawParty = String(row[partyCol] || '').trim();
        const rawProdCode = String(row[prodCodeCol] || '').trim();
        const rawProdName = String(row[prodNameCol] || '').trim();
        const rawWarehouse = String(row[whCol] || '').trim();
        const rawQty = row[qtyCol];
        const rawPrice = row[priceCol];
        const rawDiscount = row[discCol];
        const rawVatRate = row[vatCol];
        const rawWhtRate = row[whtCol];
        const rawPaymentType = String(row[payTypeCol] || '').trim();
        const rawNotes = String(row[notesCol] || '').trim();
        const rawOperation = String(row[opCol] || '').trim();
        const rawDepartment = String(row[deptCol] || '').trim();
        const rawCostCenter = String(row[ccCol] || '').trim();

        // 1. Validate Ref
        if (!rawRef) {
          errors.push({
            rowNumber,
            ref: rawRef || 'غير محدد',
            field: 'رقم المرجع (Ref)',
            message: 'رقم المرجع (Ref) إلزامي لربط بنود المستند'
          });
        }

        // 2. Validate Document Type
        if (!rawDocType) {
          errors.push({
            rowNumber,
            ref: rawRef,
            field: 'نوع المستند',
            message: 'نوع المستند إلزامي'
          });
        } else if (!expectedDocTypes.includes(rawDocType)) {
          errors.push({
            rowNumber,
            ref: rawRef,
            field: 'نوع المستند',
            message: `نوع المستند "${rawDocType}" غير صالح. الأنواع المقبولة هي: (${expectedDocTypes.join(' - ')})`
          });
        }

        // 3. Validate Date (Supports Excel serial dates like 46288, Date objects, DD/MM/YYYY and YYYY-MM-DD)
        const parsedDate = formatExcelDate(rawDate, batchDate);

        // 4. Validate Party (Customer / Supplier)
        let matchedParty: any = null;
        if (!rawParty) {
          errors.push({
            rowNumber,
            ref: rawRef,
            field: entityLabel,
            message: `كود أو اسم ${entityLabel} إلزامي`
          });
        } else {
          if (isSales) {
            matchedParty = customers.find(c => 
              (c.code && c.code.toLowerCase() === rawParty.toLowerCase()) ||
              (c.name && c.name.trim().toLowerCase() === rawParty.toLowerCase()) ||
              (c.tax_number && c.tax_number === rawParty)
            );
          } else {
            matchedParty = suppliers.find(s => 
              (s.code && s.code.toLowerCase() === rawParty.toLowerCase()) ||
              (s.name && s.name.trim().toLowerCase() === rawParty.toLowerCase()) ||
              (s.tax_number && s.tax_number === rawParty)
            );
          }

          if (!matchedParty) {
            errors.push({
              rowNumber,
              ref: rawRef,
              field: entityLabel,
              message: `${entityLabel} "${rawParty}" غير مسجل في دليل ${entityLabel}ين للنظام`
            });
          } else if (!matchedParty.account_id && rawDocType !== 'أمر بيع' && rawDocType !== 'أمر شراء') {
            errors.push({
              rowNumber,
              ref: rawRef,
              field: `حساب ${entityLabel}`,
              message: `حساب ${entityLabel} غير محدد في بطاقة "${matchedParty.name}". يرجى ربط حساب ${entityLabel} في شجرة الحسابات أولاً لاستكمال الترحيل المحاسبي.`
            });
          }
        }

        // 5. Validate Product
        let matchedProduct: Product | undefined;
        if (!rawProdCode && !rawProdName) {
          errors.push({
            rowNumber,
            ref: rawRef,
            field: 'الصنف',
            message: 'كود الصنف أو الباركود أو اسم الصنف إلزامي'
          });
        } else {
          const rawCodeClean = rawProdCode.trim().toLowerCase();
          const rawNameClean = rawProdName.trim().toLowerCase();

          matchedProduct = currentProducts.find(p => {
            const pCode = String(p.code || '').trim().toLowerCase();
            const pBarcode = String(p.barcode || '').trim().toLowerCase();
            const pName = String(p.name || '').trim().toLowerCase();

            return (
              (rawCodeClean && pCode === rawCodeClean) ||
              (rawCodeClean && pBarcode === rawCodeClean) ||
              (rawNameClean && pName === rawNameClean) ||
              (rawCodeClean && pName === rawCodeClean) ||
              (rawNameClean && pCode === rawNameClean)
            );
          });

          if (!matchedProduct) {
            errors.push({
              rowNumber,
              ref: rawRef,
              field: 'الصنف',
              message: `الصنف كود: "${rawProdCode}" اسم: "${rawProdName}" غير مسجل في دليل الأصناف`
            });
          }
        }

        // Service check: Services do NOT require warehouse and never fail on inventory
        const isServiceItem = matchedProduct?.type === 'service' || matchedProduct?.is_service === true;

        // 6. Validate Warehouse (Only for physical products)
        let matchedWarehouse: Warehouse | undefined = undefined;
        if (rawWarehouse) {
          const foundWh = warehouses.find(w => 
            w.id === rawWarehouse ||
            (w.code && w.code.toLowerCase() === rawWarehouse.toLowerCase()) ||
            (w.name && w.name.trim().toLowerCase() === rawWarehouse.toLowerCase())
          );
          if (foundWh) {
            matchedWarehouse = foundWh;
          } else {
            errors.push({
              rowNumber,
              ref: rawRef,
              field: 'المخزن',
              message: `المخزن "${rawWarehouse}" غير مسجل في دليل المستودعات`
            });
          }
        } else if (!isServiceItem) {
          // Physical product: default warehouse fallback
          matchedWarehouse = defaultWh;
          if (!matchedWarehouse) {
            errors.push({
              rowNumber,
              ref: rawRef,
              field: 'المخزن',
              message: `المخزن إلزامي للصنف المخزني "${rawProdName || rawProdCode}"`
            });
          }
        }

        // 7. Validate Quantity, Price, Discount
        const qtyNum = parseFloat(String(rawQty).replace(/,/g, ''));
        if (isNaN(qtyNum) || qtyNum <= 0) {
          errors.push({
            rowNumber,
            ref: rawRef,
            field: 'الكمية',
            message: `الكمية "${rawQty}" غير صحيحة. يجب أن تكون رقماً موجباً أكبر من صفر`
          });
        }

        const priceNum = parseFloat(String(rawPrice !== '' && rawPrice !== undefined ? rawPrice : (matchedProduct?.sale_price || matchedProduct?.cost_price || 0)).replace(/,/g, ''));
        if (isNaN(priceNum) || priceNum < 0) {
          errors.push({
            rowNumber,
            ref: rawRef,
            field: 'السعر',
            message: `السعر "${rawPrice}" غير صحيح. يجب أن يكون رقماً أكبر من أو يساوي صفر`
          });
        }

        const discountNum = parseFloat(String(rawDiscount || 0).replace(/,/g, '')) || 0;
        if (discountNum < 0) {
          errors.push({
            rowNumber,
            ref: rawRef,
            field: 'الخصم',
            message: `قيمة الخصم "${rawDiscount}" لا يمكن أن تكون سالبة`
          });
        }

        // 8. Tax rates respecting company settings
        let vatRateNum = 0;
        if (isVatEnabled) {
          vatRateNum = rawVatRate !== '' && rawVatRate !== undefined 
            ? (parseFloat(String(rawVatRate)) || 0)
            : (parseFloat(String(isSales ? matchedProduct?.vat_rate : matchedProduct?.purchase_vat_rate)) || 14);
        }

        let whtRateNum = 0;
        if (isWhtEnabled) {
          whtRateNum = rawWhtRate !== '' && rawWhtRate !== undefined
            ? (parseFloat(String(rawWhtRate)) || 0)
            : (parseFloat(String(isSales ? matchedProduct?.sales_withholding_tax_rate : matchedProduct?.purchase_withholding_tax_rate)) || 0);
        }

        // 8.1 Mandatory GL Accounts verification on Product Card (zero guessing policy)
        if (matchedProduct && rawDocType !== 'أمر بيع' && rawDocType !== 'أمر شراء') {
          if (isSales) {
            // Revenue account
            if (!matchedProduct.revenue_account_id) {
              errors.push({
                rowNumber,
                ref: rawRef,
                field: 'حساب الإيراد',
                message: `حساب الإيراد/المبيعات غير محدد في بطاقة الصنف "${matchedProduct.name}" (${matchedProduct.code || rawProdCode}). يمنع النظام توقع الحسابات تلقائياً.`
              });
            }

            // Sales VAT account
            if (isVatEnabled && vatRateNum > 0) {
              const vatAcc = matchedProduct.sales_vat_account_id || matchedProduct.vat_account_id;
              if (!vatAcc) {
                errors.push({
                  rowNumber,
                  ref: rawRef,
                  field: 'حساب ضريبة المبيعات',
                  message: `حساب ضريبة القيمة المضافة (مبيعات) غير محدد في بطاقة الصنف "${matchedProduct.name}" (${matchedProduct.code || rawProdCode}) بالرغم من خضوعه لضريبة ${vatRateNum}%. يمنع النظام توقع الحسابات تلقائياً.`
                });
              }
            }

            // Sales WHT account
            if (isWhtEnabled && whtRateNum > 0) {
              const whtAcc = matchedProduct.sales_withholding_tax_account_id;
              if (!whtAcc) {
                errors.push({
                  rowNumber,
                  ref: rawRef,
                  field: 'حساب خصم من العملاء',
                  message: `حساب ضرائب الخصم من العملاء (أ.ت.ص) غير محدد في بطاقة الصنف "${matchedProduct.name}" (${matchedProduct.code || rawProdCode}) بالرغم من وجود خصم ${whtRateNum}%. يمنع النظام توقع الحسابات تلقائياً.`
                });
              }
            }

            // Physical item: Cost and Inventory accounts
            if (!isServiceItem) {
              if (!matchedProduct.cost_account_id) {
                errors.push({
                  rowNumber,
                  ref: rawRef,
                  field: 'حساب تكلفة المبيعات',
                  message: `حساب تكلفة المبيعات غير محدد في بطاقة الصنف المخزني "${matchedProduct.name}" (${matchedProduct.code || rawProdCode}).`
                });
              }
              if (!matchedProduct.inventory_account_id) {
                errors.push({
                  rowNumber,
                  ref: rawRef,
                  field: 'حساب المخزون',
                  message: `حساب المخزون غير محدد في بطاقة الصنف المخزني "${matchedProduct.name}" (${matchedProduct.code || rawProdCode}).`
                });
              }
            }
          } else {
            // Purchases
            if (!matchedProduct.cost_account_id && !matchedProduct.inventory_account_id) {
              errors.push({
                rowNumber,
                ref: rawRef,
                field: 'حساب المشتريات/المخزون',
                message: `حساب التكلفة أو المخزون غير محدد في بطاقة الصنف "${matchedProduct.name}" (${matchedProduct.code || rawProdCode}). يمنع النظام توقع الحسابات تلقائياً.`
              });
            }

            // Purchase VAT account
            if (isVatEnabled && vatRateNum > 0) {
              const vatAcc = matchedProduct.purchase_vat_account_id || matchedProduct.vat_account_id;
              if (!vatAcc) {
                errors.push({
                  rowNumber,
                  ref: rawRef,
                  field: 'حساب ضريبة المشتريات',
                  message: `حساب ضريبة القيمة المضافة (مشتريات) غير محدد في بطاقة الصنف "${matchedProduct.name}" (${matchedProduct.code || rawProdCode}) بالرغم من خضوعه لضريبة ${vatRateNum}%. يمنع النظام توقع الحسابات تلقائياً.`
                });
              }
            }

            // Purchase WHT account
            if (isWhtEnabled && whtRateNum > 0) {
              const whtAcc = matchedProduct.purchase_withholding_tax_account_id;
              if (!whtAcc) {
                errors.push({
                  rowNumber,
                  ref: rawRef,
                  field: 'حساب خصم على الموردين',
                  message: `حساب ضرائب الخصم على الموردين غير محدد في بطاقة الصنف "${matchedProduct.name}" (${matchedProduct.code || rawProdCode}) بالرغم من وجود خصم ${whtRateNum}%. يمنع النظام توقع الحسابات تلقائياً.`
                });
              }
            }

            // Physical item: Inventory account
            if (!isServiceItem && !matchedProduct.inventory_account_id) {
              errors.push({
                rowNumber,
                ref: rawRef,
                field: 'حساب المخزون',
                message: `حساب المخزون غير محدد في بطاقة الصنف المخزني "${matchedProduct.name}" (${matchedProduct.code || rawProdCode}).`
              });
            }
          }
        }

        // Payment type parsing
        const paymentType: 'cash' | 'credit' = (rawPaymentType === 'نقدي' || rawPaymentType.toLowerCase() === 'cash') ? 'cash' : 'credit';

        // Calculation of line
        const lineGross = (qtyNum || 0) * (priceNum || 0);
        const lineSubtotal = Math.max(0, lineGross - discountNum);
        const lineVat = Number(((lineSubtotal * vatRateNum) / 100).toFixed(2));
        const lineWht = Number(((lineSubtotal * whtRateNum) / 100).toFixed(2));
        const lineTotal = Number((lineSubtotal + lineVat - lineWht).toFixed(2));

        // Group into documents by rawRef
        if (rawRef) {
          if (!groupedDocs[rawRef]) {
            groupedDocs[rawRef] = {
              header: {
                ref: rawRef,
                doc_type: rawDocType,
                date: parsedDate,
                party_id: matchedParty?.id || '',
                party_name: matchedParty?.name || rawParty,
                party_code: matchedParty?.code,
                warehouse_id: matchedWarehouse?.id || null,
                warehouse_name: matchedWarehouse?.name || '',
                payment_type: paymentType,
                payment_method_id: paymentMethods[0]?.id || '',
                notes: rawNotes
              },
              items: []
            };
          } else {
            // Keep warehouse from any row if not yet set
            if (matchedWarehouse && !groupedDocs[rawRef].header.warehouse_id) {
              groupedDocs[rawRef].header.warehouse_id = matchedWarehouse.id;
              groupedDocs[rawRef].header.warehouse_name = matchedWarehouse.name;
            }

            // Check cross-row consistency for the same Ref
            const existingHeader = groupedDocs[rawRef].header;
            if (rawDocType && existingHeader.doc_type !== rawDocType) {
              errors.push({
                rowNumber,
                ref: rawRef,
                field: 'نوع المستند',
                message: `تعارض في نوع المستند للمرجع "${rawRef}": تم تحديد "${existingHeader.doc_type}" في سطر سابق و "${rawDocType}" في هذا السطر`
              });
            }
            if (matchedParty && existingHeader.party_id && existingHeader.party_id !== matchedParty.id) {
              errors.push({
                rowNumber,
                ref: rawRef,
                field: entityLabel,
                message: `تعارض في اسم ${entityLabel} لنفس المرجع "${rawRef}": (${existingHeader.party_name} مقابل ${matchedParty.name})`
              });
            }
          }

          if (matchedProduct && qtyNum > 0) {
            // Optional Operation matching
            let matchedOp: Operation | undefined = undefined;
            if (rawOperation) {
              matchedOp = operations.find(o => 
                (o.operation_number && o.operation_number.toLowerCase() === rawOperation.toLowerCase()) ||
                o.id === rawOperation ||
                (o.description && o.description.toLowerCase().includes(rawOperation.toLowerCase()))
              );
            }

            // Optional Department matching
            let matchedDept: Department | undefined = undefined;
            if (rawDepartment) {
              matchedDept = departments.find(d => 
                (d.name && d.name.trim().toLowerCase() === rawDepartment.toLowerCase()) ||
                (d.code && d.code.toLowerCase() === rawDepartment.toLowerCase()) ||
                d.id === rawDepartment
              );
            }

            // Optional Cost Center matching
            let matchedCostCenter: CostCenter | undefined = undefined;
            if (rawCostCenter) {
              matchedCostCenter = costCenters.find(c => 
                (c.name && c.name.trim().toLowerCase() === rawCostCenter.toLowerCase()) ||
                (c.code && c.code.toLowerCase() === rawCostCenter.toLowerCase()) ||
                c.id === rawCostCenter
              );
            }

            groupedDocs[rawRef].items.push({
              id: 'temp-' + rowNumber + '-' + Math.random().toString(36).substr(2, 9),
              rowIndex: rowNumber,
              product_id: matchedProduct.id,
              product_code: matchedProduct.code || rawProdCode,
              product_name: matchedProduct.name || rawProdName,
              unit: matchedProduct.unit || 'قطعة',
              quantity: qtyNum,
              unit_price: priceNum,
              discount_amount: discountNum,
              subtotal: lineSubtotal,
              vat_rate: vatRateNum,
              vat_amount: lineVat,
              withholding_tax_rate: whtRateNum,
              withholding_tax_amount: lineWht,
              total: lineTotal,
              description: rawNotes,
              is_service: isServiceItem,
              operation_id: matchedOp?.id || null,
              operation_number: matchedOp?.operation_number || (rawOperation ? rawOperation : undefined),
              department_id: matchedDept?.id || null,
              department_name: matchedDept?.name || (rawDepartment ? rawDepartment : undefined),
              cost_center_id: matchedCostCenter?.id || null,
              cost_center_name: matchedCostCenter?.name || (rawCostCenter ? rawCostCenter : undefined)
            });
          }
        }
      }

      // Convert grouped documents to list and calculate totals
      const docsList: ParsedDocument[] = Object.values(groupedDocs).map(g => {
        const totals = recalculateDocTotals(g.items);
        const allServices = g.items.length > 0 && g.items.every(it => it.is_service === true);

        return {
          ref: g.header.ref,
          doc_type: g.header.doc_type,
          date: g.header.date,
          party_id: g.header.party_id,
          party_name: g.header.party_name,
          party_code: g.header.party_code,
          warehouse_id: allServices ? null : (g.header.warehouse_id || defaultWh?.id || null),
          warehouse_name: allServices ? 'خدمات (بدون مخزن)' : (g.header.warehouse_name || defaultWh?.name || ''),
          payment_type: g.header.payment_type,
          payment_method_id: g.header.payment_method_id,
          notes: g.header.notes,
          items: g.items,
          is_all_services: allServices,
          ...totals,
          status: 'pending'
        };
      });

      // Pre-validate stock across batch documents before allowing saving
      const { updatedDocs, allErrors } = revalidateBatch(docsList, currentProducts, currentSettings, errors);

      setDocuments(updatedDocs);
      setValidationErrors(allErrors);

      // Expand all by default
      const initialExp: Record<string, boolean> = {};
      updatedDocs.forEach(d => { initialExp[d.ref] = true; });
      setExpandedRefs(initialExp);

      const stockErrorsCount = allErrors.filter(e => e.field === 'رصيد المخزون').length;
      if (allErrors.length > 0) {
        if (stockErrorsCount > 0) {
          showNotification(`تم فحص الملف: تم العثور على ${allErrors.length} ملاحظة (منها ${stockErrorsCount} عجز مخزون يمنع الحفظ)`, 'error');
        } else {
          showNotification(`تم فحص الملف: تم العثور على ${allErrors.length} خطأ بحاجة لمراجعة`, 'error');
        }
      } else {
        showNotification(`تم فحص ومطابقة الملف بنجاح! تم استخراج ${updatedDocs.length} مستند صالح وجاهز للحفظ`, 'success');
      }

    } catch (err: any) {
      console.error('File parsing error:', err);
      showNotification('فشل تحليل ملف الإكسيل: ' + err.message, 'error');
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Toggle expand
  const toggleDocExpand = (ref: string) => {
    setExpandedRefs(prev => ({
      ...prev,
      [ref]: !prev[ref]
    }));
  };

  // Delete single document
  const handleDeleteDocument = (ref: string) => {
    const remaining = documents.filter(d => d.ref !== ref);
    const { updatedDocs, allErrors } = revalidateBatch(
      remaining, 
      products, 
      companySettings, 
      validationErrors.filter(e => e.ref !== ref)
    );
    setDocuments(updatedDocs);
    setValidationErrors(allErrors);
    showNotification(`تم حذف المستند ${ref} من الدفعة وإعادة فحص المخزون`, 'info');
  };

  // Open Edit Document Header Modal (Requirement 2)
  const handleOpenEditDocModal = (doc: ParsedDocument) => {
    setEditingDoc(doc);
    setEditDocForm({
      doc_type: doc.doc_type,
      date: doc.date,
      party_id: doc.party_id || '',
      warehouse_id: doc.warehouse_id || '',
      payment_type: doc.payment_type || 'credit',
      payment_method_id: doc.payment_method_id || '',
      notes: doc.notes || '',
      ref: doc.ref
    });
  };

  // Save Document Header Edit (Requirement 2)
  const handleSaveDocEdit = () => {
    if (!editingDoc) return;
    const matchedParty = isSales 
      ? customers.find(c => c.id === editDocForm.party_id)
      : suppliers.find(s => s.id === editDocForm.party_id);
    const matchedWh = warehouses.find(w => w.id === editDocForm.warehouse_id);

    const updated = documents.map(doc => {
      if (doc.ref !== editingDoc.ref) return doc;
      return {
        ...doc,
        doc_type: editDocForm.doc_type,
        date: editDocForm.date,
        party_id: editDocForm.party_id,
        party_name: matchedParty?.name || doc.party_name,
        party_code: matchedParty?.code || doc.party_code,
        warehouse_id: editDocForm.warehouse_id || null,
        warehouse_name: matchedWh?.name || (editDocForm.warehouse_id ? doc.warehouse_name : undefined),
        payment_type: editDocForm.payment_type,
        payment_method_id: editDocForm.payment_type === 'cash' ? editDocForm.payment_method_id : undefined,
        notes: editDocForm.notes,
        is_modified: true,
        status: (doc.status === 'saved' ? 'pending' : doc.status) as any
      };
    });

    const { updatedDocs, allErrors } = revalidateBatch(updated, products, companySettings, validationErrors);
    setDocuments(updatedDocs);
    setValidationErrors(allErrors);
    setIsBatchSaved(false);
    setEditingDoc(null);
    showNotification('تم تحديث بيانات المستند الأساسية وإعادة الفحص بنجاح', 'success');
  };

  // Delete item from document
  const handleDeleteItem = (docRef: string, itemId: string) => {
    const updated = documents.map(doc => {
      if (doc.ref !== docRef) return doc;
      const newItems = doc.items.filter(it => it.id !== itemId);
      const newTotals = recalculateDocTotals(newItems);
      return {
        ...doc,
        items: newItems,
        ...newTotals,
        is_modified: true,
        status: (doc.status === 'saved' ? 'pending' : doc.status) as any
      };
    }).filter(doc => doc.items.length > 0);

    const { updatedDocs, allErrors } = revalidateBatch(updated, products, companySettings, validationErrors);
    setDocuments(updatedDocs);
    setValidationErrors(allErrors);
    setIsBatchSaved(false);
    showNotification('تم حذف البند وإعادة فحص رصيد المخزون', 'info');
  };

  // Update item in document
  const handleSaveItemEdit = (updatedItem: ParsedItem) => {
    if (!editingItem) return;
    const { docRef } = editingItem;

    const lineGross = (updatedItem.quantity || 0) * (updatedItem.unit_price || 0);
    const lineSubtotal = Math.max(0, lineGross - (updatedItem.discount_amount || 0));
    const effectiveVatRate = isVatEnabled ? updatedItem.vat_rate : 0;
    const effectiveWhtRate = isWhtEnabled ? updatedItem.withholding_tax_rate : 0;
    const lineVat = Number(((lineSubtotal * effectiveVatRate) / 100).toFixed(2));
    const lineWht = Number(((lineSubtotal * effectiveWhtRate) / 100).toFixed(2));
    const lineTotal = Number((lineSubtotal + lineVat - lineWht).toFixed(2));

    const finalItem: ParsedItem = {
      ...updatedItem,
      vat_rate: effectiveVatRate,
      withholding_tax_rate: effectiveWhtRate,
      subtotal: lineSubtotal,
      vat_amount: lineVat,
      withholding_tax_amount: lineWht,
      total: lineTotal
    };

    const updated = documents.map(doc => {
      if (doc.ref !== docRef) return doc;
      const newItems = doc.items.map(it => it.id === finalItem.id ? finalItem : it);
      const newTotals = recalculateDocTotals(newItems);
      return {
        ...doc,
        items: newItems,
        ...newTotals,
        is_modified: true,
        status: (doc.status === 'saved' ? 'pending' : doc.status) as any
      };
    });

    const { updatedDocs, allErrors } = revalidateBatch(updated, products, companySettings, validationErrors);
    setDocuments(updatedDocs);
    setValidationErrors(allErrors);
    setIsBatchSaved(false);

    setEditingItem(null);
    showNotification('تم تحديث بيانات الصنف وإعادة فحص رصيد المخزون بنجاح', 'success');
  };

  // Open Add Item Modal (Requirement 3: Check warehouse & accounts)
  const handleOpenAddItemModal = (docRef: string) => {
    const targetDoc = documents.find(d => d.ref === docRef);
    setAddingItemWarehouseId(targetDoc?.warehouse_id || '');

    const defaultProd = products[0];
    const defaultPrice = isSales 
      ? (defaultProd?.sale_price || defaultProd?.cost_price || 0) 
      : (defaultProd?.cost_price || defaultProd?.sale_price || 0);
    const defaultVat = isVatEnabled 
      ? (parseFloat(String(isSales ? defaultProd?.vat_rate : defaultProd?.purchase_vat_rate)) || 14) 
      : 0;
    const defaultWht = isWhtEnabled 
      ? (parseFloat(String(isSales ? defaultProd?.sales_withholding_tax_rate : defaultProd?.purchase_withholding_tax_rate)) || 0) 
      : 0;

    setNewItemForm({
      product_id: defaultProd?.id || '',
      quantity: 1,
      unit_price: Number(defaultPrice) || 0,
      discount_amount: 0,
      vat_rate: defaultVat,
      withholding_tax_rate: defaultWht,
      operation_id: '',
      department_id: '',
      cost_center_id: '',
      description: ''
    });
    setAddingItemDocRef(docRef);
  };

  // Change product in Add Item Modal
  const handleProductChangeInNewItem = (prodId: string) => {
    const prod = products.find(p => p.id === prodId);
    if (!prod) return;
    const price = isSales 
      ? (prod.sale_price || prod.cost_price || 0) 
      : (prod.cost_price || prod.sale_price || 0);
    const vat = isVatEnabled 
      ? (parseFloat(String(isSales ? prod.vat_rate : prod.purchase_vat_rate)) || 14) 
      : 0;
    const wht = isWhtEnabled 
      ? (parseFloat(String(isSales ? prod.sales_withholding_tax_rate : prod.purchase_withholding_tax_rate)) || 0) 
      : 0;

    setNewItemForm(prev => ({
      ...prev,
      product_id: prodId,
      unit_price: Number(price) || 0,
      vat_rate: vat,
      withholding_tax_rate: wht
    }));
  };

  // Save newly added item into document (Requirement 3)
  const handleSaveNewItem = () => {
    if (!addingItemDocRef) return;
    const targetDoc = documents.find(d => d.ref === addingItemDocRef);
    if (!targetDoc) return;

    const matchedProduct = products.find(p => p.id === newItemForm.product_id);
    if (!matchedProduct) {
      showNotification('يرجى اختيار صنف صحيح من القائمة', 'error');
      return;
    }
    if (!newItemForm.quantity || newItemForm.quantity <= 0) {
      showNotification('يجب أن تكون الكمية أكبر من صفر', 'error');
      return;
    }

    const isServiceItem = matchedProduct.type === 'service' || matchedProduct.is_service === true;
    const isPhysicalItem = !isServiceItem;

    // Check if item is physical and document lacks a warehouse
    if (isPhysicalItem && !targetDoc.warehouse_id && !addingItemWarehouseId) {
      showNotification('يرجى اختيار مخزن للمستند، فالصنف المختار صنف مخزني يتطلب وجود مخزن محدد في المستند', 'error');
      return;
    }

    const lineGross = (newItemForm.quantity || 0) * (newItemForm.unit_price || 0);
    const lineSubtotal = Math.max(0, lineGross - (newItemForm.discount_amount || 0));
    const effectiveVat = isVatEnabled ? (newItemForm.vat_rate || 0) : 0;
    const effectiveWht = isWhtEnabled ? (newItemForm.withholding_tax_rate || 0) : 0;
    const lineVat = Number(((lineSubtotal * effectiveVat) / 100).toFixed(2));
    const lineWht = Number(((lineSubtotal * effectiveWht) / 100).toFixed(2));
    const lineTotal = Number((lineSubtotal + lineVat - lineWht).toFixed(2));

    const matchedOp = operations.find(o => o.id === newItemForm.operation_id);
    const matchedDept = departments.find(d => d.id === newItemForm.department_id);
    const matchedCc = costCenters.find(c => c.id === newItemForm.cost_center_id);

    const newItem: ParsedItem = {
      id: 'item-added-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
      rowIndex: targetDoc.items.length + 1,
      product_id: matchedProduct.id,
      product_code: matchedProduct.code || '',
      product_name: matchedProduct.name || '',
      unit: matchedProduct.unit || 'قطعة',
      quantity: newItemForm.quantity,
      unit_price: newItemForm.unit_price,
      discount_amount: newItemForm.discount_amount,
      subtotal: lineSubtotal,
      vat_rate: effectiveVat,
      vat_amount: lineVat,
      withholding_tax_rate: effectiveWht,
      withholding_tax_amount: lineWht,
      total: lineTotal,
      description: newItemForm.description || '',
      is_service: isServiceItem,
      operation_id: matchedOp?.id || null,
      operation_number: matchedOp?.operation_number,
      department_id: matchedDept?.id || null,
      department_name: matchedDept?.name,
      cost_center_id: matchedCc?.id || null,
      cost_center_name: matchedCc?.name
    };

    const chosenWarehouseId = addingItemWarehouseId || targetDoc.warehouse_id || null;
    const chosenWarehouseName = chosenWarehouseId 
      ? (warehouses.find(w => w.id === chosenWarehouseId)?.name || targetDoc.warehouse_name) 
      : targetDoc.warehouse_name;

    const updatedDocs = documents.map(d => {
      if (d.ref !== addingItemDocRef) return d;
      const newItems = [...d.items, newItem];
      const newTotals = recalculateDocTotals(newItems);
      const allServices = newItems.every(it => it.is_service === true);
      return {
        ...d,
        warehouse_id: chosenWarehouseId,
        warehouse_name: chosenWarehouseName,
        items: newItems,
        is_all_services: allServices,
        ...newTotals,
        is_modified: true,
        status: (d.status === 'saved' ? 'pending' : d.status) as any
      };
    });

    const { updatedDocs: revalidated, allErrors } = revalidateBatch(updatedDocs, products, companySettings, validationErrors);
    setDocuments(revalidated);
    setValidationErrors(allErrors);
    setIsBatchSaved(false);
    setExpandedRefs(prev => ({ ...prev, [addingItemDocRef]: true }));
    setAddingItemDocRef(null);
    showNotification(`تمت إضافة الصنف "${matchedProduct.name}" إلى المستند ${addingItemDocRef} بنجاح`, 'success');
  };

  // Save & Post batch
  const handleSaveAndPostBatch = async () => {
    if (documents.length === 0) {
      showNotification('لا توجد مستندات صالحة للحفظ', 'error');
      return;
    }
    if (validationErrors.length > 0) {
      showNotification('يرجى معالجة الأخطاء الموضحة أدناه قبل الحفظ والترحيل', 'error');
      return;
    }

    const unsavedDocs = documents.filter(d => d.status !== 'saved' || d.is_modified);
    if (unsavedDocs.length === 0) {
      showNotification('جميع المستندات في هذه الدفعة محفوظة ومرحلة بالكامل بدون أي تعديلات معلقة', 'info');
      return;
    }

    if (!confirm(`هل أنت متأكد من حفظ وترحيل عدد ${unsavedDocs.length} مستند بتشغيلة رقم ${batchNumber} إلى النظام المحاسبي؟`)) {
      return;
    }

    setIsSavingBatch(true);
    setSaveProgress({ current: 0, total: unsavedDocs.length, statusText: 'بدء الترحيل المحاسبي للدفعة...' });

    const updatedDocuments = [...documents];
    let newlySavedCount = 0;
    let failedCount = 0;

    for (let idx = 0; idx < updatedDocuments.length; idx++) {
      const doc = updatedDocuments[idx];
      
      // Skip already saved documents that have no pending edits
      if (doc.status === 'saved' && !doc.is_modified) {
        continue;
      }

      setSaveProgress({ 
        current: newlySavedCount + failedCount + 1, 
        total: unsavedDocs.length, 
        statusText: `جاري حفظ المستند (${doc.ref}) - ${doc.doc_type}...` 
      });

      try {
        let createdDocId = '';
        let createdDocNumber = '';
        let createdJournalId = '';
        let createdJournalNumber = '';

        // Resolve party reliably
        let effectivePartyId = doc.party_id;
        let effectivePartyName = doc.party_name;
        if (isSales) {
          const c = customers.find(x => 
            (effectivePartyId && x.id === effectivePartyId) || 
            (effectivePartyName && x.name?.trim().toLowerCase() === effectivePartyName.trim().toLowerCase()) ||
            (doc.party_code && x.code?.toLowerCase() === doc.party_code.toLowerCase())
          );
          if (c) {
            effectivePartyId = c.id;
            effectivePartyName = c.name;
          }
        } else {
          const s = suppliers.find(x => 
            (effectivePartyId && x.id === effectivePartyId) || 
            (effectivePartyName && x.name?.trim().toLowerCase() === effectivePartyName.trim().toLowerCase()) ||
            (doc.party_code && x.code?.toLowerCase() === doc.party_code.toLowerCase())
          );
          if (s) {
            effectivePartyId = s.id;
            effectivePartyName = s.name;
          }
        }

        // Resolve warehouse reliably
        let effectiveWarehouseId = doc.warehouse_id;
        let effectiveWarehouseName = doc.warehouse_name;
        if (!effectiveWarehouseId && effectiveWarehouseName) {
          const wh = warehouses.find(w => w.name?.trim().toLowerCase() === effectiveWarehouseName.trim().toLowerCase());
          if (wh) {
            effectiveWarehouseId = wh.id;
            effectiveWarehouseName = wh.name;
          }
        }

        // Standard items payload for invoices & orders
        const itemsPayload = doc.items.map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          product_code: item.product_code,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount: item.discount_amount,
          discount_amount: item.discount_amount,
          vat_rate: item.vat_rate,
          vat_amount: item.vat_amount,
          withholding_tax_rate: item.withholding_tax_rate,
          withholding_tax_amount: item.withholding_tax_amount,
          total: item.total,
          unit: item.unit,
          description: item.description || '',
          operation_id: item.operation_id || null,
          department_id: item.department_id || null,
          cost_center_id: item.cost_center_id || null
        }));

        // Clean return items payload (no vat_rate/vat_amount as returns tables lack them in DB)
        const returnItemsPayload = doc.items.map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          product_code: item.product_code,
          quantity: item.quantity,
          unit_price: item.unit_price,
          withholding_tax_rate: item.withholding_tax_rate,
          withholding_tax_amount: item.withholding_tax_amount,
          total: item.total,
          unit: item.unit,
          description: item.description || '',
          operation_id: item.operation_id || null,
          department_id: item.department_id || null,
          cost_center_id: item.cost_center_id || null
        }));

        if (doc.doc_type === 'فاتورة بيع') {
          const invPayload = {
            customer_id: effectivePartyId,
            customer_name: effectivePartyName,
            warehouse_id: effectiveWarehouseId || null,
            date: doc.date,
            subtotal: doc.subtotal,
            discount_amount: doc.discount_amount,
            tax_amount: doc.tax_amount,
            withholding_tax_amount: doc.withholding_tax_amount,
            total_amount: doc.total_amount,
            payment_type: doc.payment_type,
            payment_method_id: doc.payment_type === 'cash' ? doc.payment_method_id : null,
            notes: doc.notes || '',
            description: `استيراد مبيعات تشغيلة: ${batchNumber} - مرجع: ${doc.ref}`,
            batch_number: batchNumber,
            items: itemsPayload
          };

          let fullInv: any;
          if (doc.created_document_id) {
            // Update existing invoice
            await apiRequest(`/invoices/${doc.created_document_id}`, 'PUT', invPayload);
            createdDocId = doc.created_document_id;
            createdDocNumber = doc.created_document_number || `INV-${createdDocId.slice(-6)}`;
            fullInv = { ...invPayload, id: createdDocId, invoice_number: createdDocNumber };
          } else {
            // Create new invoice
            const invRes: any = await apiRequest('/invoices', 'POST', invPayload);
            createdDocId = invRes.id;
            createdDocNumber = invRes.invoice_number || `INV-${createdDocId.slice(-6)}`;
            fullInv = { ...invPayload, id: createdDocId, invoice_number: createdDocNumber };
          }

          const journalData = PostingService.generateInvoiceJournal(
            fullInv as any,
            customers,
            products,
            accounts,
            paymentMethods,
            companySettings
          );

          const je = await saveOrUpdateJournalEntry(
            journalData,
            createdDocId,
            doc.created_journal_id,
            doc.created_journal_number,
            user?.company_id
          );
          createdJournalId = je.id;
          createdJournalNumber = je.entry_number;

        } else if (doc.doc_type === 'أمر بيع') {
          const soPayload = {
            customer_id: effectivePartyId,
            customer_name: effectivePartyName,
            warehouse_id: effectiveWarehouseId || null,
            date: doc.date,
            subtotal: doc.subtotal,
            discount_amount: doc.discount_amount,
            tax_amount: doc.tax_amount,
            total_amount: doc.total_amount,
            notes: doc.notes || '',
            description: `استيراد أمر بيع تشغيلة: ${batchNumber} - مرجع: ${doc.ref}`,
            batch_number: batchNumber,
            status: 'draft',
            items: itemsPayload
          };

          if (doc.created_document_id) {
            await apiRequest(`/sales_orders/${doc.created_document_id}`, 'PUT', soPayload);
            createdDocId = doc.created_document_id;
            createdDocNumber = doc.created_document_number || `SO-${createdDocId.slice(-6)}`;
          } else {
            const soRes: any = await apiRequest('/sales_orders', 'POST', soPayload);
            createdDocId = soRes.id;
            createdDocNumber = soRes.order_number || `SO-${createdDocId.slice(-6)}`;
          }

        } else if (doc.doc_type === 'مرتجع بيع') {
          // Note: returns table only stores total_amount and withholding_tax_amount
          const retPayload = {
            customer_id: effectivePartyId,
            customer_name: effectivePartyName,
            warehouse_id: effectiveWarehouseId || null,
            date: doc.date,
            withholding_tax_amount: doc.withholding_tax_amount,
            total_amount: doc.total_amount,
            payment_type: doc.payment_type,
            payment_method_id: doc.payment_type === 'cash' ? doc.payment_method_id : null,
            notes: doc.notes || '',
            description: `استيراد مرتجع بيع تشغيلة: ${batchNumber} - مرجع: ${doc.ref}`,
            batch_number: batchNumber,
            items: returnItemsPayload
          };

          let fullRet: any;
          if (doc.created_document_id) {
            await apiRequest(`/returns/${doc.created_document_id}`, 'PUT', retPayload);
            createdDocId = doc.created_document_id;
            createdDocNumber = doc.created_document_number || `RET-${createdDocId.slice(-6)}`;
            fullRet = { ...retPayload, id: createdDocId, return_number: createdDocNumber };
          } else {
            const retRes: any = await apiRequest('/returns', 'POST', retPayload);
            createdDocId = retRes.id;
            createdDocNumber = retRes.return_number || `RET-${createdDocId.slice(-6)}`;
            fullRet = { ...retPayload, id: createdDocId, return_number: createdDocNumber };
          }

          // Generate Journal Entry for Return
          const journalData = PostingService.generateReturnJournal(
            fullRet as any,
            customers,
            products,
            accounts,
            paymentMethods
          );

          const je = await saveOrUpdateJournalEntry(
            journalData,
            createdDocId,
            doc.created_journal_id,
            doc.created_journal_number,
            user?.company_id
          );
          createdJournalId = je.id;
          createdJournalNumber = je.entry_number;

        } else if (doc.doc_type === 'فاتورة شراء') {
          const pinvPayload = {
            supplier_id: effectivePartyId,
            supplier_name: effectivePartyName,
            warehouse_id: effectiveWarehouseId || null,
            date: doc.date,
            subtotal: doc.subtotal,
            discount_amount: doc.discount_amount,
            tax_amount: doc.tax_amount,
            withholding_tax_amount: doc.withholding_tax_amount,
            total_amount: doc.total_amount,
            payment_type: doc.payment_type,
            payment_method_id: doc.payment_type === 'cash' ? doc.payment_method_id : null,
            notes: doc.notes || '',
            description: `استيراد مشتريات تشغيلة: ${batchNumber} - مرجع: ${doc.ref}`,
            batch_number: batchNumber,
            items: itemsPayload
          };

          let fullPinv: any;
          if (doc.created_document_id) {
            await apiRequest(`/purchase_invoices/${doc.created_document_id}`, 'PUT', pinvPayload);
            createdDocId = doc.created_document_id;
            createdDocNumber = doc.created_document_number || `PINV-${createdDocId.slice(-6)}`;
            fullPinv = { ...pinvPayload, id: createdDocId, invoice_number: createdDocNumber };
          } else {
            const pinvRes: any = await apiRequest('/purchase_invoices', 'POST', pinvPayload);
            createdDocId = pinvRes.id;
            createdDocNumber = pinvRes.invoice_number || `PINV-${createdDocId.slice(-6)}`;
            fullPinv = { ...pinvPayload, id: createdDocId, invoice_number: createdDocNumber };
          }

          // Generate Journal Entry for Purchase Invoice
          const journalData = PostingService.generatePurchaseInvoiceJournal(
            fullPinv as any,
            suppliers,
            products,
            accounts,
            paymentMethods,
            companySettings
          );

          const je = await saveOrUpdateJournalEntry(
            journalData,
            createdDocId,
            doc.created_journal_id,
            doc.created_journal_number,
            user?.company_id
          );
          createdJournalId = je.id;
          createdJournalNumber = je.entry_number;

        } else if (doc.doc_type === 'أمر شراء') {
          const poPayload = {
            supplier_id: effectivePartyId,
            supplier_name: effectivePartyName,
            warehouse_id: effectiveWarehouseId || null,
            date: doc.date,
            subtotal: doc.subtotal,
            discount_amount: doc.discount_amount,
            tax_amount: doc.tax_amount,
            total_amount: doc.total_amount,
            notes: doc.notes || '',
            description: `استيراد أمر شراء تشغيلة: ${batchNumber} - مرجع: ${doc.ref}`,
            batch_number: batchNumber,
            status: 'draft',
            items: itemsPayload
          };

          if (doc.created_document_id) {
            await apiRequest(`/purchase_orders/${doc.created_document_id}`, 'PUT', poPayload);
            createdDocId = doc.created_document_id;
            createdDocNumber = doc.created_document_number || `PO-${createdDocId.slice(-6)}`;
          } else {
            const poRes: any = await apiRequest('/purchase_orders', 'POST', poPayload);
            createdDocId = poRes.id;
            createdDocNumber = poRes.order_number || `PO-${createdDocId.slice(-6)}`;
          }

        } else if (doc.doc_type === 'مرتجع شراء') {
          // Note: purchase_returns table only stores total_amount and withholding_tax_amount
          const pretPayload = {
            supplier_id: effectivePartyId,
            supplier_name: effectivePartyName,
            warehouse_id: effectiveWarehouseId || null,
            date: doc.date,
            withholding_tax_amount: doc.withholding_tax_amount,
            total_amount: doc.total_amount,
            payment_type: doc.payment_type,
            payment_method_id: doc.payment_type === 'cash' ? doc.payment_method_id : null,
            notes: doc.notes || '',
            description: `استيراد مرتجع شراء تشغيلة: ${batchNumber} - مرجع: ${doc.ref}`,
            batch_number: batchNumber,
            items: returnItemsPayload
          };

          let fullPret: any;
          if (doc.created_document_id) {
            await apiRequest(`/purchase_returns/${doc.created_document_id}`, 'PUT', pretPayload);
            createdDocId = doc.created_document_id;
            createdDocNumber = doc.created_document_number || `PRET-${createdDocId.slice(-6)}`;
            fullPret = { ...pretPayload, id: createdDocId, return_number: createdDocNumber };
          } else {
            const pretRes: any = await apiRequest('/purchase_returns', 'POST', pretPayload);
            createdDocId = pretRes.id;
            createdDocNumber = pretRes.return_number || `PRET-${createdDocId.slice(-6)}`;
            fullPret = { ...pretPayload, id: createdDocId, return_number: createdDocNumber };
          }

          // Generate Journal Entry for Purchase Return
          const journalData = PostingService.generatePurchaseReturnJournal(
            fullPret as any,
            suppliers,
            products,
            accounts,
            paymentMethods
          );

          const je = await saveOrUpdateJournalEntry(
            journalData,
            createdDocId,
            doc.created_journal_id,
            doc.created_journal_number,
            user?.company_id
          );
          createdJournalId = je.id;
          createdJournalNumber = je.entry_number;
        }

        updatedDocuments[idx] = {
          ...doc,
          created_document_id: createdDocId,
          created_document_number: createdDocNumber,
          created_journal_id: createdJournalId,
          created_journal_number: createdJournalNumber,
          status: 'saved',
          is_modified: false,
          error_message: undefined
        };
        newlySavedCount++;

      } catch (err: any) {
        console.error(`Error saving document ${doc.ref}:`, err);
        let errMsg = err.message || err.detail || 'خطأ أثناء الحفظ والترحيل';
        // Clean up common technical prefixes for clean UI
        errMsg = errMsg.replace(/^Failed to create (invoice|return|sales_order|purchase_invoice|purchase_order):\s*/i, '');
        errMsg = errMsg.replace(/^Error:\s*/i, '');
        if (errMsg.includes('Negative stock is not allowed') || errMsg.includes('الكمية المطلوبة غير متوفرة')) {
          errMsg = 'الكمية المطلوبة غير متوفرة في المخزن (رصيد الصنف لا يكفي وسياسة الشركة تمنع الصرف بالسالب)';
        } else if (errMsg.includes('invalid input syntax for type date')) {
          errMsg = 'صيغة تاريخ المستند غير متوافقة';
        }

        updatedDocuments[idx] = {
          ...doc,
          status: 'failed',
          error_message: errMsg
        };
        failedCount++;
      }
    }

    setDocuments(updatedDocuments);

    const totalSaved = updatedDocuments.filter(d => d.status === 'saved').length;
    const totalRemaining = updatedDocuments.filter(d => d.status !== 'saved').length;

    // Save batch record in document_import_batches
    try {
      const batchRecord = {
        company_id: user?.company_id,
        batch_number: batchNumber,
        batch_type: isSales ? 'sales' : 'purchases',
        batch_date: batchDate,
        total_documents: totalSaved,
        total_amount: updatedDocuments.filter(d => d.status === 'saved').reduce((sum, d) => sum + d.total_amount, 0),
        details: updatedDocuments.map(d => ({
          ref: d.ref,
          doc_type: d.doc_type,
          party_id: d.party_id,
          party_name: d.party_name,
          party_code: d.party_code,
          warehouse_id: d.warehouse_id,
          warehouse_name: d.warehouse_name,
          date: d.date,
          gross_total: d.gross_total,
          discount_amount: d.discount_amount,
          discount_total: d.discount_amount,
          subtotal: d.subtotal,
          net_before_tax: d.subtotal,
          tax_amount: d.tax_amount,
          tax_total: d.tax_amount,
          withholding_tax_amount: d.withholding_tax_amount,
          withholding_tax_total: d.withholding_tax_amount,
          total_amount: d.total_amount,
          payment_type: d.payment_type,
          payment_method_id: d.payment_method_id,
          created_document_id: d.created_document_id,
          created_document_number: d.created_document_number,
          created_journal_id: d.created_journal_id,
          created_journal_number: d.created_journal_number,
          status: d.status,
          error_message: d.error_message,
          items: d.items || []
        })),
        status: totalRemaining === 0 ? 'posted' : 'partial',
        created_by: user?.id || user?.email
      };

      await apiRequest('/document_import_batches', 'POST', batchRecord);
      fetchBatchesHistory();
    } catch (bErr: any) {
      console.warn('Failed to record batch audit history:', bErr);
    }

    setIsSavingBatch(false);
    setSaveProgress(null);

    // Only mark batch as completely saved if ALL documents succeeded!
    if (totalRemaining === 0) {
      setIsBatchSaved(true);
      showNotification(`تم حفظ وترحيل كامل الدفعة بنجاح! تم إنشاء ${totalSaved} مستند والقيود التلقائية`, 'success');
    } else {
      setIsBatchSaved(false);
      showNotification(`تم حفظ ${newlySavedCount} مستند، وتعذر حفظ ${failedCount} مستند (راجع الأسباب بالجدول ثم أعد المحاولة)`, 'warning');
    }
  };

  // Export processed data to Excel after save
  const handleExportAfterSave = () => {
    if (documents.length === 0) return;

    const wb = XLSX.utils.book_new();

    const headers = [
      'تاريخ التشغيلة',
      'رقم التشغيلة (Batch)',
      'رقم الفاتورة / المستند بالنظام',
      'رقم القيد المحاسبي',
      'Ref (المرجع الأصلي)',
      'نوع المستند',
      isSales ? 'العميل' : 'المورد',
      'تاريخ المستند',
      'المخزن',
      'كود الصنف',
      'اسم الصنف',
      'الكمية',
      'السعر',
      'الخصم',
      'الصافي قبل الضريبة',
      'نسبة ض.ق.م %',
      'قيمة ض.ق.م',
      'نسبة ض.خ.أ %',
      'قيمة ض.خ.أ',
      'الإجمالي النهائي للسطر',
      'طريقة الدفع',
      'حالة الحفظ والترحيل',
      'ملاحظات'
    ];

    const exportRows: any[][] = [];

    documents.forEach(doc => {
      doc.items.forEach(item => {
        exportRows.push([
          batchDate,
          batchNumber,
          doc.created_document_number || (doc.status === 'failed' ? `لم يتم الحفظ: ${doc.error_message || 'خطأ'}` : 'لم يتم الحفظ'),
          doc.created_journal_number || (doc.doc_type.includes('أمر') ? 'بدون قيد (أمر)' : '-'),
          doc.ref,
          doc.doc_type,
          doc.party_name,
          doc.date,
          doc.warehouse_name || '-',
          item.product_code,
          item.product_name,
          item.quantity,
          item.unit_price,
          item.discount_amount,
          item.subtotal,
          item.vat_rate,
          item.vat_amount,
          item.withholding_tax_rate,
          item.withholding_tax_amount,
          item.total,
          doc.payment_type === 'cash' ? 'نقدي' : 'آجل',
          doc.status === 'saved' ? 'تم الحفظ والترحيل' : `فشل: ${doc.error_message || 'لم يحفظ'}`,
          item.description || doc.notes || ''
        ]);
      });
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...exportRows]);
    ws['!cols'] = headers.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws, 'المستندات المرحلة');

    const outFileName = `${batchNumber}_${isSales ? 'مبيعات' : 'مشتريات'}_المرحلة.xlsx`;
    XLSX.writeFile(wb, outFileName);
    showNotification('تم تصدير ملف الإكسيل بنجاح', 'success');
  };

  const handleExportPastBatch = (batch: any) => {
    if (!batch || !batch.details || batch.details.length === 0) return;
    const wb = XLSX.utils.book_new();
    const headers = [
      'تاريخ التشغيلة',
      'رقم التشغيلة (Batch)',
      'رقم الفاتورة / المستند بالنظام',
      'رقم القيد المحاسبي',
      'رقم المرجع (Ref)',
      'نوع المستند',
      'الطرف (العميل / المورد)',
      'تاريخ المستند',
      'الصافي النهائي',
      'حالة الحفظ والترحيل',
      'ملاحظات / أسباب الفشل'
    ];
    const dataRows = (batch.details || []).map((d: any) => [
      batch.batch_date,
      batch.batch_number,
      d.created_document_number || '-',
      d.created_journal_number ? `قيد ${d.created_journal_number}` : '-',
      d.ref,
      d.doc_type,
      d.party_name,
      d.date,
      d.total_amount,
      d.status === 'saved' ? 'تم الحفظ والترحيل' : 'تعذر الحفظ',
      d.error_message || '-'
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    ws['!cols'] = headers.map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, ws, 'تقرير التشغيلة');
    XLSX.writeFile(wb, `تقرير_تشغيلة_${batch.batch_number}.xlsx`);
    showNotification(`تم تصدير إكسيل التشغيلة ${batch.batch_number} بنجاح`, 'success');
  };

  return (
    <div className="w-full px-2 sm:px-4 py-2.5 space-y-2.5" dir={dir}>
      
      {/* Top Tab Switcher: Import vs Batches History */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveMainTab('import')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeMainTab === 'import'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>استيراد تشغيلة جديدة</span>
          </button>

          <button
            onClick={() => {
              setActiveMainTab('history');
              fetchBatchesHistory();
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeMainTab === 'history'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>سجل التشغيلات السابقة ({batchesHistory.length})</span>
          </button>
        </div>

        {activeMainTab === 'history' && (
          <button
            onClick={fetchBatchesHistory}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-600 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBatches ? 'animate-spin' : ''}`} />
            <span>تحديث السجل</span>
          </button>
        )}
      </div>

      {/* VIEW 1: Batches History Screen */}
      {activeMainTab === 'history' ? (
        <div className="space-y-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  <span>سجل تشغيلات الاستيراد السابقة ({batchesHistory.length})</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  عرض جميع الدفعات التي تم استيرادها وترحيلها للنظام، مع إمكانية استعراض المستندات والقيود المرتبطة بكل تشغيلة
                </p>
              </div>

              <button
                onClick={() => setActiveMainTab('import')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 cursor-pointer"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>استيراد تشغيلة جديدة</span>
              </button>
            </div>

            {isLoadingBatches ? (
              <div className="py-12 text-center text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                <span className="text-xs">جاري تحميل سجل التشغيلات...</span>
              </div>
            ) : batchesHistory.length === 0 ? (
              <div className="py-12 text-center text-slate-500 space-y-3">
                <Layers className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-xs font-semibold">لا توجد تشغيلات استيراد مسجلة حتى الآن</p>
                <button
                  onClick={() => setActiveMainTab('import')}
                  className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
                >
                  بدء أول استيراد الآن
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-300">
                    <tr>
                      <th className="py-2.5 px-3">رقم التشغيلة</th>
                      <th className="py-2.5 px-3 text-center">التاريخ</th>
                      <th className="py-2.5 px-3 text-center">نوع التشغيلة</th>
                      <th className="py-2.5 px-3 text-center">عدد المستندات</th>
                      <th className="py-2.5 px-3 text-center">إجمالي القيمة</th>
                      <th className="py-2.5 px-3 text-center">الحالة</th>
                      <th className="py-2.5 px-3 text-center">تاريخ وتوقيت الحفظ</th>
                      <th className="py-2.5 px-3 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {batchesHistory.map((batch: any) => {
                      const isComplete = batch.status === 'posted' || batch.status === 'completed';
                      return (
                        <tr key={batch.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                            {batch.batch_number}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono">
                            {batch.batch_date ? String(batch.batch_date).slice(0, 10) : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800">
                              {batch.batch_type === 'sales' ? 'مبيعات' : 'مشتريات'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold">
                            {batch.total_documents || 0} مستند
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900 dark:text-white">
                            {formatMoney(Number(batch.total_amount) || 0)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                              isComplete 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {isComplete ? 'مكتملة بالكامل' : 'حفظ جزئي'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-500 font-mono text-[11px]" dir="ltr">
                            {batch.created_at ? new Date(batch.created_at).toLocaleString('ar-EG') : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  setEditingBatch(batch);
                                  setEditBatchDate(batch.batch_date ? String(batch.batch_date).slice(0, 10) : '');
                                  setEditBatchStatus(batch.status || 'posted');
                                }}
                                className="p-1.5 rounded-lg text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer"
                                title={isAr ? "تعديل بيانات التشغيلة" : "Edit Batch"}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setSelectedBatchDetails(batch)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs border border-emerald-200 transition-colors cursor-pointer"
                                title={isAr ? "استعراض تفاصيل المستندات والقيود لهذه التشغيلة" : "View Documents & Journals"}
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>{isAr ? "المستندات والقيود" : "Docs & Journals"}</span>
                              </button>
                              <button
                                onClick={() => handleExportPastBatch(batch)}
                                className="p-1 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 cursor-pointer"
                                title={isAr ? "تصدير إكسيل التشغيلة" : "Export Batch Excel"}
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* VIEW 2: Import & Processing View */
        <div className="space-y-2.5">
          {/* Merged Compact Header & Upload Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 md:p-3 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              
              {/* Right: Title & Info */}
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-xl ${isSales ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600' : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600'}`}>
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h1 className="text-xs md:text-sm font-bold text-slate-900 dark:text-white">
                      {pageTitle}
                    </h1>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {isSales ? 'مبيعات' : 'مشتريات'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    استيراد الفواتير والأوامر والمرتجعات مع توليد أرقام القيود التلقائية
                  </p>
                </div>
              </div>

              {/* Center: Merged Upload Dropzone / Button */}
              <div 
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`flex items-center gap-2 px-3 py-1 rounded-xl border border-dashed cursor-pointer transition-all duration-150 select-none ${
                  isDragging 
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700' 
                    : fileName
                      ? 'border-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 hover:border-emerald-400'
                      : 'border-slate-300 dark:border-slate-700 hover:border-emerald-400 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                }`}
                title="اضغط لاختيار ملف الإكسيل أو اسحبه وأفلته هنا"
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                  accept=".xlsx, .xls, .csv"
                  className="hidden" 
                />
                <UploadCloud className={`w-3.5 h-3.5 shrink-0 ${fileName ? 'text-emerald-600' : 'text-slate-500'}`} />
                {isParsing ? (
                  <span className="text-[11px] font-semibold flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    جاري الفحص...
                  </span>
                ) : fileName ? (
                  <span className="text-[11px] font-semibold truncate max-w-[200px]" dir="ltr">
                    {fileName}
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold">
                    اضغط لاختيار ملف الإكسيل أو اسحبه هنا
                  </span>
                )}
              </div>

              {/* Left: Tight inputs for Date, Batch # and Download Template */}
              <div className="flex flex-wrap items-center gap-1.5">
                {/* Date */}
                <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/60 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                  <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">التاريخ:</span>
                  <input 
                    type="date"
                    value={batchDate}
                    disabled={isBatchSaved}
                    onChange={(e) => setBatchDate(e.target.value)}
                    className="text-xs font-mono font-medium bg-transparent focus:outline-none disabled:opacity-60 cursor-pointer"
                  />
                </div>

                {/* Batch Number */}
                <div className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800/60">
                  <Hash className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-300">التشغيلة:</span>
                  <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300 select-all">
                    {isGeneratingBatchNumber ? 'جاري التوليد...' : batchNumber}
                  </span>
                </div>

                {/* Download Template Button */}
                <button
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-lg transition-colors shadow-xs cursor-pointer"
                  title="تحميل نموذج الإكسيل النموذجي المشروح مع أمثلة عملية جاهزة"
                >
                  <Download className="w-3 h-3" />
                  <span>تحميل النموذج</span>
                </button>

                {/* 1. Save Changes Button at Top of Screen (Requirement 1) */}
                {documents.length > 0 && (
                  <button
                    onClick={handleSaveAndPostBatch}
                    disabled={isSavingBatch || validationErrors.length > 0}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1 rounded-lg shadow-sm transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    title={validationErrors.length > 0 ? 'يرجى تصحيح الأخطاء أولاً قبل الحفظ' : 'حفظ التعديلات والترحيل للنظام'}
                  >
                    {isSavingBatch ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>جاري الحفظ...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>حفظ التعديلات {documents.filter(d => d.status !== 'saved' || d.is_modified).length > 0 ? `(${documents.filter(d => d.status !== 'saved' || d.is_modified).length})` : ''}</span>
                      </>
                    )}
                  </button>
                )}
              </div>

            </div>
          </div>

          {/* Validation Errors Box (if any) */}
          <AnimatePresence>
            {validationErrors.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-3 shadow-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>تنبيهات وأخطاء الفحص التفصيلي ({validationErrors.length} ملاحظة):</span>
                  </div>
                  <span className="text-[10px] bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full font-semibold">
                    يرجى تصحيح الأخطاء في الإكسيل أو التعديل بالجدول أدناه
                  </span>
                </div>

                <div className="max-h-48 overflow-y-auto rounded-xl border border-amber-200/80 dark:border-amber-800/80 bg-white dark:bg-slate-900">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-amber-100/60 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-b border-amber-200 dark:border-amber-800 sticky top-0">
                      <tr>
                        <th className="p-2 font-bold">رقم الصف بالإكسيل</th>
                        <th className="p-2 font-bold">رقم المرجع (Ref)</th>
                        <th className="p-2 font-bold">الحقل</th>
                        <th className="p-2 font-bold">سبب الخطأ بالتفصيل</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100 dark:divide-slate-800">
                      {validationErrors.map((err, i) => {
                        const isStockErr = err.field === 'رصيد المخزون';
                        return (
                          <tr key={i} className={`hover:bg-amber-50/50 dark:hover:bg-slate-800/50 ${isStockErr ? 'bg-red-50/80 dark:bg-red-950/40 font-medium' : ''}`}>
                            <td className="p-2 font-mono font-bold text-amber-700 dark:text-amber-400">الصف {err.rowNumber}</td>
                            <td className="p-2 font-mono font-bold">{err.ref}</td>
                            <td className={`p-2 font-semibold ${isStockErr ? 'text-red-700 dark:text-red-300 font-bold' : ''}`}>
                              {isStockErr ? '⚠️ ' + err.field : err.field}
                            </td>
                            <td className="p-2 text-red-600 dark:text-red-400">{err.message}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Unified Compact Totals Table */}
          {documents.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                    <tr>
                      <th className="py-2 px-3 whitespace-nowrap">نوع المستند</th>
                      <th className="py-2 px-2 text-center whitespace-nowrap">عدد المستندات</th>
                      <th className="py-2 px-2 text-center whitespace-nowrap">عدد البنود</th>
                      <th className="py-2 px-2 text-center whitespace-nowrap">الإجمالي</th>
                      <th className="py-2 px-2 text-center whitespace-nowrap">إجمالي الخصم</th>
                      <th className="py-2 px-2 text-center whitespace-nowrap">الصافي قبل الضريبة</th>
                      <th className="py-2 px-2 text-center whitespace-nowrap">
                        ض.ق.م {isVatEnabled ? '(14%)' : '(معطلة)'}
                      </th>
                      <th className="py-2 px-2 text-center whitespace-nowrap">
                        ض.خ.إ {isWhtEnabled ? '(1%)' : '(معطلة)'}
                      </th>
                      <th className="py-2 px-3 text-center whitespace-nowrap font-extrabold text-emerald-700 dark:text-emerald-300">
                        الصافي النهائي
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                    {/* Row 1: Invoices */}
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-1.5 px-3 font-sans font-bold whitespace-nowrap">
                        <span className="text-xs px-2.5 py-0.5 rounded-full border bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800">
                          {isSales ? 'فواتير بيع' : 'فواتير شراء'}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-center font-bold text-slate-800 dark:text-slate-200">{invoicesSummary.count}</td>
                      <td className="py-1.5 px-2 text-center text-slate-600 dark:text-slate-400">{invoicesSummary.totalItems}</td>
                      <td className="py-1.5 px-2 text-center">{formatMoney(invoicesSummary.gross)}</td>
                      <td className="py-1.5 px-2 text-center text-amber-600 font-bold">{formatMoney(invoicesSummary.discount)}</td>
                      <td className="py-1.5 px-2 text-center text-blue-600 font-bold">{formatMoney(invoicesSummary.subtotal)}</td>
                      <td className="py-1.5 px-2 text-center text-emerald-600 font-bold">{isVatEnabled ? formatMoney(invoicesSummary.vat) : '-'}</td>
                      <td className="py-1.5 px-2 text-center text-purple-600 font-bold">{isWhtEnabled ? formatMoney(invoicesSummary.wht) : '-'}</td>
                      <td className="py-1.5 px-3 text-center font-extrabold text-emerald-700 dark:text-emerald-300">{formatMoney(invoicesSummary.net)}</td>
                    </tr>

                    {/* Row 2: Orders */}
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-1.5 px-3 font-sans font-bold whitespace-nowrap">
                        <span className="text-xs px-2.5 py-0.5 rounded-full border bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-800">
                          {isSales ? 'أوامر بيع' : 'أوامر شراء'}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-center font-bold text-slate-800 dark:text-slate-200">{ordersSummary.count}</td>
                      <td className="py-1.5 px-2 text-center text-slate-600 dark:text-slate-400">{ordersSummary.totalItems}</td>
                      <td className="py-1.5 px-2 text-center">{formatMoney(ordersSummary.gross)}</td>
                      <td className="py-1.5 px-2 text-center text-amber-600 font-bold">{formatMoney(ordersSummary.discount)}</td>
                      <td className="py-1.5 px-2 text-center text-blue-600 font-bold">{formatMoney(ordersSummary.subtotal)}</td>
                      <td className="py-1.5 px-2 text-center text-emerald-600 font-bold">{isVatEnabled ? formatMoney(ordersSummary.vat) : '-'}</td>
                      <td className="py-1.5 px-2 text-center text-slate-400 font-bold">-</td>
                      <td className="py-1.5 px-3 text-center font-extrabold text-blue-700 dark:text-blue-300">{formatMoney(ordersSummary.net)}</td>
                    </tr>

                    {/* Row 3: Returns */}
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-1.5 px-3 font-sans font-bold whitespace-nowrap">
                        <span className="text-xs px-2.5 py-0.5 rounded-full border bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800">
                          {isSales ? 'مرتجعات بيع' : 'مرتجعات شراء'}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-center font-bold text-slate-800 dark:text-slate-200">{returnsSummary.count}</td>
                      <td className="py-1.5 px-2 text-center text-slate-600 dark:text-slate-400">{returnsSummary.totalItems}</td>
                      <td className="py-1.5 px-2 text-center">{formatMoney(returnsSummary.gross)}</td>
                      <td className="py-1.5 px-2 text-center text-amber-600 font-bold">{formatMoney(returnsSummary.discount)}</td>
                      <td className="py-1.5 px-2 text-center text-blue-600 font-bold">{formatMoney(returnsSummary.subtotal)}</td>
                      <td className="py-1.5 px-2 text-center text-emerald-600 font-bold">{isVatEnabled ? formatMoney(returnsSummary.vat) : '-'}</td>
                      <td className="py-1.5 px-2 text-center text-purple-600 font-bold">{isWhtEnabled ? formatMoney(returnsSummary.wht) : '-'}</td>
                      <td className="py-1.5 px-3 text-center font-extrabold text-amber-700 dark:text-amber-300">{formatMoney(returnsSummary.net)}</td>
                    </tr>
                  </tbody>
                  <tfoot className="bg-slate-100/70 dark:bg-slate-800/70 border-t-2 border-slate-200 dark:border-slate-700 font-mono font-bold text-slate-800 dark:text-slate-200">
                    <tr>
                      <td className="py-1.5 px-3 font-sans font-extrabold whitespace-nowrap">الإجمالي العام</td>
                      <td className="py-1.5 px-2 text-center">{documents.length}</td>
                      <td className="py-1.5 px-2 text-center">{documents.reduce((sum, d) => sum + d.items.length, 0)}</td>
                      <td className="py-1.5 px-2 text-center">{formatMoney(documents.reduce((sum, d) => sum + d.gross_total, 0))}</td>
                      <td className="py-1.5 px-2 text-center text-amber-600">{formatMoney(documents.reduce((sum, d) => sum + d.discount_amount, 0))}</td>
                      <td className="py-1.5 px-2 text-center text-blue-600">{formatMoney(documents.reduce((sum, d) => sum + d.subtotal, 0))}</td>
                      <td className="py-1.5 px-2 text-center text-emerald-600">{isVatEnabled ? formatMoney(documents.reduce((sum, d) => sum + d.tax_amount, 0)) : '-'}</td>
                      <td className="py-1.5 px-2 text-center text-purple-600">{isWhtEnabled ? formatMoney(documents.reduce((sum, d) => sum + d.withholding_tax_amount, 0)) : '-'}</td>
                      <td className="py-1.5 px-3 text-center font-extrabold text-emerald-700 dark:text-emerald-300">{formatMoney(documents.reduce((sum, d) => sum + d.total_amount, 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Items Accounts Audit Section */}
          {documents.length > 0 && itemsAccountAudit.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 shadow-xs space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    فحص ومطابقة ربط الحسابات للقيود المحاسبية ({itemsAccountAudit.length} صنف مسجل بالإكسيل):
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                    itemsAccountAudit.every(a => a.sales.status !== 'missing' && a.cost.status !== 'missing' && a.inventory.status !== 'missing' && a.vat.status !== 'missing' && a.wht.status !== 'missing')
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                      : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800 font-bold'
                  }`}>
                    {itemsAccountAudit.every(a => a.sales.status !== 'missing' && a.cost.status !== 'missing' && a.inventory.status !== 'missing' && a.vat.status !== 'missing' && a.wht.status !== 'missing')
                      ? '✓ جميع الأصناف مكتملة الحسابات ومطابقة'
                      : '⚠️ توجد أصناف تفتقد لحسابات لازمة للقيود (تمنع الحفظ)'}
                  </span>
                </div>

                <button
                  onClick={() => setShowAccountsAudit(!showAccountsAudit)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  <span>{showAccountsAudit ? 'إخفاء تفاصيل ربط الحسابات' : 'عرض تفاصيل ربط الحسابات (البيع / التكلفة / المخزون / الضرائب)'}</span>
                  {showAccountsAudit ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {showAccountsAudit && (
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 mt-2">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-1.5 px-2.5">كود الصنف</th>
                        <th className="py-1.5 px-2.5">اسم الصنف</th>
                        <th className="py-1.5 px-2.5 text-center">{isSales ? 'حساب المبيعات / الإيراد' : 'حساب المشتريات / التكلفة'}</th>
                        <th className="py-1.5 px-2.5 text-center">حساب تكلفة المبيعات</th>
                        <th className="py-1.5 px-2.5 text-center">حساب المخزون</th>
                        <th className="py-1.5 px-2.5 text-center">ضريبة القيمة المضافة (ق م)</th>
                        <th className="py-1.5 px-2.5 text-center">ضريبة أ.ت.ص (خ إ)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                      {itemsAccountAudit.map((aud, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="py-1.5 px-2.5 font-bold text-slate-800 dark:text-slate-200">{aud.product_code}</td>
                          <td className="py-1.5 px-2.5 font-sans font-medium text-slate-900 dark:text-slate-100">{aud.product_name}</td>
                          <td className="py-1.5 px-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold border ${
                              aud.sales.status === 'linked' 
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800' 
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 border-rose-300 dark:border-rose-800'
                            }`}>
                              {aud.sales.status === 'linked' ? '✓ ' : '✕ '}{aud.sales.name}
                            </span>
                          </td>
                          <td className="py-1.5 px-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold border ${
                              aud.cost.status === 'exempt'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-200'
                                : aud.cost.status === 'linked'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 border-rose-300 dark:border-rose-800'
                            }`}>
                              {aud.cost.status === 'exempt' ? 'خدمي (معفى)' : (aud.cost.status === 'linked' ? '✓ ' : '✕ ') + aud.cost.name}
                            </span>
                          </td>
                          <td className="py-1.5 px-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold border ${
                              aud.inventory.status === 'exempt'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-200'
                                : aud.inventory.status === 'linked'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 border-rose-300 dark:border-rose-800'
                            }`}>
                              {aud.inventory.status === 'exempt' ? 'خدمي (معفى)' : (aud.inventory.status === 'linked' ? '✓ ' : '✕ ') + aud.inventory.name}
                            </span>
                          </td>
                          <td className="py-1.5 px-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold border ${
                              aud.vat.status === 'exempt'
                                ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-300'
                                : aud.vat.status === 'linked'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 border-rose-300 dark:border-rose-800'
                            }`}>
                              {aud.vat.status === 'linked' ? '✓ ' : aud.vat.status === 'missing' ? '✕ ' : ''}{aud.vat.name}
                            </span>
                          </td>
                          <td className="py-1.5 px-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold border ${
                              aud.wht.status === 'exempt'
                                ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-300'
                                : aud.wht.status === 'linked'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 border-rose-300 dark:border-rose-800'
                            }`}>
                              {aud.wht.status === 'linked' ? '✓ ' : aud.wht.status === 'missing' ? '✕ ' : ''}{aud.wht.name}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Actions Bar: Save & Post / Export After Save */}
          {documents.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 shadow-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  إجمالي المستندات:
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono">
                  {documents.length} مستند
                </span>

                {/* If all saved */}
                {isBatchSaved && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>تم الحفظ والترحيل بالكامل ({documents.filter(d => d.status === 'saved').length} مستند)</span>
                  </span>
                )}

                {/* If partially saved with failures */}
                {!isBatchSaved && documents.some(d => d.status === 'saved') && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-100 dark:bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-300 dark:border-amber-800">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>
                      تم حفظ {documents.filter(d => d.status === 'saved').length} مستند، وتعذر حفظ {documents.filter(d => d.status === 'failed').length} مستند
                    </span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Save & Post Button */}
                {!isBatchSaved && (
                  <button
                    onClick={handleSaveAndPostBatch}
                    disabled={isSavingBatch || validationErrors.length > 0}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isSavingBatch ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>جاري الحفظ والترحيل...</span>
                      </>
                    ) : documents.some(d => d.status === 'saved') ? (
                      <>
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>إعادة محاولة حفظ المستندات المتبقية ({documents.filter(d => d.status !== 'saved').length})</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>حفظ وترحيل المستندات</span>
                      </>
                    )}
                  </button>
                )}

                {/* Export After Save Button */}
                {(isBatchSaved || documents.some(d => d.status === 'saved' || d.status === 'failed')) && (
                  <button
                    onClick={handleExportAfterSave}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تصدير إكسيل النتائج (مع أرقام الفواتير والقيود)</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Save Progress Bar */}
          {saveProgress && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 shadow-xs space-y-1">
              <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span>{saveProgress.statusText}</span>
                <span className="font-mono">{Math.round((saveProgress.current / saveProgress.total) * 100)}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full transition-all duration-300"
                  style={{ width: `${(saveProgress.current / saveProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Interactive Table of Valid Documents (Accordion) - COMPACT ROW SPACING */}
          {documents.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs md:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-600" />
                  <span>جدول المستندات ومطابقتها ({documents.length}):</span>
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const allOpen: Record<string, boolean> = {};
                      documents.forEach(d => { allOpen[d.ref] = true; });
                      setExpandedRefs(allOpen);
                    }}
                    className="text-[11px] text-slate-600 dark:text-slate-400 hover:underline cursor-pointer"
                  >
                    فتح الكل
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    onClick={() => setExpandedRefs({})}
                    className="text-[11px] text-slate-600 dark:text-slate-400 hover:underline cursor-pointer"
                  >
                    طي الكل
                  </button>
                </div>
              </div>

              {/* Tight Spacing Between Rows */}
              <div className="space-y-1">
                {documents.map((doc) => {
                  const isExpanded = !!expandedRefs[doc.ref];
                  const docTypeBadgeColor = 
                    doc.doc_type.includes('فاتورة') ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800' :
                    doc.doc_type.includes('أمر') ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-800' :
                    'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800';

                  const allServices = doc.items.length > 0 && doc.items.every(i => i.is_service === true);

                  return (
                    <div 
                      key={doc.ref}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden"
                    >
                      {/* Document Header Row (Parent) - COMPACT */}
                      <div className="py-1 px-2.5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-1.5">
                        
                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* Chevron toggle */}
                          <button
                            onClick={() => toggleDocExpand(doc.ref)}
                            className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors cursor-pointer"
                            title={isExpanded ? 'طي الأصناف' : 'عرض الأصناف'}
                          >
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>

                          {/* 1. Document Number Link / Badge */}
                          {doc.created_document_number && (
                            <button
                              type="button"
                              onClick={() => handleNavigateToDocument(doc)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-mono font-bold shadow-xs transition-all cursor-pointer"
                              title="انقر للانتقال مباشرة إلى المستند في تبويب جديد"
                            >
                              <FileText className="w-3 h-3" />
                              <span>{doc.created_document_number}</span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-80" />
                            </button>
                          )}

                          {/* 2. Journal Entry Number Link / Badge */}
                          {doc.created_journal_number && (
                            <button
                              type="button"
                              onClick={() => handleNavigateToJournal(doc)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-mono font-bold shadow-xs transition-all cursor-pointer"
                              title="انقر للانتقال مباشرة إلى القيد المحاسبي في تبويب جديد"
                            >
                              <Hash className="w-3 h-3" />
                              <span>قيد: {doc.created_journal_number}</span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-80" />
                            </button>
                          )}

                          {/* 3. Pre-validation Stock Shortage Warning */}
                          {doc.has_stock_error && doc.status !== 'saved' && doc.status !== 'failed' && (
                            <div 
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-50 dark:bg-red-950/70 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 text-[11px] font-semibold"
                              title={doc.stock_error_message}
                            >
                              <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
                              <span className="truncate max-w-[340px]">عجز مخزون: {doc.stock_error_message}</span>
                            </div>
                          )}

                          {/* 3.1 Pre-validation Missing Accounts Warning */}
                          {doc.has_account_error && doc.status !== 'saved' && doc.status !== 'failed' && (
                            <div 
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-50 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-[11px] font-semibold"
                              title={doc.account_error_message}
                            >
                              <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                              <span className="truncate max-w-[340px]">{doc.account_error_message || 'حسابات غير مكتملة في بطاقات الأصناف أو الأطراف'}</span>
                            </div>
                          )}

                          {/* 3.2 Pre-validation Missing Warehouse Warning */}
                          {doc.has_warehouse_error && doc.status !== 'saved' && doc.status !== 'failed' && (
                            <div 
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-[11px] font-semibold"
                              title={doc.warehouse_error_message}
                            >
                              <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                              <span className="truncate max-w-[340px]">{doc.warehouse_error_message || 'المستند يفتقد لتحديد المخزن'}</span>
                            </div>
                          )}

                          {/* 3.1 Error Badge if document failed during save */}
                          {doc.status === 'failed' && (
                            <div 
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-50 dark:bg-red-950/70 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 text-[11px] font-semibold"
                              title={doc.error_message}
                            >
                              <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
                              <span className="truncate max-w-[340px]">فشل الحفظ: {doc.error_message || 'خطأ في الحفظ'}</span>
                            </div>
                          )}

                          {/* 4. Ref Badge */}
                          <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xs text-slate-800 dark:text-slate-200">
                            {doc.ref}
                          </span>

                          {/* 5. Document Type Badge */}
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold border ${docTypeBadgeColor}`}>
                            {doc.doc_type}
                          </span>

                          {/* 6. Party Name */}
                          <span className="font-bold text-xs text-slate-900 dark:text-white">
                            {doc.party_name}
                          </span>

                          {/* 7. Date */}
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            {doc.date}
                          </span>

                          {/* 8. Warehouse or Service Badge */}
                          {allServices ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-semibold border border-purple-200 dark:border-purple-800">
                              خدمات (لا يلزم مخزن)
                            </span>
                          ) : doc.warehouse_name ? (
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              {doc.warehouse_name}
                            </span>
                          ) : null}

                          {/* 9. Payment Type */}
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {doc.payment_type === 'cash' ? 'نقدي' : 'آجل'}
                          </span>

                          {/* 10. Edit Document Header Button (Requirement 2 - Circled in User Screenshot) */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditDocModal(doc)}
                            className="p-1 rounded-full text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 transition-colors shadow-2xs cursor-pointer"
                            title="تعديل بيانات المستند الأساسية (النوع، التاريخ، الطرف، المخزن، طريقة الدفع، الملاحظات)"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Left: Add Item Action & Net Total Badge & Delete Action */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenAddItemModal(doc.ref)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-xs transition-all cursor-pointer"
                            title="إضافة صنف جديد لهذا المستند"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ إضافة صنف</span>
                          </button>

                          <div className="flex items-center gap-1 text-xs font-mono bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-lg">
                            <span className="text-emerald-700 dark:text-emerald-300 font-medium">الصافي:</span>
                            <span className="text-emerald-900 dark:text-emerald-100 font-bold">{formatMoney(doc.total_amount)}</span>
                          </div>

                          <button
                            onClick={() => handleDeleteDocument(doc.ref)}
                            className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                            title={doc.status === 'saved' ? 'إزالة المستند من مساحة العمل' : 'حذف المستند بالكامل'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                      </div>

                      {/* Collapsible Items Sub-Table - COMPACT */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-x-auto"
                          >
                            <table className="w-full text-right text-xs">
                              <thead className="bg-slate-100/70 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-bold">
                                <tr>
                                  <th className="py-1 px-2 w-8 text-center text-[11px]">#</th>
                                  <th className="py-1 px-2 text-[11px]">كود الصنف</th>
                                  <th className="py-1 px-2 text-[11px]">اسم الصنف</th>
                                  <th className="py-1 px-2 text-center text-[11px]">رقم عملية</th>
                                  <th className="py-1 px-2 text-center text-[11px]">الإدارة</th>
                                  <th className="py-1 px-2 text-center text-[11px]">مركز التكلفة</th>
                                  <th className="py-1 px-2 text-center text-[11px]">الكمية</th>
                                  <th className="py-1 px-2 text-center text-[11px]">السعر</th>
                                  <th className="py-1 px-2 text-center text-[11px]">الخصم</th>
                                  <th className="py-1 px-2 text-center text-[11px]">الصافي قبل الضريبة</th>
                                  <th className="py-1 px-2 text-center text-[11px]">ض.ق.م (%)</th>
                                  <th className="py-1 px-2 text-center text-[11px]">قيمة ض.ق.م</th>
                                  <th className="py-1 px-2 text-center text-[11px]">ض.خ.أ (%)</th>
                                  <th className="py-1 px-2 text-center text-[11px]">قيمة ض.خ.أ</th>
                                  <th className="py-1 px-2 text-center font-extrabold text-slate-900 dark:text-white text-[11px]">الإجمالي</th>
                                  <th className="py-1 px-2 text-center w-16 text-[11px]">إجراءات</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-xs">
                                {doc.items.map((item, itemIdx) => (
                                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                    <td className="py-1 px-2 text-center text-slate-400 font-sans">{itemIdx + 1}</td>
                                    <td className="py-1 px-2 font-semibold text-slate-700 dark:text-slate-300">{item.product_code}</td>
                                    <td className="py-1 px-2 font-sans font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
                                      <span>{item.product_name}</span>
                                      {item.account_error && (
                                        <span 
                                          className="text-[10px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 font-bold border border-rose-300 dark:border-rose-800 flex items-center gap-1"
                                          title={item.account_warning}
                                        >
                                          <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                                          <span>{item.account_warning || 'حسابات غير مكتملة بالصنف'}</span>
                                        </span>
                                      )}
                                      {item.is_service && (
                                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 font-semibold border border-purple-200 dark:border-purple-800">
                                          خدمة
                                        </span>
                                      )}
                                      {item.stock_error && (
                                        <span 
                                          className="text-[10px] px-1.5 py-0.2 rounded bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200 font-bold border border-red-300 dark:border-red-800 flex items-center gap-1"
                                          title={item.stock_warning}
                                        >
                                          <AlertTriangle className="w-2.5 h-2.5 text-red-600" />
                                          <span>عجز مخزون (المتاح: {item.available_stock})</span>
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-1 px-2 text-center text-[11px] font-sans text-slate-600 dark:text-slate-400">
                                      {item.operation_number || operations.find(o => o.id === item.operation_id)?.operation_number || '-'}
                                    </td>
                                    <td className="py-1 px-2 text-center text-[11px] font-sans text-slate-600 dark:text-slate-400">
                                      {item.department_name || departments.find(d => d.id === item.department_id)?.name || '-'}
                                    </td>
                                    <td className="py-1 px-2 text-center text-[11px] font-sans text-slate-600 dark:text-slate-400">
                                      {item.cost_center_name || costCenters.find(c => c.id === item.cost_center_id)?.name || '-'}
                                    </td>
                                    <td className={`py-1 px-2 text-center font-bold ${
                                      item.stock_error 
                                        ? 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/60 rounded border border-red-200 dark:border-red-800' 
                                        : 'text-slate-900 dark:text-white'
                                    }`}>
                                      {item.quantity}
                                    </td>
                                    <td className="py-1 px-2 text-center">{formatMoney(item.unit_price)}</td>
                                    <td className="py-1 px-2 text-center text-amber-600 font-bold">{formatMoney(item.discount_amount)}</td>
                                    <td className="py-1 px-2 text-center text-blue-600 font-bold">{formatMoney(item.subtotal)}</td>
                                    <td className="py-1 px-2 text-center text-slate-500 font-sans">{item.vat_rate}%</td>
                                    <td className="py-1 px-2 text-center text-emerald-600 font-bold">{formatMoney(item.vat_amount)}</td>
                                    <td className="py-1 px-2 text-center text-slate-500 font-sans">{item.withholding_tax_rate}%</td>
                                    <td className="py-1 px-2 text-center text-purple-600 font-bold">{formatMoney(item.withholding_tax_amount)}</td>
                                    <td className="py-1 px-2 text-center font-extrabold text-emerald-700 dark:text-emerald-300">{formatMoney(item.total)}</td>
                                    <td className="py-1 px-2 text-center">
                                      <div className="flex items-center justify-center gap-1 font-sans">
                                        <button
                                          onClick={() => setEditingItem({ docRef: doc.ref, item })}
                                          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-600 cursor-pointer"
                                          title="تعديل هذا البند"
                                        >
                                          <Edit3 className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteItem(doc.ref, item.id)}
                                          className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-400 hover:text-red-600 cursor-pointer"
                                          title="حذف هذا البند"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal 1: Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Edit3 className="w-4 h-4 text-emerald-600" />
                <span>تعديل بيانات البند ({editingItem.item.product_name})</span>
              </h3>
              <button 
                onClick={() => setEditingItem(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">الكمية:</label>
                    {editingItem.item.available_stock !== undefined && (
                      <span className="text-[11px] text-slate-500 font-mono">
                        (المتاح: {editingItem.item.available_stock})
                      </span>
                    )}
                  </div>
                  <input 
                    type="number"
                    min="0.001"
                    step="any"
                    value={editingItem.item.quantity}
                    onChange={(e) => setEditingItem({
                      ...editingItem,
                      item: { ...editingItem.item, quantity: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">السعر:</label>
                  <input 
                    type="number"
                    min="0"
                    step="any"
                    value={editingItem.item.unit_price}
                    onChange={(e) => setEditingItem({
                      ...editingItem,
                      item: { ...editingItem.item, unit_price: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">قيمة الخصم:</label>
                  <input 
                    type="number"
                    min="0"
                    step="any"
                    value={editingItem.item.discount_amount}
                    onChange={(e) => setEditingItem({
                      ...editingItem,
                      item: { ...editingItem.item, discount_amount: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">ض.ق.م (%):</label>
                  <input 
                    type="number"
                    min="0"
                    step="any"
                    disabled={!isVatEnabled}
                    value={isVatEnabled ? editingItem.item.vat_rate : 0}
                    onChange={(e) => setEditingItem({
                      ...editingItem,
                      item: { ...editingItem.item, vat_rate: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 font-mono disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">ض.خ.إ (%):</label>
                  <input 
                    type="number"
                    min="0"
                    step="any"
                    disabled={!isWhtEnabled}
                    value={isWhtEnabled ? editingItem.item.withholding_tax_rate : 0}
                    onChange={(e) => setEditingItem({
                      ...editingItem,
                      item: { ...editingItem.item, withholding_tax_rate: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 font-mono disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">رقم العملية (اختياري):</label>
                  <select
                    value={editingItem.item.operation_id || ''}
                    onChange={(e) => {
                      const opId = e.target.value;
                      const op = operations.find(o => o.id === opId);
                      setEditingItem({
                        ...editingItem,
                        item: {
                          ...editingItem.item,
                          operation_id: opId || null,
                          operation_number: op ? (op.operation_number || op.id) : undefined
                        }
                      });
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 text-xs"
                  >
                    <option value="">— بدون عملية —</option>
                    {operations.map(op => (
                      <option key={op.id} value={op.id}>
                        {op.operation_number || op.id} {op.customer_name ? `(${op.customer_name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">الإدارة (اختياري):</label>
                  <select
                    value={editingItem.item.department_id || ''}
                    onChange={(e) => {
                      const deptId = e.target.value;
                      const dept = departments.find(d => d.id === deptId);
                      setEditingItem({
                        ...editingItem,
                        item: {
                          ...editingItem.item,
                          department_id: deptId || null,
                          department_name: dept ? dept.name : undefined
                        }
                      });
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 text-xs"
                  >
                    <option value="">— بدون إدارة —</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name} {dept.code ? `(${dept.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">مركز التكلفة (اختياري):</label>
                  <select
                    value={editingItem.item.cost_center_id || ''}
                    onChange={(e) => {
                      const ccId = e.target.value;
                      const cc = costCenters.find(c => c.id === ccId);
                      setEditingItem({
                        ...editingItem,
                        item: {
                          ...editingItem.item,
                          cost_center_id: ccId || null,
                          cost_center_name: cc ? cc.name : undefined
                        }
                      });
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 text-xs"
                  >
                    <option value="">— بدون مركز تكلفة —</option>
                    {costCenters.map(cc => (
                      <option key={cc.id} value={cc.id}>
                        {cc.name} {cc.code ? `(${cc.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">ملاحظات البند:</label>
                <input 
                  type="text"
                  value={editingItem.item.description || ''}
                  onChange={(e) => setEditingItem({
                    ...editingItem,
                    item: { ...editingItem.item, description: e.target.value }
                  })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setEditingItem(null)}
                className="px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={() => handleSaveItemEdit(editingItem.item)}
                className="px-3.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs cursor-pointer"
              >
                حفظ التعديلات
              </button>
            </div>
          </div>
        </div>
      )}

            {/* Modal 1.25: Edit Document Header Modal (Requirement 2) */}
      {editingDoc && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Edit3 className="w-4 h-4 text-emerald-600" />
                <span>تعديل بيانات المستند الأساسية ({editingDoc.ref})</span>
              </h3>
              <button 
                onClick={() => setEditingDoc(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              {/* Document Type & Date */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">نوع المستند:</label>
                  <select
                    value={editDocForm.doc_type}
                    onChange={(e) => setEditDocForm(prev => ({ ...prev, doc_type: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 font-bold text-emerald-700 dark:text-emerald-400"
                  >
                    {isSales ? (
                      <>
                        <option value="فاتورة بيع">فاتورة بيع</option>
                        <option value="أمر بيع">أمر بيع</option>
                        <option value="مرتجع بيع">مرتجع بيع</option>
                      </>
                    ) : (
                      <>
                        <option value="فاتورة شراء">فاتورة شراء</option>
                        <option value="أمر شراء">أمر شراء</option>
                        <option value="مرتجع شراء">مرتجع شراء</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">التاريخ:</label>
                  <input 
                    type="date"
                    value={editDocForm.date}
                    onChange={(e) => setEditDocForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 font-mono"
                  />
                </div>
              </div>

              {/* Party (Customer / Supplier) */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">{entityLabel}:</label>
                <select
                  value={editDocForm.party_id}
                  onChange={(e) => setEditDocForm(prev => ({ ...prev, party_id: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 font-medium"
                >
                  <option value="">— اختر {entityLabel} —</option>
                  {(isSales ? customers : suppliers).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.code ? `[${p.code}] ` : ''}{p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Warehouse */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  المخزن {editingDoc.items.some(it => !it.is_service) ? <span className="text-rose-500 font-bold">(إلزامي لوجود أصناف مخزنية)</span> : '(اختياري)'}:
                </label>
                <select
                  value={editDocForm.warehouse_id}
                  onChange={(e) => setEditDocForm(prev => ({ ...prev, warehouse_id: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 font-medium"
                >
                  <option value="">— بدون مخزن (أصناف خدمية فقط) —</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name} {w.code ? `(${w.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Type & Method */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">طريقة الدفع:</label>
                  <select
                    value={editDocForm.payment_type}
                    onChange={(e) => setEditDocForm(prev => ({ ...prev, payment_type: e.target.value as any }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5"
                  >
                    <option value="credit">آجل (Credit)</option>
                    <option value="cash">نقدي (Cash)</option>
                  </select>
                </div>
                {editDocForm.payment_type === 'cash' ? (
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">الخزينة / طريقة السداد:</label>
                    <select
                      value={editDocForm.payment_method_id}
                      onChange={(e) => setEditDocForm(prev => ({ ...prev, payment_method_id: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5"
                    >
                      <option value="">— الخزينة الافتراضية —</option>
                      {paymentMethods.map(pm => (
                        <option key={pm.id} value={pm.id}>{pm.name}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block font-semibold text-slate-400 mb-1">الخزينة:</label>
                    <input 
                      disabled 
                      value="غير مطبق على الآجل" 
                      className="w-full bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-slate-400"
                    />
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">الملاحظات:</label>
                <textarea 
                  rows={2}
                  value={editDocForm.notes}
                  onChange={(e) => setEditDocForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="ملاحظات المستند..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setEditingDoc(null)}
                className="px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveDocEdit}
                className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>حفظ التعديلات</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 1.5: Add Item to Document Modal */}
      {addingItemDocRef && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-emerald-600" />
                <span>إضافة صنف جديد للمستند ({addingItemDocRef})</span>
              </h3>
              <button 
                onClick={() => setAddingItemDocRef(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              {/* Product selector with live check (Requirement 3) */}
              {(() => {
                const selectedProd = products.find(p => p.id === newItemForm.product_id);
                const targetDocForAdd = documents.find(d => d.ref === addingItemDocRef);
                const isProdService = selectedProd?.type === 'service' || selectedProd?.is_service === true;
                const isProdPhysical = selectedProd ? !isProdService : false;
                const accountsCheck = getProductAccountsCheck(selectedProd, newItemForm.vat_rate, newItemForm.withholding_tax_rate);

                return (
                  <div className="space-y-2">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">الصنف المطلوب إضافته:</label>
                      <select
                        value={newItemForm.product_id}
                        onChange={(e) => handleProductChangeInNewItem(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-medium"
                      >
                        <option value="">— اختر الصنف —</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.code ? `[${p.code}] ` : ''}{p.name} {p.type === 'service' ? '(خدمة)' : `(رصيد: ${p.stock ?? 0})`}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Warehouse assignment if targetDoc has no warehouse and item is physical */}
                    {isProdPhysical && !targetDocForAdd?.warehouse_id && (
                      <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl space-y-1.5">
                        <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-200 font-bold text-xs">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>تنبيه: المستند لا يحتوي على مخزن محدد والصنف المختار صنف مخزني!</span>
                        </div>
                        <p className="text-[11px] text-amber-700 dark:text-amber-300">
                          يرجى اختيار المخزن الذي سيتم تعيينه للمستند لصرف/استلام البند:
                        </p>
                        <select
                          value={addingItemWarehouseId}
                          onChange={(e) => setAddingItemWarehouseId(e.target.value)}
                          className="w-full bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg p-1.5 text-xs font-semibold"
                        >
                          <option value="">— اختر المخزن للمستند —</option>
                          {warehouses.map(w => (
                            <option key={w.id} value={w.id}>{w.name} {w.code ? `(${w.code})` : ''}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Live Product Accounts & Warehouse Checklist (Requirement 3 - Zero Guessing Policy) */}
                    {selectedProd && accountsCheck && (
                      <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>فحص الحسابات اللازمة للقيود المحاسبية:</span>
                          </span>
                          {isProdPhysical ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              📦 صنف مخزني (يحتاج مخزن)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                              ⚙️ صنف خدمي (لا يلزم مخزن)
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
                          <div className={`p-1.5 rounded-lg border flex items-center gap-1 ${accountsCheck.sales.ok ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800'}`}>
                            {accountsCheck.sales.ok ? <Check className="w-3 h-3 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />}
                            <span className="truncate" title={accountsCheck.sales.name}>{isSales ? 'الإيراد' : 'التكلفة'}: {accountsCheck.sales.ok ? 'مربوط' : 'مفقود'}</span>
                          </div>

                          <div className={`p-1.5 rounded-lg border flex items-center gap-1 ${accountsCheck.cost.ok ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800'}`}>
                            {accountsCheck.cost.ok ? <Check className="w-3 h-3 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />}
                            <span className="truncate" title={accountsCheck.cost.name}>تكلفة المبيعات: {accountsCheck.cost.exempt ? 'معفى' : (accountsCheck.cost.ok ? 'مربوط' : 'مفقود')}</span>
                          </div>

                          <div className={`p-1.5 rounded-lg border flex items-center gap-1 ${accountsCheck.inventory.ok ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800'}`}>
                            {accountsCheck.inventory.ok ? <Check className="w-3 h-3 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />}
                            <span className="truncate" title={accountsCheck.inventory.name}>المخزون: {accountsCheck.inventory.exempt ? 'معفى' : (accountsCheck.inventory.ok ? 'مربوط' : 'مفقود')}</span>
                          </div>

                          <div className={`p-1.5 rounded-lg border flex items-center gap-1 ${accountsCheck.vat.ok ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800'}`}>
                            {accountsCheck.vat.ok ? <Check className="w-3 h-3 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />}
                            <span className="truncate" title={accountsCheck.vat.name}>ض.ق.م: {accountsCheck.vat.exempt ? 'معفى' : (accountsCheck.vat.ok ? 'مربوط' : 'مفقود')}</span>
                          </div>

                          <div className={`p-1.5 rounded-lg border flex items-center gap-1 ${accountsCheck.wht.ok ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800'}`}>
                            {accountsCheck.wht.ok ? <Check className="w-3 h-3 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />}
                            <span className="truncate" title={accountsCheck.wht.name}>ض.خ.أ: {accountsCheck.wht.exempt ? 'معفى' : (accountsCheck.wht.ok ? 'مربوط' : 'مفقود')}</span>
                          </div>
                        </div>

                        {accountsCheck.missingNames.length > 0 && (
                          <div className="p-1.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-[11px] flex items-start gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                            <span>
                              <strong>تنبيه حسابات القيود:</strong> يفتقد الصنف ربط: ({accountsCheck.missingNames.join('، ')}). لن يتمكن النظام من ترحيل القيد المحاسبي حتى يتم استكمالها في بطاقة الصنف أو إعدادات الشركة.
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Quantity & Unit Price */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">الكمية:</label>
                  <input 
                    type="number"
                    min="0.001"
                    step="any"
                    value={newItemForm.quantity}
                    onChange={(e) => setNewItemForm(prev => ({
                      ...prev,
                      quantity: parseFloat(e.target.value) || 0
                    }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">السعر (سعر الوحدة):</label>
                  <input 
                    type="number"
                    min="0"
                    step="any"
                    value={newItemForm.unit_price}
                    onChange={(e) => setNewItemForm(prev => ({
                      ...prev,
                      unit_price: parseFloat(e.target.value) || 0
                    }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 font-mono"
                  />
                </div>
              </div>

              {/* Discount, VAT, WHT */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">قيمة الخصم:</label>
                  <input 
                    type="number"
                    min="0"
                    step="any"
                    value={newItemForm.discount_amount}
                    onChange={(e) => setNewItemForm(prev => ({
                      ...prev,
                      discount_amount: parseFloat(e.target.value) || 0
                    }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">ض.ق.م (%):</label>
                  <input 
                    type="number"
                    min="0"
                    step="any"
                    disabled={!isVatEnabled}
                    value={isVatEnabled ? newItemForm.vat_rate : 0}
                    onChange={(e) => setNewItemForm(prev => ({
                      ...prev,
                      vat_rate: parseFloat(e.target.value) || 0
                    }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 font-mono disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">ض.خ.إ (%):</label>
                  <input 
                    type="number"
                    min="0"
                    step="any"
                    disabled={!isWhtEnabled}
                    value={isWhtEnabled ? newItemForm.withholding_tax_rate : 0}
                    onChange={(e) => setNewItemForm(prev => ({
                      ...prev,
                      withholding_tax_rate: parseFloat(e.target.value) || 0
                    }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 font-mono disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Optional: Operation, Department, Cost Center */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">رقم العملية (اختياري):</label>
                  <select
                    value={newItemForm.operation_id}
                    onChange={(e) => setNewItemForm(prev => ({ ...prev, operation_id: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 text-xs"
                  >
                    <option value="">— بدون عملية —</option>
                    {operations.map(op => (
                      <option key={op.id} value={op.id}>
                        {op.operation_number || op.id} {op.customer_name ? `(${op.customer_name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">الإدارة (اختياري):</label>
                  <select
                    value={newItemForm.department_id}
                    onChange={(e) => setNewItemForm(prev => ({ ...prev, department_id: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 text-xs"
                  >
                    <option value="">— بدون إدارة —</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name} {dept.code ? `(${dept.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">مركز التكلفة (اختياري):</label>
                  <select
                    value={newItemForm.cost_center_id}
                    onChange={(e) => setNewItemForm(prev => ({ ...prev, cost_center_id: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 text-xs"
                  >
                    <option value="">— بدون مركز تكلفة —</option>
                    {costCenters.map(cc => (
                      <option key={cc.id} value={cc.id}>
                        {cc.name} {cc.code ? `(${cc.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">ملاحظات / بيان البند:</label>
                <input 
                  type="text"
                  placeholder="وصف اختياري للبند..."
                  value={newItemForm.description}
                  onChange={(e) => setNewItemForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5"
                />
              </div>

              {/* Live line summary */}
              {(() => {
                const gross = (newItemForm.quantity || 0) * (newItemForm.unit_price || 0);
                const sub = Math.max(0, gross - (newItemForm.discount_amount || 0));
                const vat = isVatEnabled ? Number(((sub * (newItemForm.vat_rate || 0)) / 100).toFixed(2)) : 0;
                const wht = isWhtEnabled ? Number(((sub * (newItemForm.withholding_tax_rate || 0)) / 100).toFixed(2)) : 0;
                const tot = Number((sub + vat - wht).toFixed(2));

                return (
                  <div className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-3">
                      <span>الإجمالي: <strong className="text-slate-800 dark:text-slate-200">{formatMoney(gross)}</strong></span>
                      <span>الصافي قبل الضريبة: <strong className="text-blue-600">{formatMoney(sub)}</strong></span>
                      {isVatEnabled && <span>ض.ق.م: <strong className="text-emerald-600">+{formatMoney(vat)}</strong></span>}
                      {isWhtEnabled && wht > 0 && <span>ض.خ.إ: <strong className="text-purple-600">-{formatMoney(wht)}</strong></span>}
                    </div>
                    <div className="font-bold text-sm text-emerald-600">
                      الصافي النهائي: {formatMoney(tot)}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setAddingItemDocRef(null)}
                className="px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveNewItem}
                className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة الصنف للمستند</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Past Batch Details Modal */}
      {selectedBatchDetails && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full p-4 shadow-2xl space-y-3 max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                      تفاصيل تشغيلة: {selectedBatchDetails.batch_number}
                    </h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      selectedBatchDetails.status === 'posted' || selectedBatchDetails.status === 'completed'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {selectedBatchDetails.status === 'posted' || selectedBatchDetails.status === 'completed' ? 'مكتملة بالكامل' : 'حفظ جزئي'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                    تاريخ التشغيلة: {selectedBatchDetails.batch_date ? String(selectedBatchDetails.batch_date).slice(0, 10) : '-'} | الإجمالي: {formatMoney(Number(selectedBatchDetails.total_amount) || 0)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditingBatch(selectedBatchDetails);
                    setEditBatchDate(selectedBatchDetails.batch_date ? String(selectedBatchDetails.batch_date).slice(0, 10) : '');
                    setEditBatchStatus(selectedBatchDetails.status || 'posted');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{isAr ? 'تعديل التشغيلة' : 'Edit Batch'}</span>
                </button>
                <button
                  onClick={() => handleExportPastBatch(selectedBatchDetails)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isAr ? 'تصدير إكسيل التشغيلة' : 'Export Batch Excel'}</span>
                </button>
                <button
                  onClick={() => setSelectedBatchDetails(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Documents Table */}
            <div className="overflow-y-auto flex-1 rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 sticky top-0">
                  <tr>
                    <th className="py-2 px-3">رقم المرجع (Ref)</th>
                    <th className="py-2 px-3">نوع المستند</th>
                    <th className="py-2 px-3">الطرف</th>
                    <th className="py-2 px-3 text-center">التاريخ</th>
                    <th className="py-2 px-3 text-center">رقم المستند المنشأ</th>
                    <th className="py-2 px-3 text-center">رقم القيد المنشأ</th>
                    <th className="py-2 px-3 text-center font-bold">الصافي</th>
                    <th className="py-2 px-3 text-center">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(selectedBatchDetails.details || []).map((doc: any, docIdx: number) => {
                    const isDocSaved = doc.status === 'saved';
                    return (
                      <tr key={docIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-2 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                          {doc.ref}
                        </td>
                        <td className="py-2 px-3">
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-slate-100 dark:bg-slate-800">
                            {doc.doc_type}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">
                          {doc.party_name}
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-[11px] text-slate-500">
                          {doc.date}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold">
                          {doc.created_document_number ? (
                            <button
                              onClick={() => {
                                handleNavigateToDocument(doc);
                                setSelectedBatchDetails(null);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 cursor-pointer"
                              title="فتح المستند في النظام"
                            >
                              <span>{doc.created_document_number}</span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                            </button>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold">
                          {doc.created_journal_number ? (
                            <button
                              onClick={() => {
                                handleNavigateToJournal(doc);
                                setSelectedBatchDetails(null);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 cursor-pointer"
                              title="فتح القيد المحاسبي في النظام"
                            >
                              <span>قيد: {doc.created_journal_number}</span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                            </button>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          {formatMoney(Number(doc.total_amount) || 0)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {isDocSaved ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>تم الحفظ</span>
                            </span>
                          ) : (
                            <span 
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200"
                              title={doc.error_message}
                            >
                              <AlertTriangle className="w-3 h-3 text-red-600" />
                              <span className="truncate max-w-[140px]">{doc.error_message || 'تعذر الحفظ'}</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setSelectedBatchDetails(null)}
                className="px-4 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Edit Batch Modal (تعديل بيانات التشغيلة) */}
      {editingBatch && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-4 shadow-2xl space-y-4">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                    {isAr ? 'تعديل بيانات التشغيلة' : 'Edit Batch'}: {editingBatch.batch_number}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {isAr ? 'تعديل تاريخ وحالة التشغيلة أو إعادة فتحها للمراجعة والتعديل' : 'Modify batch date, status, or re-open for editing'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingBatch(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? 'رقم التشغيلة' : 'Batch Number'}
                </label>
                <input
                  type="text"
                  disabled
                  value={editingBatch.batch_number}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono text-xs border border-slate-200 dark:border-slate-700 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? 'تاريخ التشغيلة' : 'Batch Date'}
                </label>
                <input
                  type="date"
                  value={editBatchDate}
                  onChange={(e) => setEditBatchDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs border border-slate-200 dark:border-slate-700 focus:outline-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? 'حالة التشغيلة' : 'Batch Status'}
                </label>
                <select
                  value={editBatchStatus}
                  onChange={(e) => setEditBatchStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs border border-slate-200 dark:border-slate-700 focus:outline-emerald-500 cursor-pointer"
                >
                  <option value="posted">{isAr ? 'مكتملة بالكامل (Posted)' : 'Completed (Posted)'}</option>
                  <option value="partial">{isAr ? 'حفظ جزئي (Partial)' : 'Partial'}</option>
                  <option value="pending">{isAr ? 'معلقة (Pending)' : 'Pending'}</option>
                  <option value="draft">{isAr ? 'مسودة (Draft)' : 'Draft'}</option>
                </select>
              </div>

              {/* Statistics info box */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500">{isAr ? 'عدد المستندات' : 'Docs'}: </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{editingBatch.total_documents || 0}</span>
                </div>
                <div>
                  <span className="text-slate-500">{isAr ? 'إجمالي القيمة' : 'Total'}: </span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">{formatMoney(Number(editingBatch.total_amount) || 0)}</span>
                </div>
                <div>
                  <span className="text-slate-500">{isAr ? 'النوع' : 'Type'}: </span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">{editingBatch.batch_type === 'sales' ? (isAr ? 'مبيعات' : 'Sales') : (isAr ? 'مشتريات' : 'Purchases')}</span>
                </div>
              </div>

              {/* Load into workspace button */}
              <button
                type="button"
                onClick={() => handleLoadBatchIntoWorkspace(editingBatch)}
                className="w-full py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{isAr ? 'تحميل بيانات التشغيلة في جدول الاستيراد لإعادة المعالجة' : 'Load Batch into Workspace to Re-process / Edit'}</span>
              </button>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => setEditingBatch(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={isUpdatingBatch}
                onClick={handleSaveBatchEdit}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 cursor-pointer shadow-xs transition-all"
              >
                {isUpdatingBatch ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{isAr ? 'جاري الحفظ...' : 'Saving...'}</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>{isAr ? 'حفظ التعديلات' : 'Save Changes'}</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default DocumentImport;
