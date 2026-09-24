import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigation } from '../contexts/NavigationContext';
import { dbService, apiRequest } from '../services/dbService';
import { PostingService } from '../services/PostingService';
import { formatNumber, formatMoney } from '../utils/formatUtils';
import { Customer, Supplier, Product, Warehouse, PaymentMethod, Account } from '../types';
import { 
  FileSpreadsheet, UploadCloud, Download, CheckCircle2, AlertTriangle, 
  Trash2, Edit3, ChevronDown, ChevronUp, FileText, ArrowUpFromLine, 
  ArrowDownToLine, RotateCcw, Hash, Calendar, Layers, ShieldCheck, 
  X, Check, RefreshCw, Eye, Sparkles, ExternalLink
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
}

interface ValidationError {
  rowNumber: number;
  ref: string;
  field: string;
  message: string;
}

export const DocumentImport: React.FC<DocumentImportProps> = ({ type }) => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const { language, dir } = useLanguage();
  const { openTab, setPendingViewDoc } = useNavigation();

  const isSales = type === 'sales';
  const entityLabel = isSales ? 'العميل' : 'المورد';
  const pageTitle = isSales ? 'استيراد مستندات بيع من إكسيل' : 'استيراد مستندات شراء من إكسيل';
  const sequenceModuleName = isSales ? 'sales_import_batches' : 'purchases_import_batches';

  // Master data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
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

  // Edit item modal state
  const [editingItem, setEditingItem] = useState<{ docRef: string; item: ParsedItem } | null>(null);

  // Save / Post state
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [saveProgress, setSaveProgress] = useState<{ current: number; total: number; statusText: string } | null>(null);
  const [isBatchSaved, setIsBatchSaved] = useState(false);

  // Tabs: 'import' or 'history'
  const [activeMainTab, setActiveMainTab] = useState<'import' | 'history'>('import');
  const [batchesHistory, setBatchesHistory] = useState<any[]>([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [selectedBatchDetails, setSelectedBatchDetails] = useState<any | null>(null);

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
          compRes
        ] = await Promise.all([
          dbService.list<Customer>('customers', { company_id: user.company_id }),
          dbService.list<Supplier>('suppliers', { company_id: user.company_id }),
          dbService.list<Product>('products', { company_id: user.company_id }),
          dbService.list<Warehouse>('warehouses', { company_id: user.company_id }),
          dbService.list<PaymentMethod>('payment_methods', { company_id: user.company_id }),
          dbService.list<Account>('accounts', { company_id: user.company_id }),
          dbService.get<any>('companies', user.company_id).catch(() => null)
        ]);

        setCustomers(custs || []);
        setSuppliers(supps || []);
        setProducts(prods || []);
        setWarehouses(whs || []);
        setPaymentMethods(pms || []);
        setAccounts(accs || []);
        setCompanySettings(compRes?.settings || {});
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

  // Audit items accounts for journal entries (sales, cost, inventory, vat, wht)
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

    const defaultSalesAcc = accounts.find(a => 
      a.account_usage === 'sales_revenue' ||
      a.code === '4101' ||
      a.name.includes('المبيعات') ||
      a.name.includes('إيرادات مبيعات')
    );

    const defaultCostAcc = accounts.find(a => 
      a.account_usage === 'cost_of_sales' ||
      a.code === '5101' ||
      a.name.includes('تكلفة المبيعات')
    );

    const defaultInvAcc = accounts.find(a => 
      a.account_usage === 'inventory' ||
      a.code === '1201' ||
      a.name.includes('المخزون')
    );

    const defaultVatAcc = accounts.find(a => 
      a.account_usage === 'vat' ||
      a.account_usage === 'vat_sales' ||
      a.code === '2221' ||
      a.name.includes('قيمة مضافة')
    );

    const defaultWhtAcc = accounts.find(a => 
      a.account_usage === 'withholding_tax_customers' ||
      a.code === '112' ||
      a.name.includes('خصم من العملاء') ||
      a.name.includes('تحت حساب الضريبة')
    );

    return Array.from(uniqueMap.values()).map(item => {
      const prod = products.find(p => p.id === item.product_id || (p.code && p.code.toLowerCase() === item.product_code.toLowerCase()));
      const isService = item.is_service || prod?.type === 'service';

      // 1. Sales Account
      const salesAccId = prod?.revenue_account_id;
      const salesAccName = prod?.revenue_account_name || accounts.find(a => a.id === salesAccId)?.name;
      const hasDirectSales = !!salesAccId;
      const finalSalesName = salesAccName || defaultSalesAcc?.name || 'حساب المبيعات الافتراضي';
      const salesStatus = hasDirectSales ? 'linked' : (defaultSalesAcc ? 'fallback' : 'missing');

      // 2. Cost Account
      const costAccId = prod?.cost_account_id;
      const costAccName = prod?.cost_account_name || accounts.find(a => a.id === costAccId)?.name;
      const hasDirectCost = !!costAccId;
      const finalCostName = costAccName || defaultCostAcc?.name || 'حساب تكلفة المبيعات الافتراضي';
      const costStatus = isService ? 'exempt' : (hasDirectCost ? 'linked' : (defaultCostAcc ? 'fallback' : 'missing'));

      // 3. Inventory Account
      const invAccId = prod?.inventory_account_id;
      const invAccName = prod?.inventory_account_name || accounts.find(a => a.id === invAccId)?.name;
      const hasDirectInv = !!invAccId;
      const finalInvName = invAccName || defaultInvAcc?.name || 'حساب المخزون الافتراضي';
      const invStatus = isService ? 'exempt' : (hasDirectInv ? 'linked' : (defaultInvAcc ? 'fallback' : 'missing'));

      // 4. VAT Account
      const vatAccId = prod?.sales_vat_account_id || prod?.vat_account_id;
      const vatAccName = prod?.sales_vat_account_name || prod?.vat_account_name || accounts.find(a => a.id === vatAccId)?.name;
      const hasDirectVat = !!vatAccId;
      const finalVatName = vatAccName || defaultVatAcc?.name || 'حساب القيمة المضافة الافتراضي';
      const vatStatus = hasDirectVat ? 'linked' : (defaultVatAcc ? 'fallback' : 'missing');

      // 5. WHT Account
      const whtAccId = prod?.sales_withholding_tax_account_id;
      const whtAccName = prod?.sales_withholding_tax_account_name || accounts.find(a => a.id === whtAccId)?.name;
      const hasDirectWht = !!whtAccId;
      const finalWhtName = whtAccName || defaultWhtAcc?.name || 'حساب الخصم والإضافة الافتراضي';
      const whtStatus = hasDirectWht ? 'linked' : (defaultWhtAcc ? 'fallback' : 'missing');

      return {
        product_code: item.product_code,
        product_name: item.product_name,
        is_service: isService,
        sales: { name: finalSalesName, status: salesStatus },
        cost: { name: finalCostName, status: costStatus },
        inventory: { name: finalInvName, status: invStatus },
        vat: { name: finalVatName, status: vatStatus },
        wht: { name: finalWhtName, status: whtStatus }
      };
    });
  }, [documents, products, accounts]);

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
      'ملاحظات'
    ];

    const exampleRows = isSales ? [
      ['Ref-000001', 'فاتورة بيع', batchDate, sampleParty, sampleProd1, sampleProdName1, sampleWarehouse, 10, 150, 0, sampleVatRate, sampleWhtRate, 'آجل', 'فاتورة مبيعات بضاعة - صنف أول'],
      ['Ref-000001', 'فاتورة بيع', batchDate, sampleParty, sampleProd2, sampleProdName2, sampleWarehouse, 5, 200, 20, sampleVatRate, sampleWhtRate, 'آجل', 'فاتورة مبيعات بضاعة - صنف ثانٍ لنفس الفاتورة'],
      ['Ref-000002', 'أمر بيع', batchDate, sampleParty, sampleProd1, sampleProdName1, sampleWarehouse, 25, 145, 50, sampleVatRate, 0, 'آجل', 'أمر بيع معتمد للعميل'],
      ['Ref-000003', 'مرتجع بيع', batchDate, sampleParty, sampleProd2, sampleProdName2, sampleWarehouse, 2, 200, 0, sampleVatRate, sampleWhtRate, 'نقدي', 'مرتجع مبيعات نقدي تالف']
    ] : [
      ['Ref-000001', 'فاتورة شراء', batchDate, sampleParty, sampleProd1, sampleProdName1, sampleWarehouse, 50, 120, 100, sampleVatRate, sampleWhtRate, 'آجل', 'فاتورة توريد خامات - بند أول'],
      ['Ref-000001', 'فاتورة شراء', batchDate, sampleParty, sampleProd2, sampleProdName2, sampleWarehouse, 30, 180, 0, sampleVatRate, sampleWhtRate, 'آجل', 'فاتورة توريد خامات - بند ثانٍ'],
      ['Ref-000002', 'أمر شراء', batchDate, sampleParty, sampleProd1, sampleProdName1, sampleWarehouse, 100, 115, 0, sampleVatRate, 0, 'آجل', 'أمر شراء معتمد للمورد'],
      ['Ref-000003', 'مرتجع شراء', batchDate, sampleParty, sampleProd2, sampleProdName2, sampleWarehouse, 5, 180, 0, sampleVatRate, sampleWhtRate, 'آجل', 'مرتجع مشتريات لعدم مطابقة المواصفات']
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
      { wch: 30 }  // Notes
    ];

    XLSX.utils.book_append_sheet(wb, dataWs, 'بيانات المستندات');

    const downloadFileName = isSales 
      ? `نموذج_استيراد_مستندات_البيع_${batchDate}.xlsx`
      : `نموذج_استيراد_مستندات_الشراء_${batchDate}.xlsx`;

    XLSX.writeFile(wb, downloadFileName);
    showNotification('تم تنزيل نموذج الإكسيل التجريبي بنجاح', 'success');
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

      // Parse data rows (row index 0 is header)
      for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        const rowNumber = i + 1; // 1-based index in Excel

        // Ignore empty lines
        if (!row || row.every(cell => cell === '' || cell === null || cell === undefined)) {
          continue;
        }

        const rawRef = String(row[0] || '').trim();
        const rawDocType = String(row[1] || '').trim();
        const rawDate = row[2];
        const rawParty = String(row[3] || '').trim();
        const rawProdCode = String(row[4] || '').trim();
        const rawProdName = String(row[5] || '').trim();
        const rawWarehouse = String(row[6] || '').trim();
        const rawQty = row[7];
        const rawPrice = row[8];
        const rawDiscount = row[9];
        const rawVatRate = row[10];
        const rawWhtRate = row[11];
        const rawPaymentType = String(row[12] || '').trim();
        const rawNotes = String(row[13] || '').trim();

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
          matchedProduct = products.find(p => 
            (rawProdCode && p.code && p.code.toLowerCase() === rawProdCode.toLowerCase()) ||
            (rawProdCode && p.barcode && p.barcode.toLowerCase() === rawProdCode.toLowerCase()) ||
            (rawProdName && p.name && p.name.trim().toLowerCase() === rawProdName.toLowerCase()) ||
            (rawProdCode && p.name && p.name.trim().toLowerCase() === rawProdCode.toLowerCase())
          );

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
              is_service: isServiceItem
            });
          }
        }
      }

      setValidationErrors(errors);

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

      setDocuments(docsList);

      // Expand all by default
      const initialExp: Record<string, boolean> = {};
      docsList.forEach(d => { initialExp[d.ref] = true; });
      setExpandedRefs(initialExp);

      if (errors.length > 0) {
        showNotification(`تم فحص الملف: تم العثور على ${errors.length} خطأ بحاجة لمراجعة`, 'error');
      } else {
        showNotification(`تم فحص ومطابقة الملف بنجاح! تم استخراج ${docsList.length} مستند صالح`, 'success');
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
    setDocuments(prev => prev.filter(d => d.ref !== ref));
    setValidationErrors(prev => prev.filter(e => e.ref !== ref));
    showNotification(`تم حذف المستند ${ref} من الدفعة`, 'info');
  };

  // Delete item from document
  const handleDeleteItem = (docRef: string, itemId: string) => {
    setDocuments(prev => {
      return prev.map(doc => {
        if (doc.ref !== docRef) return doc;
        const newItems = doc.items.filter(it => it.id !== itemId);
        const newTotals = recalculateDocTotals(newItems);
        return {
          ...doc,
          items: newItems,
          ...newTotals
        };
      }).filter(doc => doc.items.length > 0);
    });
    showNotification('تم حذف البند وإعادة احتساب الإجماليات', 'info');
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

    setDocuments(prev => {
      return prev.map(doc => {
        if (doc.ref !== docRef) return doc;
        const newItems = doc.items.map(it => it.id === finalItem.id ? finalItem : it);
        const newTotals = recalculateDocTotals(newItems);
        return {
          ...doc,
          items: newItems,
          ...newTotals
        };
      });
    });

    setEditingItem(null);
    showNotification('تم تحديث بيانات الصنف وإعادة احتساب الإجماليات بنجاح', 'success');
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

    const unsavedDocs = documents.filter(d => d.status !== 'saved');
    if (unsavedDocs.length === 0) {
      showNotification('جميع المستندات في هذه الدفعة محفوظة ومرحلة بالفعل', 'info');
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
      
      // Skip already saved documents
      if (doc.status === 'saved') {
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
          description: item.description || ''
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
          description: item.description || ''
        }));

        if (doc.doc_type === 'فاتورة بيع') {
          const invPayload = {
            customer_id: doc.party_id,
            customer_name: doc.party_name,
            warehouse_id: doc.warehouse_id || null,
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

          const invRes: any = await apiRequest('/invoices', 'POST', invPayload);
          createdDocId = invRes.id;
          createdDocNumber = invRes.invoice_number || `INV-${createdDocId.slice(-6)}`;

          // Generate Journal Entry via PostingService
          try {
            const fullInv = { ...invPayload, id: createdDocId, invoice_number: createdDocNumber };
            const journalData = PostingService.generateInvoiceJournal(
              fullInv as any,
              customers,
              products,
              accounts,
              paymentMethods,
              companySettings
            );

            const jeRes: any = await apiRequest('/journal_entries', 'POST', {
              ...journalData,
              reference_id: createdDocId,
              company_id: user?.company_id
            });
            createdJournalId = jeRes.id;
            createdJournalNumber = jeRes.entry_number || '';
          } catch (jeErr: any) {
            console.warn('Journal generation for invoice warning:', jeErr);
          }

        } else if (doc.doc_type === 'أمر بيع') {
          const soPayload = {
            customer_id: doc.party_id,
            customer_name: doc.party_name,
            warehouse_id: doc.warehouse_id || null,
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

          const soRes: any = await apiRequest('/sales_orders', 'POST', soPayload);
          createdDocId = soRes.id;
          createdDocNumber = soRes.order_number || `SO-${createdDocId.slice(-6)}`;

        } else if (doc.doc_type === 'مرتجع بيع') {
          // Note: returns table only stores total_amount and withholding_tax_amount
          const retPayload = {
            customer_id: doc.party_id,
            customer_name: doc.party_name,
            warehouse_id: doc.warehouse_id || null,
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

          const retRes: any = await apiRequest('/returns', 'POST', retPayload);
          createdDocId = retRes.id;
          createdDocNumber = retRes.return_number || `RET-${createdDocId.slice(-6)}`;

          // Generate Journal Entry for Return
          try {
            const fullRet = { ...retPayload, id: createdDocId, return_number: createdDocNumber };
            const journalData = PostingService.generateReturnJournal(
              fullRet as any,
              customers,
              products,
              accounts,
              paymentMethods
            );

            const jeRes: any = await apiRequest('/journal_entries', 'POST', {
              ...journalData,
              reference_id: createdDocId,
              company_id: user?.company_id
            });
            createdJournalId = jeRes.id;
            createdJournalNumber = jeRes.entry_number || '';
          } catch (jeErr: any) {
            console.warn('Journal generation for return warning:', jeErr);
          }

        } else if (doc.doc_type === 'فاتورة شراء') {
          const pinvPayload = {
            supplier_id: doc.party_id,
            supplier_name: doc.party_name,
            warehouse_id: doc.warehouse_id || null,
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

          const pinvRes: any = await apiRequest('/purchase_invoices', 'POST', pinvPayload);
          createdDocId = pinvRes.id;
          createdDocNumber = pinvRes.invoice_number || `PINV-${createdDocId.slice(-6)}`;

          // Generate Journal Entry for Purchase Invoice
          try {
            const fullPinv = { ...pinvPayload, id: createdDocId, invoice_number: createdDocNumber };
            const journalData = PostingService.generatePurchaseInvoiceJournal(
              fullPinv as any,
              suppliers,
              products,
              accounts,
              paymentMethods,
              companySettings
            );

            const jeRes: any = await apiRequest('/journal_entries', 'POST', {
              ...journalData,
              reference_id: createdDocId,
              company_id: user?.company_id
            });
            createdJournalId = jeRes.id;
            createdJournalNumber = jeRes.entry_number || '';
          } catch (jeErr: any) {
            console.warn('Journal generation for purchase invoice warning:', jeErr);
          }

        } else if (doc.doc_type === 'أمر شراء') {
          const poPayload = {
            supplier_id: doc.party_id,
            supplier_name: doc.party_name,
            warehouse_id: doc.warehouse_id || null,
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

          const poRes: any = await apiRequest('/purchase_orders', 'POST', poPayload);
          createdDocId = poRes.id;
          createdDocNumber = poRes.order_number || `PO-${createdDocId.slice(-6)}`;

        } else if (doc.doc_type === 'مرتجع شراء') {
          // Note: purchase_returns table only stores total_amount and withholding_tax_amount
          const pretPayload = {
            supplier_id: doc.party_id,
            supplier_name: doc.party_name,
            warehouse_id: doc.warehouse_id || null,
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

          const pretRes: any = await apiRequest('/purchase_returns', 'POST', pretPayload);
          createdDocId = pretRes.id;
          createdDocNumber = pretRes.return_number || `PRET-${createdDocId.slice(-6)}`;

          // Generate Journal Entry for Purchase Return
          try {
            const fullPret = { ...pretPayload, id: createdDocId, return_number: createdDocNumber };
            const journalData = PostingService.generatePurchaseReturnJournal(
              fullPret as any,
              suppliers,
              products,
              accounts,
              paymentMethods
            );

            const jeRes: any = await apiRequest('/journal_entries', 'POST', {
              ...journalData,
              reference_id: createdDocId,
              company_id: user?.company_id
            });
            createdJournalId = jeRes.id;
            createdJournalNumber = jeRes.entry_number || '';
          } catch (jeErr: any) {
            console.warn('Journal generation for purchase return warning:', jeErr);
          }
        }

        updatedDocuments[idx] = {
          ...doc,
          created_document_id: createdDocId,
          created_document_number: createdDocNumber,
          created_journal_id: createdJournalId,
          created_journal_number: createdJournalNumber,
          status: 'saved',
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
          party_name: d.party_name,
          date: d.date,
          total_amount: d.total_amount,
          created_document_id: d.created_document_id,
          created_document_number: d.created_document_number,
          created_journal_id: d.created_journal_id,
          created_journal_number: d.created_journal_number,
          status: d.status,
          error_message: d.error_message
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
                                onClick={() => setSelectedBatchDetails(batch)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs border border-emerald-200 transition-colors cursor-pointer"
                                title="استعراض تفاصيل المستندات والقيود لهذه التشغيلة"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>المستندات والقيود</span>
                              </button>
                              <button
                                onClick={() => handleExportPastBatch(batch)}
                                className="p-1 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 cursor-pointer"
                                title="تصدير إكسيل التشغيلة"
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
                      {validationErrors.map((err, i) => (
                        <tr key={i} className="hover:bg-amber-50/50 dark:hover:bg-slate-800/50">
                          <td className="p-2 font-mono font-bold text-amber-700 dark:text-amber-400">الصف {err.rowNumber}</td>
                          <td className="p-2 font-mono">{err.ref}</td>
                          <td className="p-2 font-semibold">{err.field}</td>
                          <td className="p-2 text-red-600 dark:text-red-400">{err.message}</td>
                        </tr>
                      ))}
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
                  <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full font-semibold">
                    {itemsAccountAudit.every(a => a.sales.status !== 'missing' && a.cost.status !== 'missing' && a.inventory.status !== 'missing') ? '✓ جميع الأصناف مرتبطة بحسابات صحيحة' : '⚠️ توجد أصناف تحتاج مراجعة الحسابات'}
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
                        <th className="py-1.5 px-2.5 text-center">حساب المبيعات / الإيراد</th>
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
                            <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold ${
                              aud.sales.status === 'linked' 
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}>
                              {aud.sales.status === 'linked' ? '✓ ' : '⚠️ '}{aud.sales.name}
                            </span>
                          </td>
                          <td className="py-1.5 px-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold ${
                              aud.cost.status === 'exempt'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                : aud.cost.status === 'linked'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}>
                              {aud.cost.status === 'exempt' ? 'خدمي (معفى)' : (aud.cost.status === 'linked' ? '✓ ' : '⚠️ ') + aud.cost.name}
                            </span>
                          </td>
                          <td className="py-1.5 px-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold ${
                              aud.inventory.status === 'exempt'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                : aud.inventory.status === 'linked'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}>
                              {aud.inventory.status === 'exempt' ? 'خدمي (معفى)' : (aud.inventory.status === 'linked' ? '✓ ' : '⚠️ ') + aud.inventory.name}
                            </span>
                          </td>
                          <td className="py-1.5 px-2.5 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-sans font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              ✓ {aud.vat.name}
                            </span>
                          </td>
                          <td className="py-1.5 px-2.5 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-sans font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                              ✓ {aud.wht.name}
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

                          {/* 3. Error Badge if document failed */}
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
                        </div>

                        {/* Left: Net Total Badge & Delete Action */}
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 text-xs font-mono bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-lg">
                            <span className="text-emerald-700 dark:text-emerald-300 font-medium">الصافي:</span>
                            <span className="text-emerald-900 dark:text-emerald-100 font-bold">{formatMoney(doc.total_amount)}</span>
                          </div>

                          {doc.status !== 'saved' && (
                            <button
                              onClick={() => handleDeleteDocument(doc.ref)}
                              className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                              title="حذف المستند بالكامل"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
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
                                  <th className="py-1 px-2 text-center text-[11px]">الكمية</th>
                                  <th className="py-1 px-2 text-center text-[11px]">السعر</th>
                                  <th className="py-1 px-2 text-center text-[11px]">الخصم</th>
                                  <th className="py-1 px-2 text-center text-[11px]">الصافي قبل الضريبة</th>
                                  <th className="py-1 px-2 text-center text-[11px]">ض.ق.م (%)</th>
                                  <th className="py-1 px-2 text-center text-[11px]">قيمة ض.ق.م</th>
                                  <th className="py-1 px-2 text-center text-[11px]">ض.خ.أ (%)</th>
                                  <th className="py-1 px-2 text-center text-[11px]">قيمة ض.خ.أ</th>
                                  <th className="py-1 px-2 text-center font-extrabold text-slate-900 dark:text-white text-[11px]">الإجمالي</th>
                                  {doc.status !== 'saved' && <th className="py-1 px-2 text-center w-16 text-[11px]">إجراءات</th>}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-xs">
                                {doc.items.map((item, itemIdx) => (
                                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                    <td className="py-1 px-2 text-center text-slate-400 font-sans">{itemIdx + 1}</td>
                                    <td className="py-1 px-2 font-semibold text-slate-700 dark:text-slate-300">{item.product_code}</td>
                                    <td className="py-1 px-2 font-sans font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                      <span>{item.product_name}</span>
                                      {item.is_service && (
                                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 font-semibold border border-purple-200 dark:border-purple-800">
                                          خدمة
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-1 px-2 text-center font-bold text-slate-900 dark:text-white">{item.quantity}</td>
                                    <td className="py-1 px-2 text-center">{formatMoney(item.unit_price)}</td>
                                    <td className="py-1 px-2 text-center text-amber-600 font-bold">{formatMoney(item.discount_amount)}</td>
                                    <td className="py-1 px-2 text-center text-blue-600 font-bold">{formatMoney(item.subtotal)}</td>
                                    <td className="py-1 px-2 text-center text-slate-500 font-sans">{item.vat_rate}%</td>
                                    <td className="py-1 px-2 text-center text-emerald-600 font-bold">{formatMoney(item.vat_amount)}</td>
                                    <td className="py-1 px-2 text-center text-slate-500 font-sans">{item.withholding_tax_rate}%</td>
                                    <td className="py-1 px-2 text-center text-purple-600 font-bold">{formatMoney(item.withholding_tax_amount)}</td>
                                    <td className="py-1 px-2 text-center font-extrabold text-emerald-700 dark:text-emerald-300">{formatMoney(item.total)}</td>
                                    {doc.status !== 'saved' && (
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
                                    )}
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
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">الكمية:</label>
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
                  onClick={() => handleExportPastBatch(selectedBatchDetails)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تصدير إكسيل التشغيلة</span>
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

    </div>
  );
};

export default DocumentImport;
